import pytest
from fastapi import FastAPI

from selakcrm.login_rate_limit import clear_all_login_rate_limit_state
from fastapi.middleware.cors import CORSMiddleware
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from selakcrm.database import get_db
from selakcrm.domain.search import register_sqlite_search_functions
from selakcrm.http_errors import register_http_exception_handlers
from selakcrm.models import Base
from selakcrm.routes.bundle import build_api_router
from selakcrm.services.renewal_sync import RenewalSyncService


@pytest.fixture(autouse=True)
def _reset_login_rate_limit_state() -> None:
    clear_all_login_rate_limit_state()
    RenewalSyncService.invalidate_sync_cache()
    yield
    clear_all_login_rate_limit_state()
    RenewalSyncService.invalidate_sync_cache()


@event.listens_for(Engine, "connect")
def _test_sqlite_search_functions(dbapi_connection, connection_record) -> None:
    register_sqlite_search_functions(dbapi_connection)


@pytest.fixture
def client() -> TestClient:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
            db.commit()
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()

    app = FastAPI()
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    register_http_exception_handlers(app)
    app.include_router(build_api_router())
    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as c:
        yield c
