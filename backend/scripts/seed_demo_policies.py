#!/usr/bin/env python3
"""
CLI: заполнение БД демо-полисами за N дней назад от текущего момента (UTC).

Запуск из каталога backend (или из корня репозитория с PYTHONPATH=backend):

  cd backend && python scripts/seed_demo_policies.py
  cd backend && python scripts/seed_demo_policies.py --count 300 --days 90 --seed 7
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from selakcrm.database import SessionLocal  # noqa: E402
from selakcrm.dev_seed.demo_policies_90d import seed_demo_policies_90d  # noqa: E402


def main() -> int:
    p = argparse.ArgumentParser(description="Демо-полисы с распределением дат за последние дни.")
    p.add_argument("--days", type=int, default=90, help="Глубина окна в календарных днях (включая сегодня).")
    p.add_argument(
        "--count",
        type=int,
        default=275,
        help="Сколько полисов создать (по умолчанию ~ середина диапазона 250–300).",
    )
    p.add_argument("--seed", type=int, default=42, help="Seed RNG для воспроизводимости.")
    p.add_argument("--clients", type=int, default=110, metavar="N", help="Размер пула клиентов.")
    p.add_argument(
        "--dry-run",
        action="store_true",
        help="Только показать параметры, без записи в БД.",
    )
    args = p.parse_args()

    if args.dry_run:
        print(
            f"dry-run: days={args.days} count={args.count} seed={args.seed} clients={args.clients}",
            file=sys.stderr,
        )
        return 0

    db = SessionLocal()
    try:
        summary = seed_demo_policies_90d(
            db,
            days=args.days,
            count=args.count,
            seed=args.seed,
            clients_pool=args.clients,
        )
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

    print(
        "Готово:",
        f"полисов +{summary.policies_created},",
        f"клиентов +{summary.clients_created},",
        f"СК +{summary.companies_created},",
        f"продуктов +{summary.products_created},",
        f"окно {summary.days_window} дн.,",
        f"источник справочника: {summary.reference}.",
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
