from __future__ import annotations

from datetime import datetime

import pytest
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from selakcrm.database import get_db
from selakcrm.http_errors import register_http_exception_handlers
from selakcrm.licensing.guard import InMemoryLicenseCacheStore, InMemoryTrialStore, LicenseGuard
from selakcrm.licensing.models import BlockedReason, LicenseStatus
from selakcrm.licensing.crypto import generate_keypair
from selakcrm.models import Base
from selakcrm.routes.bundle import build_api_router


class _BlockedGuard(LicenseGuard):
    def state(self):  # type: ignore[override]
        from selakcrm.licensing.models import GuardState

        return GuardState(status=LicenseStatus.BLOCKED, reason=BlockedReason.TRIAL_EXPIRED)

    def is_active(self) -> bool:
        return False


@pytest.fixture
def enforced_client(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    monkeypatch.setattr("selakcrm.config.settings.license_enforce", True)
    # property enforce_license reads frozen OR license_enforce
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
    _, public = generate_keypair()
    guard = _BlockedGuard(
        InMemoryTrialStore(),
        InMemoryLicenseCacheStore(),
        [public],
        hwid="hw_test",
        clock=lambda: datetime(2026, 1, 1),
    )
    app.state.license_guard = guard

    @app.middleware("http")
    async def license_gate_middleware(request, call_next):
        from selakcrm.config import settings
        from fastapi.responses import JSONResponse

        if not settings.enforce_license or request.method == "OPTIONS":
            return await call_next(request)
        path = request.url.path
        if (
            path.startswith("/api/v1/license/")
            or path == "/api/v1/health"
            or not path.startswith("/api/")
        ):
            return await call_next(request)
        state = request.app.state.license_guard.state()
        if state.status not in (LicenseStatus.DEMO, LicenseStatus.FULL):
            return JSONResponse(
                status_code=403,
                content={
                    "statusCode": 403,
                    "message": "Доступ к программе закрыт: требуется активная лицензия",
                    "error": "Forbidden",
                    "licenseReason": state.reason.value if state.reason else "blocked",
                },
            )
        return await call_next(request)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    register_http_exception_handlers(app)
    app.include_router(build_api_router())

    @app.get("/spa-page")
    def spa_page():
        return {"ok": True}

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c


def test_license_gate_blocks_api(enforced_client: TestClient) -> None:
    res = enforced_client.get(
        "/api/v1/clients",
        headers={"Origin": "http://localhost:5173"},
    )
    assert res.status_code == 403
    body = res.json()
    assert body["licenseReason"] == "trial_expired"
    assert res.headers.get("access-control-allow-origin") == "http://localhost:5173"


def test_license_status_and_health_allowed(enforced_client: TestClient) -> None:
    assert enforced_client.get("/api/v1/license/status").status_code == 200
    assert enforced_client.get("/api/v1/health").status_code == 200


def test_non_api_and_options_allowed(enforced_client: TestClient) -> None:
    assert enforced_client.get("/spa-page").status_code == 200
    res = enforced_client.options(
        "/api/v1/clients",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert res.status_code in (200, 204)


@pytest.fixture
def license_client() -> tuple[TestClient, LicenseGuard, bytes]:
    private, public = generate_keypair()
    guard = LicenseGuard(
        InMemoryTrialStore(),
        InMemoryLicenseCacheStore(),
        [public],
        hwid="hw_x",
        clock=lambda: datetime(2026, 1, 1),
    )
    app = FastAPI()
    app.state.license_guard = guard
    register_http_exception_handlers(app)
    app.include_router(build_api_router())
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)

    def override_get_db():
        db = Session()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c, guard, private


def _no_rate_limit(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("selakcrm.routes.license_routes._rate_limit", lambda *a, **kw: None)


def test_activate_then_redeem_grants_full_access(
    license_client: tuple[TestClient, LicenseGuard, bytes],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from selakcrm.licensing.activation_code import issue_activation_code
    from selakcrm.licensing.keys import parse_full_key

    client, guard, private = license_client
    _no_rate_limit(monkeypatch)
    full_key = "SAK-AAAA-secretvaluesecre1"

    activated = client.post("/api/v1/license/activate", json={"full_key": full_key})
    assert activated.status_code == 200
    body = activated.json()
    assert body["status"] == "pending_activation"
    assert body["requestCode"].startswith("SAKREQ-")

    code = issue_activation_code(parse_full_key(full_key).key_id, guard.hwid, private)
    redeemed = client.post("/api/v1/license/redeem", json={"code": code})
    assert redeemed.status_code == 200
    assert redeemed.json()["status"] == "full"


def test_activate_rejects_malformed_key(
    license_client: tuple[TestClient, LicenseGuard, bytes],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client, _, _ = license_client
    _no_rate_limit(monkeypatch)
    res = client.post("/api/v1/license/activate", json={"full_key": "не-ключ"})
    assert res.status_code == 400
    assert "формат" in res.json()["message"]


def test_redeem_requires_key_first(
    license_client: tuple[TestClient, LicenseGuard, bytes],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client, _, private = license_client
    _no_rate_limit(monkeypatch)
    from selakcrm.licensing.activation_code import issue_activation_code

    code = issue_activation_code("SAK-AAAA", "hw_x", private)
    res = client.post("/api/v1/license/redeem", json={"code": code})
    assert res.status_code == 409


def test_redeem_rejects_code_for_another_machine(
    license_client: tuple[TestClient, LicenseGuard, bytes],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from selakcrm.licensing.activation_code import issue_activation_code
    from selakcrm.licensing.keys import parse_full_key

    client, _, private = license_client
    _no_rate_limit(monkeypatch)
    full_key = "SAK-AAAA-secretvaluesecre1"
    client.post("/api/v1/license/activate", json={"full_key": full_key})
    foreign = issue_activation_code(parse_full_key(full_key).key_id, "hw_someone_else", private)
    res = client.post("/api/v1/license/redeem", json={"code": foreign})
    assert res.status_code == 400
    assert "компьютера" in res.json()["message"]
