from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from selakcrm.validation_http import nest_validation_messages


def register_http_exception_handlers(app: FastAPI) -> None:
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
        return JSONResponse(
            status_code=400,
            content={
                "statusCode": 400,
                "message": nest_validation_messages(exc.errors()),
                "error": "Bad Request",
            },
        )
