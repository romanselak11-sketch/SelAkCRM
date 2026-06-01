# SelakCRMNew

Новый стек: **Python (FastAPI) + SQLAlchemy + Alembic** и **React (Vite)** — функциональная замена [SelAkCRM](https://github.com/) (NestJS + Prisma + React) с сохранением контрактов REST `/api/v1`.

## Структура

| Каталог | Назначение |
|---------|------------|
| [backend](backend) | API, планировщик задач продления, аудит |
| [frontend](frontend) | SPA (копия UI SelAkCRM с настраиваемым `VITE_API_ORIGIN`) |
| [docs/DATA_MIGRATION.md](docs/DATA_MIGRATION.md) | Перенос SQLite |

## Быстрый старт

**Backend** (порт по умолчанию как в Nest — `3000`):

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env
alembic upgrade head
uvicorn selakcrm.main:app --reload --port 3000
```

**Frontend**:

```bash
cd frontend
npm install
npm run dev
```

Откройте `http://localhost:5173`, пройдите `/setup` и войдите.

## CI

В репозитории настроен GitHub Actions: backend (`ruff`, `pytest`) и frontend (`lint`, `test`, `build`).
Артефакты сборки (`backend/build`, `backend/dist`, `frontend/dist`) не коммитятся в репозиторий.
