"""Тела запросов: запрет неизвестных полей (как Nest ValidationPipe forbidNonWhitelisted)."""

from pydantic import BaseModel, ConfigDict


class StrictBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
