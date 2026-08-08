from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

from selakcrm.time_utils import utcnow


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "User"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    login: Mapped[str] = mapped_column(String, unique=True)
    passwordHash: Mapped[str] = mapped_column("passwordHash", String)
    role: Mapped[str] = mapped_column(String)  # SUPER_ADMIN, SUPER_MANAGER, MANAGER
    theme: Mapped[str] = mapped_column(String, default="light")
    isActive: Mapped[bool] = mapped_column("isActive", Boolean, default=True)
    createdAt: Mapped[datetime] = mapped_column("createdAt", DateTime, default=utcnow)
    updatedAt: Mapped[datetime] = mapped_column(
        "updatedAt", DateTime, default=utcnow, onupdate=utcnow
    )
    deletedAt: Mapped[datetime | None] = mapped_column("deletedAt", DateTime, nullable=True)

    auditEvents: Mapped[list[AuditEvent]] = relationship(back_populates="user")
    homeNotifications: Mapped[list[HomeNotification]] = relationship(back_populates="user")


class InsuranceCompany(Base):
    __tablename__ = "InsuranceCompany"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String)
    createdAt: Mapped[datetime] = mapped_column("createdAt", DateTime, default=utcnow)
    updatedAt: Mapped[datetime] = mapped_column(
        "updatedAt", DateTime, default=utcnow, onupdate=utcnow
    )
    deletedAt: Mapped[datetime | None] = mapped_column("deletedAt", DateTime, nullable=True)

    products: Mapped[list[InsuranceProduct]] = relationship(back_populates="company")
    policies: Mapped[list[Policy]] = relationship(back_populates="company")


