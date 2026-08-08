from datetime import datetime
from typing import Annotated
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException
from pydantic import Field
from sqlalchemy import text
from sqlalchemy.orm import Session, joinedload

from selakcrm.database import get_db
from selakcrm.deps import JwtUser, assert_permission, get_current_user
from selakcrm.schemas_base import StrictBody
from selakcrm.domain.search import client_search_where_clause, parse_search_tokens
from selakcrm.domain.url_mask import mask_url_for_audit
from selakcrm.domain.phone import assert_valid_phone, normalize_phone_ru
from selakcrm.ids import new_cuid
from selakcrm.models import Client, ClientPhone, Policy
from selakcrm.serializers import client_row, policy_row
from selakcrm.services.audit_log import audit_log
from selakcrm.services.client_create import create_client_record
from selakcrm.time_utils import utcnow

router = APIRouter(prefix="/clients", tags=["clients"])

ALLOWED_LIMITS = {10, 25, 50}


def _page_limit(page_raw: str | None, limit_raw: str | None) -> tuple[int, int]:
    try:
        lim = int(limit_raw or "25")
    except ValueError:
        lim = 25
    if lim not in ALLOWED_LIMITS:
        lim = 25
    try:
        page = int(page_raw or "1")
    except ValueError:
        page = 1
    if page < 1:
        page = 1
    return page, lim


def _require_admin_manager_list(db: Session, user: JwtUser) -> None:
    assert_permission(db, user, "nav.clients")


def _require_admin_manager_write(db: Session, user: JwtUser) -> None:
    assert_permission(db, user, "clients.write")


def _require_client_policies(db: Session, user: JwtUser) -> None:
    assert_permission(db, user, "clients.view_policies")


def _validate_documents_url(url: str | None) -> None:
    if url is None or url == "":
        return
    if len(url) > 2048:
        raise HTTPException(422, detail={"statusCode": 422, "message": "Слишком длинный URL", "error": "Unprocessable Entity"})
    u = urlparse(url)
    if u.scheme not in ("http", "https"):
        raise HTTPException(422, detail={"statusCode": 422, "message": "Некорректный URL", "error": "Unprocessable Entity"})


@router.get("")
def list_clients(
    user: Annotated[JwtUser, Depends(get_current_user)],
    db: Session = Depends(get_db),
    page: str | None = None,
    limit: str | None = None,
    q: str | None = None,
) -> dict:
    _require_admin_manager_list(db, user)
    p, lim = _page_limit(page, limit)
    skip = (p - 1) * lim
    tokens = parse_search_tokens(q)
    if not tokens:
        total = db.query(Client).filter(Client.deletedAt.is_(None)).count()
        items = (
            db.query(Client)
            .options(joinedload(Client.additionalPhones))
            .filter(Client.deletedAt.is_(None))
            .order_by(Client.lastName, Client.firstName)
            .offset(skip)
            .limit(lim)
            .all()
        )
        return {"items": [client_row(c) for c in items], "total": total, "page": p, "limit": lim}
    cond_sql, params = client_search_where_clause(tokens)
    count_sql = text(f'SELECT COUNT(*) AS n FROM "Client" c WHERE c."deletedAt" IS NULL AND ({cond_sql})')
    ids_sql = text(
        f'SELECT c.id FROM "Client" c WHERE c."deletedAt" IS NULL AND ({cond_sql}) '
        'ORDER BY c."lastName" ASC, c."firstName" ASC LIMIT :lim OFFSET :skip'
    )
    total = int(db.execute(count_sql, params).scalar() or 0)
    rows = db.execute(ids_sql, {**params, "lim": lim, "skip": skip}).fetchall()
    ids = [r[0] for r in rows]
    if not ids:
        return {"items": [], "total": total, "page": p, "limit": lim}
    items_unordered = (
        db.query(Client).options(joinedload(Client.additionalPhones)).filter(Client.id.in_(ids)).all()
    )
    rank = {id_: i for i, id_ in enumerate(ids)}
    items = sorted(items_unordered, key=lambda x: rank[x.id])
    return {"items": [client_row(c) for c in items], "total": total, "page": p, "limit": lim}


@router.get("/{client_id}")
def get_client(
    client_id: str,
    user: Annotated[JwtUser, Depends(get_current_user)],
    db: Session = Depends(get_db),
) -> dict:
    _require_admin_manager_write(db, user)
    c = (
        db.query(Client)
        .options(joinedload(Client.additionalPhones))
        .filter(Client.id == client_id, Client.deletedAt.is_(None))
        .first()
    )
    if not c:
        raise HTTPException(404, detail={"statusCode": 404, "message": "Not Found", "error": "Not Found"})
    return client_row(c)


class CreateClientIn(StrictBody):
    lastName: str = Field(min_length=1)
    firstName: str = Field(min_length=1)
    middleName: str | None = None
    phone: str = Field(min_length=5, max_length=32)
    additionalPhones: list[str] | None = None
    email: str | None = None
    documentsUrl: str | None = Field(default=None, max_length=2048)


@router.post("")
def create_client(
    body: CreateClientIn,
    user: Annotated[JwtUser, Depends(get_current_user)],
    db: Session = Depends(get_db),
) -> dict:
    _require_admin_manager_write(db, user)
    _validate_documents_url(body.documentsUrl)
    c = create_client_record(
        db,
        user_id=user.sub,
        last_name=body.lastName,
        first_name=body.firstName,
        middle_name=body.middleName,
        phone=body.phone,
        additional_phones=body.additionalPhones,
        email=body.email,
        documents_url=body.documentsUrl,
    )
    return client_row(c)


