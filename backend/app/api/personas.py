from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_owner_user_id
from app.core.security import AuthenticatedPrincipal
from app.db import models
from app.db.session import get_db
from app.schemas.persona import PersonaCreate, PersonaRead

router = APIRouter(tags=["personas"])


@router.get("/personas", response_model=list[PersonaRead])
def list_personas(
    db: Session = Depends(get_db),
    current_user: models.User | AuthenticatedPrincipal = Depends(get_current_user),
) -> list[models.Persona]:
    owner_user_id = get_owner_user_id(current_user)
    return (
        db.query(models.Persona)
        .filter(models.Persona.owner_user_id == owner_user_id)
        .order_by(models.Persona.created_at.desc())
        .all()
    )


@router.post("/personas", response_model=PersonaRead, status_code=status.HTTP_201_CREATED)
def create_persona(
    payload: PersonaCreate,
    db: Session = Depends(get_db),
    current_user: models.User | AuthenticatedPrincipal = Depends(get_current_user),
) -> models.Persona:
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Persona name is required.")

    owner_user_id = get_owner_user_id(current_user)
    persona = models.Persona(owner_user_id=owner_user_id, name=name, description=payload.description.strip())
    db.add(persona)
    db.commit()
    db.refresh(persona)
    return persona
