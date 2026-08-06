from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import Field
from sqlalchemy.orm import Session, joinedload

from selakcrm.database import get_db
from selakcrm.schemas_base import StrictBody
from selakcrm.deps import JwtUser, get_current_user
from selakcrm.domain.search import company_search_where_clause, parse_search_tokens
from selakcrm.ids import new_cuid
from selakcrm.models import InsuranceCompany, InsuranceProduct
from selakcrm.serializers import company_row, product_row
from selakcrm.services.audit_log import audit_log
from selakcrm.time_utils import utcnow

router = APIRouter(tags=["insurance"])


def _require_insurance_admin(user: JwtUser) -> None:
    if user.role not in ("SUPER_ADMIN", "SUPER_MANAGER"):
        raise HTTPException(403, detail={"statusCode": 403, "message": "Forbidden", "error": "Forbidden"})


def _require_insurance_read(user: JwtUser) -> None:
    if user.role not in ("SUPER_ADMIN", "SUPER_MANAGER", "MANAGER"):
        raise HTTPException(403, detail={"statusCode": 403, "message": "Forbidden", "error": "Forbidden"})


ALLOWED_LIMITS = {10, 25, 50}


def _page_limit(page_raw: str | None, limit_raw: str | None) -> tuple[int, int]:
    try:
        lim = int(limit_raw or "10")
    except ValueError:
        lim = 10
    if lim not in ALLOWED_LIMITS:
        lim = 10
    try:
        page = int(page_raw or "1")
    except ValueError:
        page = 1
    if page < 1:
        page = 1
    return page, lim


@router.get("/insurance-companies")
def list_companies(
    user: Annotated[JwtUser, Depends(get_current_user)],
    db: Session = Depends(get_db),
    page: str | None = None,
    limit: str | None = None,
    q: str | None = None,
) -> dict:
    _require_insurance_read(user)
    p, lim = _page_limit(page, limit)
    skip = (p - 1) * lim
    tokens = parse_search_tokens(q)
    if not tokens:
        total = db.query(InsuranceCompany).filter(InsuranceCompany.deletedAt.is_(None)).count()
        items = (
            db.query(InsuranceCompany)
            .options(joinedload(InsuranceCompany.products))
            .filter(InsuranceCompany.deletedAt.is_(None))
            .order_by(InsuranceCompany.name)
            .offset(skip)
            .limit(lim)
            .all()
        )
        return {"items": [company_row(ic) for ic in items], "total": total, "page": p, "limit": lim}
    cond_sql, params = company_search_where_clause(tokens)
    from sqlalchemy import text

    count_sql = text(f'SELECT COUNT(*) AS n FROM "InsuranceCompany" ic WHERE ic."deletedAt" IS NULL AND ({cond_sql})')
    ids_sql = text(
        f'SELECT ic.id FROM "InsuranceCompany" ic WHERE ic."deletedAt" IS NULL AND ({cond_sql}) '
        f'ORDER BY ic.name ASC LIMIT :lim OFFSET :skip'
    )
    total = int(db.execute(count_sql, params).scalar() or 0)
    rows = db.execute(ids_sql, {**params, "lim": lim, "skip": skip}).fetchall()
    ids = [r[0] for r in rows]
    if not ids:
        return {"items": [], "total": total, "page": p, "limit": lim}
    items_unordered = (
        db.query(InsuranceCompany).options(joinedload(InsuranceCompany.products)).filter(InsuranceCompany.id.in_(ids)).all()
    )
    rank = {id_: i for i, id_ in enumerate(ids)}
    items = sorted(items_unordered, key=lambda x: rank[x.id])
    return {"items": [company_row(ic) for ic in items], "total": total, "page": p, "limit": lim}


class CompanyIn(StrictBody):
    name: str = Field(min_length=1)


@router.post("/insurance-companies")
def create_company(
    body: CompanyIn,
    user: Annotated[JwtUser, Depends(get_current_user)],
    db: Session = Depends(get_db),
) -> dict:
    _require_insurance_admin(user)
    now = utcnow()
    c = InsuranceCompany(id=new_cuid(), name=body.name, createdAt=now, updatedAt=now)
    db.add(c)
    db.flush()
    audit_log(db, user_id=user.sub, action="COMPANY_CREATE", entity_type="InsuranceCompany", entity_id=c.id, payload={"name": c.name})
    c = (
        db.query(InsuranceCompany)
        .options(joinedload(InsuranceCompany.products))
        .filter(InsuranceCompany.id == c.id)
        .one()
    )
    return company_row(c, True)


@router.patch("/insurance-companies/{company_id}")
def update_company(
    company_id: str,
    body: CompanyIn,
    user: Annotated[JwtUser, Depends(get_current_user)],
    db: Session = Depends(get_db),
) -> dict:
    _require_insurance_admin(user)
    c = db.get(InsuranceCompany, company_id)
    if not c:
        raise HTTPException(404, detail={"statusCode": 404, "message": "Not Found", "error": "Not Found"})
    c.name = body.name
    audit_log(db, user_id=user.sub, action="COMPANY_UPDATE", entity_type="InsuranceCompany", entity_id=company_id, payload={"name": body.name})
    c = (
        db.query(InsuranceCompany)
        .options(joinedload(InsuranceCompany.products))
        .filter(InsuranceCompany.id == c.id)
        .one()
    )
    return company_row(c, True)


