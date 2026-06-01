import os
import sys
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from alembic import command
from alembic.config import Config
from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from starlette.staticfiles import StaticFiles

from selakcrm.config import settings
from selakcrm.database import SessionLocal
from selakcrm.http_errors import register_http_exception_handlers
from selakcrm.routes.analytics_audit_routes import run_audit_purge_job
from selakcrm.routes.bundle import build_api_router
from selakcrm.services.renewal_sync import RenewalSyncService

scheduler = BackgroundScheduler()
log = logging.getLogger(__name__)
DEFAULT_DEV_JWT_SECRET = "change-me-in-production-use-long-random-secret-32+"


def _run_hourly_renewal() -> None:
    db = SessionLocal()
    try:
        RenewalSyncService(db).sync()
        db.commit()
    except Exception:
        log.exception("Hourly renewal sync job failed")
        db.rollback()
        raise
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
        backend_root = Path(sys._MEIPASS)
    else:
        backend_root = Path(__file__).resolve().parent.parent
    alembic_ini = backend_root / "alembic.ini"
    if alembic_ini.exists():
        alembic_cfg = Config(str(alembic_ini))
        command.upgrade(alembic_cfg, "head")
    # Сразу материализуем задачи продления (иначе до часового cron или смены полиса списки пустые).
    _run_hourly_renewal()
    scheduler.add_job(_run_hourly_renewal, "cron", minute=0)
    scheduler.add_job(run_audit_purge_job, "cron", hour=3, minute=0)
    scheduler.start()
    yield
    scheduler.shutdown(wait=False)


def _warn_if_default_jwt_secret() -> None:
    if getattr(sys, "frozen", False):
        return
    if settings.jwt_secret == DEFAULT_DEV_JWT_SECRET:
        log.warning(
            "JWT_SECRET uses development default value. Set a long random secret in production."
        )


def create_app() -> FastAPI:
    app = FastAPI(title="SelAkCRM API", lifespan=lifespan)
    _warn_if_default_jwt_secret()
    origins = [o.strip() for o in settings.web_origin.split(",") if o.strip()]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins or ["http://localhost:5173"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    register_http_exception_handlers(app)

    app.include_router(build_api_router())
    _mount_spa_static_if_configured(app)
    return app


def _mount_spa_static_if_configured(app: FastAPI) -> None:
    """Раздача собранного Vite (SELAKCRM_STATIC_DIR) и fallback на index.html для SPA."""
    raw = os.environ.get("SELAKCRM_STATIC_DIR", "").strip()
    if not raw:
        return
    static_dir = Path(raw)
    index = static_dir / "index.html"
    if not index.is_file():
        return
    assets = static_dir / "assets"
    if assets.is_dir():
        app.mount("/assets", StaticFiles(directory=str(assets)), name="spa_assets")

    @app.get("/{full_path:path}")
    def spa_fallback(full_path: str) -> FileResponse:
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not Found")
        try:
            candidate = (static_dir / full_path).resolve()
        except OSError:
            return FileResponse(index)
        root = static_dir.resolve()
        if not candidate.is_relative_to(root):
            return FileResponse(index)
        if candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(index)


app = create_app()
