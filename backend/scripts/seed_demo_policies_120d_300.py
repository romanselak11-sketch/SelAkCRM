"""
Сидирование тестовых данных в существующую БД: 300 полисов за последние 120 дней.

Запуск:
  cd backend
  python scripts/seed_demo_policies_120d_300.py

По умолчанию используется DATABASE_URL из .env / переменных окружения (см. selakcrm.config).
"""

from __future__ import annotations

from pathlib import Path

from alembic import command
from alembic.config import Config

from selakcrm.database import SessionLocal
from selakcrm.dev_seed.demo_policies_90d import seed_demo_policies_90d


def _alembic_upgrade_head() -> None:
    backend_root = Path(__file__).resolve().parent.parent
    alembic_ini = backend_root / "alembic.ini"
    if not alembic_ini.is_file():
        raise RuntimeError(f"Не найден alembic.ini по пути: {alembic_ini}")
    alembic_cfg = Config(str(alembic_ini))
    command.upgrade(alembic_cfg, "head")


def main() -> None:
    # Важно: сидирование ожидает готовую схему. Применяем миграции как при старте приложения.
    _alembic_upgrade_head()

    db = SessionLocal()
    try:
        summary = seed_demo_policies_90d(db, days=120, count=300, seed=42, clients_pool=120)
        db.commit()
    finally:
        db.close()

    print(
        "OK:",
        f"policies={summary.policies_created}",
        f"clients+={summary.clients_created}",
        f"companies+={summary.companies_created}",
        f"products+={summary.products_created}",
        f"days={summary.days_window}",
    )


if __name__ == "__main__":
    main()