class UpdateClientIn(StrictBody):
    lastName: str | None = Field(default=None, min_length=1)
    firstName: str | None = Field(default=None, min_length=1)
    middleName: str | None = None
    phone: str | None = Field(default=None, min_length=5, max_length=32)
    additionalPhones: list[str] | None = None
    email: str | None = None
    documentsUrl: str | None = Field(default=None, max_length=2048)


@router.patch("/{client_id}")
def update_client(
    client_id: str,
    body: UpdateClientIn,
    user: Annotated[JwtUser, Depends(get_current_user)],
    db: Session = Depends(get_db),
) -> dict:
    _require_admin_manager_write(db, user)
    c = (
        db.query(Client)
        .options(joinedload(Client.additionalPhones))
        .filter(Client.id == client_id, Client.deletedAt.is_(None))
        .first()
    )
    if not c:
        raise HTTPException(404, detail={"statusCode": 404, "message": "Not Found", "error": "Not Found"})
    _validate_documents_url(body.documentsUrl)
    data = body.model_dump(exclude_unset=True)
    if "phone" in data and data["phone"] is not None:
        try:
            assert_valid_phone(data["phone"])
        except ValueError as e:
            raise HTTPException(400, detail={"statusCode": 400, "message": str(e), "error": "Bad Request"})
        c.phone = data["phone"]
        c.phoneNormalized = normalize_phone_ru(data["phone"])
    if "lastName" in data and data["lastName"] is not None:
        c.lastName = data["lastName"]
    if "firstName" in data and data["firstName"] is not None:
        c.firstName = data["firstName"]
    if "middleName" in data:
        c.middleName = data["middleName"]
    if "email" in data:
        c.email = data["email"]
    if "documentsUrl" in data:
        c.documentsUrl = data["documentsUrl"]
    if "additionalPhones" in data and data["additionalPhones"] is not None:
        extras = [str(s).strip() for s in data["additionalPhones"] if str(s).strip()]
        for ph in extras:
            try:
                assert_valid_phone(ph)
            except ValueError as e:
                raise HTTPException(400, detail={"statusCode": 400, "message": str(e), "error": "Bad Request"})
        db.query(ClientPhone).filter(ClientPhone.clientId == client_id).delete(synchronize_session=False)
        for i, ph in enumerate(extras):
            db.add(
                ClientPhone(
                    id=new_cuid(),
                    clientId=client_id,
                    phone=ph,
                    phoneNormalized=normalize_phone_ru(ph),
                    sortOrder=i,
                )
            )
    db.flush()
    c = db.query(Client).options(joinedload(Client.additionalPhones)).filter(Client.id == client_id).one()
    audit_log(
        db,
        user_id=user.sub,
        action="CLIENT_UPDATE",
        entity_type="Client",
        entity_id=client_id,
        payload={"fields": list(data.keys()), "documentsUrl": mask_url_for_audit(c.documentsUrl)},
    )
    return client_row(c)


@router.post("/{client_id}/archive")
def archive_client(
    client_id: str,
    user: Annotated[JwtUser, Depends(get_current_user)],
    db: Session = Depends(get_db),
) -> dict:
    _require_admin_manager_write(db, user)
    c = db.query(Client).filter(Client.id == client_id, Client.deletedAt.is_(None)).first()
    if not c:
        raise HTTPException(404, detail={"statusCode": 404, "message": "Not Found", "error": "Not Found"})
    c.deletedAt = utcnow()
    audit_log(db, user_id=user.sub, action="CLIENT_ARCHIVE", entity_type="Client", entity_id=client_id, payload={})
    return {"ok": True}


@router.post("/{client_id}/restore")
def restore_client(
    client_id: str,
    user: Annotated[JwtUser, Depends(get_current_user)],
    db: Session = Depends(get_db),
) -> dict:
    _require_admin_manager_write(db, user)
    c = db.get(Client, client_id)
    if not c:
        raise HTTPException(404, detail={"statusCode": 404, "message": "Not Found", "error": "Not Found"})
    c.deletedAt = None
    audit_log(db, user_id=user.sub, action="CLIENT_RESTORE", entity_type="Client", entity_id=client_id, payload={})
    return {"ok": True}


@router.get("/{client_id}/policies")
def client_policies(
    client_id: str,
    user: Annotated[JwtUser, Depends(get_current_user)],
    db: Session = Depends(get_db),
    page: int = 1,
    pageSize: int = 25,
) -> dict:
    _require_client_policies(db, user)
    if page < 1:
        page = 1
    if pageSize not in ALLOWED_LIMITS:
        pageSize = 25
    c = db.query(Client).filter(Client.id == client_id, Client.deletedAt.is_(None)).first()
    if not c:
        raise HTTPException(404, detail={"statusCode": 404, "message": "Not Found", "error": "Not Found"})
    skip = (page - 1) * pageSize
    q = (
        db.query(Policy)
        .options(joinedload(Policy.company), joinedload(Policy.product))
        .filter(Policy.clientId == client_id, Policy.deletedAt.is_(None))
        .order_by(Policy.createdAt.desc())
    )
    total = q.count()
    items = q.offset(skip).limit(pageSize).all()
    out = []
    for pol in items:
        d = policy_row(pol)
        d["company"] = {"id": pol.company.id, "name": pol.company.name}
        d["product"] = {"id": pol.product.id, "name": pol.product.name}
        del d["clientId"]
        out.append(d)
    return {"items": out, "total": total, "page": page, "pageSize": pageSize}