@router.post("/insurance-companies/{company_id}/archive")
def archive_company(
    company_id: str,
    user: Annotated[JwtUser, Depends(get_current_user)],
    db: Session = Depends(get_db),
) -> dict:
    _require_insurance_admin(user)
    c = db.get(InsuranceCompany, company_id)
    if not c:
        raise HTTPException(404, detail={"statusCode": 404, "message": "Not Found", "error": "Not Found"})
    c.deletedAt = utcnow()
    audit_log(db, user_id=user.sub, action="COMPANY_ARCHIVE", entity_type="InsuranceCompany", entity_id=company_id, payload={})
    return {"ok": True}


@router.post("/insurance-companies/{company_id}/restore")
def restore_company(
    company_id: str,
    user: Annotated[JwtUser, Depends(get_current_user)],
    db: Session = Depends(get_db),
) -> dict:
    _require_insurance_admin(user)
    c = db.get(InsuranceCompany, company_id)
    if not c:
        raise HTTPException(404, detail={"statusCode": 404, "message": "Not Found", "error": "Not Found"})
    c.deletedAt = None
    audit_log(db, user_id=user.sub, action="COMPANY_RESTORE", entity_type="InsuranceCompany", entity_id=company_id, payload={})
    return {"ok": True}


@router.get("/insurance-companies/{company_id}/products")
def list_products(
    company_id: str,
    user: Annotated[JwtUser, Depends(get_current_user)],
    db: Session = Depends(get_db),
) -> list[dict]:
    _require_insurance_read(user)
    items = (
        db.query(InsuranceProduct)
        .filter(InsuranceProduct.companyId == company_id, InsuranceProduct.deletedAt.is_(None))
        .order_by(InsuranceProduct.name)
        .all()
    )
    return [product_row(p) for p in items]


class ProductIn(StrictBody):
    name: str = Field(min_length=1)
    category: str | None = None
    defaultPremiumPct: str | None = None
    defaultPremiumRubles: str | None = None


@router.post("/insurance-companies/{company_id}/products")
def create_product(
    company_id: str,
    body: ProductIn,
    user: Annotated[JwtUser, Depends(get_current_user)],
    db: Session = Depends(get_db),
) -> dict:
    _require_insurance_admin(user)
    now = utcnow()
    p = InsuranceProduct(
        id=new_cuid(),
        companyId=company_id,
        name=body.name,
        category=body.category,
        defaultPremiumPct=body.defaultPremiumPct,
        defaultPremiumRubles=body.defaultPremiumRubles,
        createdAt=now,
        updatedAt=now,
    )
    db.add(p)
    db.flush()
    audit_log(
        db,
        user_id=user.sub,
        action="PRODUCT_CREATE",
        entity_type="InsuranceProduct",
        entity_id=p.id,
        payload={"companyId": company_id, "name": p.name},
    )
    return product_row(p)


class UpdateProductIn(StrictBody):
    name: str | None = Field(default=None, min_length=1)
    category: str | None = None
    defaultPremiumPct: str | None = None
    defaultPremiumRubles: str | None = None


@router.patch("/insurance-products/{product_id}")
def update_product(
    product_id: str,
    body: UpdateProductIn,
    user: Annotated[JwtUser, Depends(get_current_user)],
    db: Session = Depends(get_db),
) -> dict:
    _require_insurance_admin(user)
    p = db.get(InsuranceProduct, product_id)
    if not p:
        raise HTTPException(404, detail={"statusCode": 404, "message": "Not Found", "error": "Not Found"})
    fields: list[str] = []
    data = body.model_dump(exclude_unset=True)
    if "name" in data and data["name"] is not None:
        p.name = data["name"]
        fields.append("name")
    if "category" in data:
        p.category = data["category"]
        fields.append("category")
    if "defaultPremiumPct" in data:
        p.defaultPremiumPct = data["defaultPremiumPct"]
        fields.append("defaultPremiumPct")
    if "defaultPremiumRubles" in data:
        p.defaultPremiumRubles = data["defaultPremiumRubles"]
        fields.append("defaultPremiumRubles")
    audit_log(
        db,
        user_id=user.sub,
        action="PRODUCT_UPDATE",
        entity_type="InsuranceProduct",
        entity_id=product_id,
        payload={"fields": fields},
    )
    db.flush()
    return product_row(p)


@router.post("/insurance-products/{product_id}/archive")
def archive_product(
    product_id: str,
    user: Annotated[JwtUser, Depends(get_current_user)],
    db: Session = Depends(get_db),
) -> dict:
    _require_insurance_admin(user)
    p = db.get(InsuranceProduct, product_id)
    if not p:
        raise HTTPException(404, detail={"statusCode": 404, "message": "Not Found", "error": "Not Found"})
    p.deletedAt = utcnow()
    audit_log(db, user_id=user.sub, action="PRODUCT_ARCHIVE", entity_type="InsuranceProduct", entity_id=product_id, payload={})
    return {"ok": True}


@router.post("/insurance-products/{product_id}/restore")
def restore_product(
    product_id: str,
    user: Annotated[JwtUser, Depends(get_current_user)],
    db: Session = Depends(get_db),
) -> dict:
    _require_insurance_admin(user)
    p = db.get(InsuranceProduct, product_id)
    if not p:
        raise HTTPException(404, detail={"statusCode": 404, "message": "Not Found", "error": "Not Found"})
    p.deletedAt = None
    audit_log(db, user_id=user.sub, action="PRODUCT_RESTORE", entity_type="InsuranceProduct", entity_id=product_id, payload={})
    return {"ok": True}
