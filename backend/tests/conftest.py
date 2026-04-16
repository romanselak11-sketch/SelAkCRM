import pytest
from fastapi import FastAPI, Request

from selakcrm.login_rate_limit import clear_all_login_rate_limit_state
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from starlette.exceptions import HTTPException as StarletteHTTPException

from selakcrm.database import get_db
from selakcrm.validation_http import nest_validation_messages
from selakcrm.models import Base
from selakcrm.routes.bundle import build_api_router
from selakcrm.services.renewal_sync import RenewalSyncService


async def _http_exc_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    if isinstance(exc.detail, dict):
        return JSONResponse(status_code=exc.status_code, content=exc.detail)
    msg = str(exc.detail) if exc.detail else exc.__class__.__name__
    err = {
        400: "Bad Request",
        401: "Unauthorized",
        403: "Forbidden",
        404: "Not Found",
        409: "Conflict",
        422: "Unprocessable Entity",
        429: "Too Many Requests",
    }.get(exc.status_code, "Error")
    return JSONResponse(
        status_code=exc.status_code,
        content={"statusCode": exc.status_code, "message": msg, "error": err},
    )


async def _validation_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    return JSONResponse(
        status_code=400,
        content={
            "statusCode": 400,
            "message": nest_validation_messages(exc.errors()),
            "error": "Bad Request",
        },
    )


@pytest.fixture(autouse=True)
def _reset_login_rate_limit_state() -> None:
    clear_all_login_rate_limit_state()
    RenewalSyncService.invalidate_sync_cache()
    yield
    clear_all_login_rate_limit_state()
    RenewalSyncService.invalidate_sync_cache()


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
    app.add_exception_handler(StarletteHTTPException, _http_exc_handler)
    app.add_exception_handler(RequestValidationError, _validation_handler)
    app.include_router(build_api_router())
    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as c:
        yield c
