from __future__ import annotations

from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse


def nest_error(status_code: int, message: str) -> JSONResponse:
    err = "Bad Request"
    if status_code == 401:
        err = "Unauthorized"
    elif status_code == 403:
        err = "Forbidden"
    elif status_code == 404:
        err = "Not Found"
    elif status_code == 409:
        err = "Conflict"
    elif status_code == 422:
        err = "Unprocessable Entity"
    return JSONResponse(
        status_code=status_code,
        content={"statusCode": status_code, "message": message, "error": err},
    )


def http_exc(status_code: int, message: str) -> HTTPException:
    return HTTPException(
        status_code=status_code,
        detail={"statusCode": status_code, "message": message, "error": _error_name(status_code)},
    )


def _error_name(code: int) -> str:
    return {
        400: "Bad Request",
        401: "Unauthorized",
        403: "Forbidden",
        404: "Not Found",
        409: "Conflict",
        422: "Unprocessable Entity",
    }.get(code, "Error")


async def nest_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    if isinstance(exc, HTTPException):
        detail = exc.detail
        if isinstance(detail, dict) and "message" in detail:
            return JSONResponse(status_code=exc.status_code, content=detail)
        msg = str(detail) if detail else exc.__class__.__name__
        return nest_error(exc.status_code, msg)
    return nest_error(500, "Internal Server Error")
