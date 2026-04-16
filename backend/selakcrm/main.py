import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path

from alembic import command
from alembic.config import Config
from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.staticfiles import StaticFiles

from selakcrm.config import settings
from selakcrm.database import SessionLocal
from selakcrm.validation_http import nest_validation_messages
from selakcrm.routes.analytics_audit_routes import run_audit_purge_job
from selakcrm.routes.bundle import build_api_router
from selakcrm.services.renewal_sync import RenewalSyncService

scheduler = BackgroundScheduler()


def _run_hourly_renewal() -> None:
    db = SessionLocal()
    try:
        RenewalSyncService(db).sync()
        db.commit()
    except Exception:
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


def create_app() -> FastAPI:
    app = FastAPI(title="SelAkCRM API", lifespan=lifespan)
    origins = [o.strip() for o in settings.web_origin.split(",") if o.strip()]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins or ["http://localhost:5173"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.exception_handler(StarletteHTTPException)
    async def http_exc_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
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

    @app.exception_handler(RequestValidationError)
    async def validation_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
        # NestJS class-validator → 400 Bad Request, message — массив строк
        return JSONResponse(
            status_code=400,
            content={
                "statusCode": 400,
                "message": nest_validation_messages(exc.errors()),
                "error": "Bad Request",
            },
        )

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
