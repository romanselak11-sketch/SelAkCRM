"""Тесты генерации демо-полисов (окно дат, объём, валидность комбинаций премий)."""

from datetime import datetime, timedelta

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from selakcrm.dev_seed.demo_policies_90d import seed_demo_policies_90d
from selakcrm.domain.policy_dates import start_of_day
from selakcrm.models import Base, Policy
from selakcrm.domain.policy_income import assert_valid_policy_combination


def test_seed_policies_respects_90_day_window_and_count() -> None:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    Session = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = Session()
    now = datetime(2026, 4, 16, 18, 30, 0)
    floor = start_of_day(now) - timedelta(days=89)

    try:
        s = seed_demo_policies_90d(db, days=90, count=25, seed=1, now=now, clients_pool=15)
        assert s.policies_created == 25
        db.commit()
    finally:
        db.close()

    db = Session()
    try:
        policies = db.query(Policy).all()
        assert len(policies) == 25
        for p in policies:
            assert floor <= start_of_day(p.createdAt) <= start_of_day(now)
            assert p.createdAt <= now
            assert p.updatedAt >= p.createdAt
            assert p.updatedAt <= now
            assert p.endDate >= p.startDate
            assert_valid_policy_combination(p.insuranceSumS, p.premiumPercent, p.premiumRubles)
    finally:
        db.close()
