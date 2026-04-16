"""
Генерация демо-полисов с распределением createdAt/updatedAt по календарным дням
за последние ``days`` дней включительно (от «сегодня» назад).

Не вызывает HTTP и не пишет AuditEvent — только строки в ORM-моделях.
"""

from __future__ import annotations

import random
from dataclasses import dataclass
from datetime import datetime, timedelta
from decimal import Decimal

from sqlalchemy import func
from sqlalchemy.orm import Session

from selakcrm.domain.phone import normalize_phone_ru
from selakcrm.domain.policy_dates import start_of_day
from selakcrm.domain.policy_income import compute_agent_income_d
from selakcrm.ids import new_cuid
from selakcrm.models import Client, InsuranceCompany, InsuranceProduct, Policy
from selakcrm.time_utils import utcnow


@dataclass(frozen=True)
class SeedSummary:
    policies_created: int
    clients_created: int
    companies_created: int
    products_created: int
    days_window: int
    reference: str


_FIRST_NAMES = (
    "Иван",
    "Мария",
    "Алексей",
    "Елена",
    "Дмитрий",
    "Ольга",
    "Сергей",
    "Анна",
    "Андрей",
    "Наталья",
    "Павел",
    "Татьяна",
    "Михаил",
    "Екатерина",
    "Николай",
)

_LAST_NAMES = (
    "Иванов",
    "Петрова",
    "Сидоров",
    "Козлова",
    "Смирнов",
    "Волкова",
    "Новиков",
    "Морозова",
    "Соколов",
    "Лебедева",
    "Попов",
    "Кузнецова",
    "Васильев",
    "Фёдорова",
    "Михайлов",
)


def _ensure_demo_insurance(db: Session, now: datetime) -> tuple[list[tuple[InsuranceCompany, list[InsuranceProduct]]], int, int]:
    """Возвращает список (компания, продукты), число созданных компаний и продуктов."""
    active = (
        db.query(InsuranceCompany)
        .filter(InsuranceCompany.deletedAt.is_(None))
        .order_by(InsuranceCompany.createdAt.asc())
        .all()
    )
    created_c, created_p = 0, 0
    if active:
        pairs: list[tuple[InsuranceCompany, list[InsuranceProduct]]] = []
        for c in active:
            prods = (
                db.query(InsuranceProduct)
                .filter(
                    InsuranceProduct.companyId == c.id,
                    InsuranceProduct.deletedAt.is_(None),
                )
                .all()
            )
            if prods:
                pairs.append((c, prods))
        if pairs:
            return pairs, created_c, created_p

    demo_specs = (
        ("Демо СК «Альфа»", ("ОСАГО", "КАСКО физлица")),
        ("Демо СК «Бета»", ("Ипотека", "НС от несчастного случая")),
    )
    pairs = []
    for cname, pnames in demo_specs:
        cid = new_cuid()
        comp = InsuranceCompany(id=cid, name=cname, createdAt=now, updatedAt=now)
        db.add(comp)
        db.flush()
        created_c += 1
        plist: list[InsuranceProduct] = []
        for pname in pnames:
            pid = new_cuid()
            pct = ("12.5", "15", "10", "7.5")[created_p % 4]
            pr = InsuranceProduct(
                id=pid,
                companyId=cid,
                name=pname,
                category=None,
                defaultPremiumPct=pct,
                createdAt=now,
                updatedAt=now,
            )
            db.add(pr)
            plist.append(pr)
            created_p += 1
        pairs.append((comp, plist))
    db.flush()
    return pairs, created_c, created_p


def _ensure_clients(db: Session, need: int, now: datetime, rng: random.Random) -> tuple[list[Client], int]:
    existing = (
        db.query(Client)
        .filter(Client.deletedAt.is_(None))
        .order_by(Client.createdAt.asc())
        .limit(max(need, 1))
        .all()
    )
    if len(existing) >= need:
        return existing[:need], 0

    n_all = int(db.query(func.count(Client.id)).scalar() or 0)
    created = 0
    idx = n_all
    while len(existing) < need:
        idx += 1
        # +7 и 10 цифр (мобильный диапазон для демо)
        tail = f"{idx % 10_000_000_000:010d}"
        phone = normalize_phone_ru(f"+79{tail}")
        fn = rng.choice(_FIRST_NAMES)
        ln = rng.choice(_LAST_NAMES)
        cid = new_cuid()
        c = Client(
            id=cid,
            lastName=ln,
            firstName=fn,
            middleName=None,
            phone=phone,
            phoneNormalized=normalize_phone_ru(phone),
            email=None,
            documentsUrl=None,
            createdAt=now,
            updatedAt=now,
        )
        db.add(c)
        existing.append(c)
        created += 1
    db.flush()
    return existing[:need], created