class InsuranceProduct(Base):
    __tablename__ = "InsuranceProduct"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    companyId: Mapped[str] = mapped_column("companyId", String, ForeignKey("InsuranceCompany.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String)
    category: Mapped[str | None] = mapped_column(String, nullable=True)
    defaultPremiumPct: Mapped[str | None] = mapped_column("defaultPremiumPct", String, nullable=True)
    defaultPremiumRubles: Mapped[str | None] = mapped_column("defaultPremiumRubles", String, nullable=True)
    createdAt: Mapped[datetime] = mapped_column("createdAt", DateTime, default=utcnow)
    updatedAt: Mapped[datetime] = mapped_column(
        "updatedAt", DateTime, default=utcnow, onupdate=utcnow
    )
    deletedAt: Mapped[datetime | None] = mapped_column("deletedAt", DateTime, nullable=True)

    company: Mapped[InsuranceCompany] = relationship(back_populates="products")
    policies: Mapped[list[Policy]] = relationship(back_populates="product")

    __table_args__ = (Index("InsuranceProduct_companyId_idx", "companyId"),)


class Client(Base):
    __tablename__ = "Client"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    lastName: Mapped[str] = mapped_column("lastName", String)
    firstName: Mapped[str] = mapped_column("firstName", String)
    middleName: Mapped[str | None] = mapped_column("middleName", String, nullable=True)
    phone: Mapped[str] = mapped_column(String)
    phoneNormalized: Mapped[str] = mapped_column("phoneNormalized", String)
    email: Mapped[str | None] = mapped_column(String, nullable=True)
    documentsUrl: Mapped[str | None] = mapped_column("documentsUrl", String, nullable=True)
    createdAt: Mapped[datetime] = mapped_column("createdAt", DateTime, default=utcnow)
    updatedAt: Mapped[datetime] = mapped_column(
        "updatedAt", DateTime, default=utcnow, onupdate=utcnow
    )
    deletedAt: Mapped[datetime | None] = mapped_column("deletedAt", DateTime, nullable=True)

    policies: Mapped[list[Policy]] = relationship(back_populates="client")
    additionalPhones: Mapped[list[ClientPhone]] = relationship(back_populates="client")

    __table_args__ = (Index("Client_phoneNormalized_idx", "phoneNormalized"),)


class ClientPhone(Base):
    __tablename__ = "ClientPhone"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    clientId: Mapped[str] = mapped_column("clientId", String, ForeignKey("Client.id", ondelete="CASCADE"))
    phone: Mapped[str] = mapped_column(String)
    phoneNormalized: Mapped[str] = mapped_column("phoneNormalized", String)
    sortOrder: Mapped[int] = mapped_column("sortOrder", Integer, default=0)

    client: Mapped[Client] = relationship(back_populates="additionalPhones")

    __table_args__ = (
        Index("ClientPhone_clientId_idx", "clientId"),
        Index("ClientPhone_phoneNormalized_idx", "phoneNormalized"),
    )


class Policy(Base):
    __tablename__ = "Policy"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    clientId: Mapped[str] = mapped_column("clientId", String, ForeignKey("Client.id"))
    companyId: Mapped[str] = mapped_column("companyId", String, ForeignKey("InsuranceCompany.id"))
    productId: Mapped[str] = mapped_column("productId", String, ForeignKey("InsuranceProduct.id"))
    number: Mapped[str] = mapped_column(String)
    insuredObject: Mapped[str | None] = mapped_column("insuredObject", String, nullable=True)
    category: Mapped[str | None] = mapped_column(String, nullable=True)
    source: Mapped[str] = mapped_column(String, default="OFFICE")
    insuranceSumS: Mapped[str | None] = mapped_column("insuranceSumS", String, nullable=True)
    premiumPercent: Mapped[str | None] = mapped_column("premiumPercent", String, nullable=True)
    premiumRubles: Mapped[str] = mapped_column("premiumRubles", String, default="0")
    agentIncomeD: Mapped[str] = mapped_column("agentIncomeD", String)
    issueDate: Mapped[datetime | None] = mapped_column("issueDate", DateTime, nullable=True)
    startDate: Mapped[datetime] = mapped_column("startDate", DateTime)
    endDate: Mapped[datetime] = mapped_column("endDate", DateTime)
    termDays: Mapped[int] = mapped_column("termDays", Integer, default=365)
    createdAt: Mapped[datetime] = mapped_column("createdAt", DateTime, default=utcnow)
    updatedAt: Mapped[datetime] = mapped_column(
        "updatedAt", DateTime, default=utcnow, onupdate=utcnow
    )
    deletedAt: Mapped[datetime | None] = mapped_column("deletedAt", DateTime, nullable=True)
    createdByUserId: Mapped[str | None] = mapped_column(
        "createdByUserId", String, ForeignKey("User.id"), nullable=True
    )

    client: Mapped[Client] = relationship(back_populates="policies")
    company: Mapped[InsuranceCompany] = relationship(back_populates="policies")
    product: Mapped[InsuranceProduct] = relationship(back_populates="policies")
    createdBy: Mapped[User | None] = relationship(foreign_keys=[createdByUserId])
    renewalTasks: Mapped[list[RenewalTask]] = relationship(
        back_populates="policy",
        foreign_keys="RenewalTask.policyId",
    )

    __table_args__ = (
        UniqueConstraint("companyId", "number", name="Policy_companyId_number_key"),
        Index("Policy_clientId_idx", "clientId"),
        Index("Policy_endDate_idx", "endDate"),
        Index("Policy_createdByUserId_idx", "createdByUserId"),
    )


class RenewalTask(Base):
    __tablename__ = "RenewalTask"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    taskNumber: Mapped[int] = mapped_column("taskNumber", Integer, unique=True)
    policyId: Mapped[str] = mapped_column("policyId", String, ForeignKey("Policy.id", ondelete="CASCADE"))
    status: Mapped[str] = mapped_column(String, default="IN_PROGRESS")
    statusChangedAt: Mapped[datetime] = mapped_column("statusChangedAt", DateTime, default=utcnow)
    snoozedUntil: Mapped[datetime | None] = mapped_column("snoozedUntil", DateTime, nullable=True)
    declineReason: Mapped[str | None] = mapped_column("declineReason", String, nullable=True)
    feedbackComment: Mapped[str | None] = mapped_column("feedbackComment", String, nullable=True)
    postponeComment: Mapped[str | None] = mapped_column("postponeComment", String, nullable=True)
    renewedPolicyId: Mapped[str | None] = mapped_column(
        "renewedPolicyId", String, ForeignKey("Policy.id"), nullable=True
    )
    createdAt: Mapped[datetime] = mapped_column("createdAt", DateTime, default=utcnow)
    updatedAt: Mapped[datetime] = mapped_column(
        "updatedAt", DateTime, default=utcnow, onupdate=utcnow
    )

    policy: Mapped[Policy] = relationship(
        back_populates="renewalTasks",
        foreign_keys=[policyId],
    )
    renewedPolicy: Mapped[Policy | None] = relationship(
        foreign_keys=[renewedPolicyId],
    )
    comments: Mapped[list[RenewalTaskComment]] = relationship(
        back_populates="task",
        cascade="all, delete-orphan",
        order_by="RenewalTaskComment.createdAt",
    )

    __table_args__ = (
        Index("RenewalTask_policyId_status_idx", "policyId", "status"),
        Index("RenewalTask_snoozedUntil_idx", "snoozedUntil"),
    )


class RenewalTaskComment(Base):
    __tablename__ = "RenewalTaskComment"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    taskId: Mapped[str] = mapped_column("taskId", String, ForeignKey("RenewalTask.id", ondelete="CASCADE"))
    kind: Mapped[str] = mapped_column(String)
    text: Mapped[str] = mapped_column(String)
    createdAt: Mapped[datetime] = mapped_column("createdAt", DateTime, default=utcnow)

    task: Mapped[RenewalTask] = relationship(back_populates="comments")

    __table_args__ = (Index("RenewalTaskComment_taskId_createdAt_idx", "taskId", "createdAt"),)


class AuditEvent(Base):
    __tablename__ = "AuditEvent"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    userId: Mapped[str | None] = mapped_column("userId", String, ForeignKey("User.id"), nullable=True)
    action: Mapped[str] = mapped_column(String)
    entityType: Mapped[str] = mapped_column("entityType", String)
    entityId: Mapped[str | None] = mapped_column("entityId", String, nullable=True)
    payload: Mapped[dict[str, Any] | list[Any] | None] = mapped_column(JSON, nullable=True)
    createdAt: Mapped[datetime] = mapped_column("createdAt", DateTime, default=utcnow)

    user: Mapped[User | None] = relationship(back_populates="auditEvents")

    __table_args__ = (
        Index("AuditEvent_createdAt_idx", "createdAt"),
        Index("AuditEvent_userId_idx", "userId"),
    )


class HomeNotification(Base):
    __tablename__ = "HomeNotification"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    userId: Mapped[str] = mapped_column("userId", String, ForeignKey("User.id", ondelete="CASCADE"))
    type: Mapped[str] = mapped_column(String)
    dedupeKey: Mapped[str] = mapped_column("dedupeKey", String)
    message: Mapped[str] = mapped_column(String)
    readAt: Mapped[datetime | None] = mapped_column("readAt", DateTime, nullable=True)
    createdAt: Mapped[datetime] = mapped_column("createdAt", DateTime, default=utcnow)

    user: Mapped[User] = relationship(back_populates="homeNotifications")

    __table_args__ = (
        UniqueConstraint("userId", "dedupeKey", name="HomeNotification_userId_dedupeKey_key"),
        Index("HomeNotification_userId_readAt_idx", "userId", "readAt"),
    )


class AppSetting(Base):
    __tablename__ = "AppSetting"

    key: Mapped[str] = mapped_column(String, primary_key=True)
    value: Mapped[str] = mapped_column(String)


class RolePermission(Base):
    """Матрица прав для настраиваемых ролей (SUPER_MANAGER, MANAGER). SUPER_ADMIN не хранится."""

    __tablename__ = "RolePermission"

    role: Mapped[str] = mapped_column(String, primary_key=True)
    permissions: Mapped[Any] = mapped_column(JSON, default=list)
    updatedAt: Mapped[datetime] = mapped_column("updatedAt", DateTime, default=utcnow, onupdate=utcnow)
