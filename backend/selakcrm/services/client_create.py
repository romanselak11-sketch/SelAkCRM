from sqlalchemy.orm import Session, joinedload

from fastapi import HTTPException

from selakcrm.domain.phone import assert_valid_phone, normalize_phone_ru
from selakcrm.ids import new_cuid
from selakcrm.models import Client, ClientPhone
from selakcrm.services.audit_log import audit_log
from selakcrm.domain.url_mask import mask_url_for_audit
from selakcrm.time_utils import utcnow


def create_client_record(
    db: Session,
    *,
    user_id: str,
    last_name: str,
    first_name: str,
    phone: str,
    middle_name: str | None = None,
    additional_phones: list[str] | None = None,
    email: str | None = None,
    documents_url: str | None = None,
) -> Client:
    try:
        assert_valid_phone(phone)
    except ValueError as e:
        raise HTTPException(400, detail={"statusCode": 400, "message": str(e), "error": "Bad Request"})
    extras = [str(s).strip() for s in (additional_phones or []) if str(s).strip()]
    for ph in extras:
        try:
            assert_valid_phone(ph)
        except ValueError as e:
            raise HTTPException(400, detail={"statusCode": 400, "message": str(e), "error": "Bad Request"})
    now = utcnow()
    pn = normalize_phone_ru(phone)
    c = Client(
        id=new_cuid(),
        lastName=last_name,
        firstName=first_name,
        middleName=middle_name,
        phone=phone,
        phoneNormalized=pn,
        email=email,
        documentsUrl=documents_url,
        createdAt=now,
        updatedAt=now,
    )
    db.add(c)
    db.flush()
    for i, ph in enumerate(extras):
        db.add(
            ClientPhone(
                id=new_cuid(),
                clientId=c.id,
                phone=ph,
                phoneNormalized=normalize_phone_ru(ph),
                sortOrder=i,
            )
        )
    db.flush()
    c = db.query(Client).options(joinedload(Client.additionalPhones)).filter(Client.id == c.id).one()
    audit_log(
        db,
        user_id=user_id,
        action="CLIENT_CREATE",
        entity_type="Client",
        entity_id=c.id,
        payload={
            "lastName": c.lastName,
            "firstName": c.firstName,
            "documentsUrl": mask_url_for_audit(c.documentsUrl),
        },
    )
    return c