def seed_demo_policies_90d(
    db: Session,
    *,
    days: int = 90,
    count: int = 275,
    seed: int | None = 42,
    now: datetime | None = None,
    clients_pool: int = 110,
) -> SeedSummary:
    """
    Создаёт ``count`` полисов. У каждого ``createdAt`` и ``updatedAt`` попадают
    в интервал [start_of_day(now) - (days-1), now] (равномерный выбор дня + случайное время).

    ``clients_pool`` — сколько клиентов использовать (создаёт недостающих).
    """
    if days < 1:
        raise ValueError("days должен быть >= 1")
    if count < 1:
        raise ValueError("count должен быть >= 1")
    if clients_pool < 1:
        raise ValueError("clients_pool должен быть >= 1")

    rng = random.Random(seed)
    now_dt = now or utcnow()
    today0 = start_of_day(now_dt)

    pairs, cc, cp = _ensure_demo_insurance(db, now_dt)
    flat_products: list[tuple[InsuranceCompany, InsuranceProduct]] = []
    for comp, prods in pairs:
        for pr in prods:
            flat_products.append((comp, pr))
    if not flat_products:
        raise RuntimeError("Нет страховых продуктов для привязки полисов")

    clients, n_new_clients = _ensure_clients(db, clients_pool, now_dt, rng)

    policy_offset = int(db.query(func.count(Policy.id)).scalar() or 0)

    created_policies = 0
    for i in range(count):
        day_offset = rng.randint(0, days - 1)
        day0 = today0 - timedelta(days=day_offset)
        created_at = day0 + timedelta(seconds=rng.randint(0, 86399))
        if created_at > now_dt:
            created_at = now_dt - timedelta(seconds=rng.randint(0, 3600))

        comp, prod = rng.choice(flat_products)
        number = f"D90-{policy_offset + i + 1:010d}"

        client = rng.choice(clients)

        term_days = rng.choice((31, 90, 180, 365))
        delay_start = rng.randint(0, min(14, max(0, (now_dt - created_at).days)))
        start_date = start_of_day(created_at) + timedelta(days=delay_start)
        end_date = start_date + timedelta(days=term_days)

        combo = rng.choice(("s_pct", "s_pct", "s_pct", "s_rub", "rub_only"))
        if combo == "s_pct":
            ins_s = str(rng.randint(100_000, 6_000_000))
            pct = str(Decimal(rng.randint(5, 200) / 10).quantize(Decimal("0.1")))
            rub = "0"
        elif combo == "s_rub":
            ins_s = str(rng.randint(200_000, 5_000_000))
            pct = None
            rub = str(rng.randint(2_000, 120_000))
        else:
            ins_s = None
            pct = None
            rub = str(rng.randint(3_000, 80_000))

        agent_d = compute_agent_income_d(ins_s, pct, rub)
        agent_income = str(agent_d.quantize(Decimal("0.01")))

        upd_delta = timedelta(seconds=rng.randint(0, max(1, int((now_dt - created_at).total_seconds()) or 1)))
        updated_at = min(created_at + upd_delta, now_dt)

        src = rng.choice(("OFFICE", "OFFICE", "OFFICE", "CALL", "WEB"))

        p = Policy(
            id=new_cuid(),
            clientId=client.id,
            companyId=comp.id,
            productId=prod.id,
            number=number,
            category=rng.choice((None, None, "Авто", "Имущество", "Здоровье")),
            source=src,
            insuranceSumS=ins_s,
            premiumPercent=pct,
            premiumRubles=rub,
            agentIncomeD=agent_income,
            startDate=start_date,
            endDate=end_date,
            termDays=max(1, (end_date.date() - start_date.date()).days),
            createdAt=created_at,
            updatedAt=updated_at,
        )
        db.add(p)
        created_policies += 1

    db.flush()

    ref = "inserted_demo_reference" if (cc or cp) else "used_existing_reference"

    return SeedSummary(
        policies_created=created_policies,
        clients_created=n_new_clients,
        companies_created=cc,
        products_created=cp,
        days_window=days,
        reference=ref,
    )
