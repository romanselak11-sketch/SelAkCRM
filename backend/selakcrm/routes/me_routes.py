from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from selakcrm.database import get_db
from selakcrm.schemas_base import StrictBody
from selakcrm.deps import JwtUser, get_current_user
from selakcrm.models import User

router = APIRouter(prefix="/me", tags=["me"])


class ThemeIn(StrictBody):
    theme: str = Field(pattern="^(light|dark)$")


@router.patch("/theme")
def patch_theme(
    body: ThemeIn,
    user: Annotated[JwtUser, Depends(get_current_user)],
    db: Session = Depends(get_db),
) -> dict:
    u = db.get(User, user.sub)
    assert u
    u.theme = body.theme
    return {"id": u.id, "theme": u.theme}
