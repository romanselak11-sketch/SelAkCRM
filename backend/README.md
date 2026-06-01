# SelakCRM API (Python)

FastAPI + SQLAlchemy + SQLite. Контракты совместимы с прежним NestJS API (`/api/v1`).

Поведение как в SelAkCRM `docs/api-service-guide.md`: ошибки валидации тела — **400** с `message` (массив строк), лишние поля запрещены; `POST /auth/login` — лимит **10 неудачных попыток / 15 мин / IP** (429); `POST /auth/logout` — заглушка под контракт (клиент удаляет токен).

## Запуск

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env
# При старте uvicorn также вызывается alembic upgrade head (см. selakcrm/main.py)
alembic upgrade head
uvicorn selakcrm.main:app --reload --port 3000
```

## Тесты

```bash
pytest
```

## Конфигурация

- Вне локальной разработки обязательно задайте `JWT_SECRET` длинной случайной строкой.
- Для CORS используйте `WEB_ORIGIN` со списком доверенных origin через запятую.
- OpenAPI доступен на `http://localhost:3000/docs`.
