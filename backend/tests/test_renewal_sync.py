"""Задачи продления: синхронизация с полисами в окне 30 дней."""

from datetime import datetime, timedelta
import time

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from selakcrm.models import Base, Client, InsuranceCompany, InsuranceProduct, Policy, RenewalTask, User
from selakcrm.domain.policy_dates import start_of_day
from selakcrm.ids import new_cuid
from selakcrm.services.renewal_sync import RenewalSyncService
from selakcrm.time_utils import utcnow


def _session_factory():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return sessionmaker(autocommit=False, autoflush=False, bind=engine)


def _seed_policy_in_renewal_window(db, *, days_until_end: int = 15) -> Policy:
    now = utcnow()
    cid, comp_id, prod_id, pid = new_cuid(), new_cuid(), new_cuid(), new_cuid()
    db.add(
        InsuranceCompany(
            id=comp_id,
            name="ACME",
            createdAt=now,
            updatedAt=now,
        )
    )
    db.add(
        InsuranceProduct(
            id=prod_id,
            companyId=comp_id,
            name="ОСАГО",
            createdAt=now,
            updatedAt=now,
        )
    )
    db.add(
        Client(
            id=cid,
            lastName="Иванов",
            firstName="Иван",
            phone="+79990000000",
            phoneNormalized="79990000000",
            createdAt=now,
            updatedAt=now,
        )
    )
    end = start_of_day(now) + timedelta(days=days_until_end)
    start = start_of_day(now) - timedelta(days=300)
    db.add(
        Policy(
            id=pid,
            clientId=cid,
            companyId=comp_id,
            productId=prod_id,
            number="P-100",
            source="OFFICE",
            premiumRubles="0",
            agentIncomeD="0",
            startDate=start,
            endDate=end,
            termDays=365,
            createdAt=now,
            updatedAt=now,
        )
    )
    db.commit()
    return db.get(Policy, pid)


def test_sync_creates_single_renewal_task():
    SessionLocal = _session_factory()
    db = SessionLocal()
    try:
        _seed_policy_in_renewal_window(db)
        RenewalSyncService(db).sync()
        db.commit()
        tasks = db.query(RenewalTask).all()
        assert len(tasks) == 1
        assert tasks[0].status == "IN_PROGRESS"
        RenewalSyncService(db).sync()
        db.commit()
        assert db.query(RenewalTask).count() == 1
    finally:
        db.close()


def test_sync_idempotent_after_terminal_task():
    SessionLocal = _session_factory()
    db = SessionLocal()
    try:
        p = _seed_policy_in_renewal_window(db)
        RenewalSyncService(db).sync()
        db.commit()
        t = db.query(RenewalTask).one()
        t.status = "RENEWED"
        db.commit()
        RenewalSyncService(db).sync()
        db.commit()
        assert db.query(RenewalTask).filter(RenewalTask.policyId == p.id).count() == 1
    finally:
        db.close()


def test_wake_snoozed_then_visible_status():
    SessionLocal = _session_factory()
    db = SessionLocal()
    try:
        _seed_policy_in_renewal_window(db)
        uid = new_cuid()
        db.add(
            User(
                id=uid,
                login="u1",
                passwordHash="x",
                role="SUPER_ADMIN",
                theme="light",
                isActive=True,
                createdAt=utcnow(),
                updatedAt=utcnow(),
            )
        )
        db.commit()
        RenewalSyncService(db).sync()
        db.commit()
        t = db.query(RenewalTask).one()
        t.status = "POSTPONED"
        t.snoozedUntil = utcnow() - timedelta(minutes=1)
        db.commit()
        RenewalSyncService(db).sync()
        db.commit()
        db.refresh(t)
        assert t.status == "AWAITING_ACTION"
        assert t.snoozedUntil is None
    finally:
        db.close()


def test_sync_cached_throttles_full_sync(monkeypatch):
    SessionLocal = _session_factory()
    db = SessionLocal()
    try:
        _seed_policy_in_renewal_window(db)
        RenewalSyncService.invalidate_sync_cache()
        service = RenewalSyncService(db)
        points = iter([100.0, 100.0, 105.0, 130.0, 130.0, 131.0])
        monkeypatch.setattr(time, "monotonic", lambda: next(points))
        assert service.sync_cached(ttl_seconds=20) is True
        db.commit()
        assert db.query(RenewalTask).count() == 1
        assert service.sync_cached(ttl_seconds=20) is False
        db.commit()
        assert db.query(RenewalTask).count() == 1
        assert service.sync_cached(ttl_seconds=20) is True
        db.commit()
        assert db.query(RenewalTask).count() == 1
    finally:
        db.close()
