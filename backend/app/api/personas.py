from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_owner_user_id
from app.core.security import AuthenticatedPrincipal
from app.db import models
from app.db.session import get_db
from app.schemas.persona import PersonaAssistRequest, PersonaAssistResponse, PersonaCreate, PersonaRead, PersonaUpdate
from app.services.persona_assist_service import get_assist_reply

router = APIRouter(tags=["personas"])


@router.post("/personas/assist", response_model=PersonaAssistResponse)
def assist_persona(
    payload: PersonaAssistRequest,
    current_user: models.User | AuthenticatedPrincipal = Depends(get_current_user),
) -> PersonaAssistResponse:
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Persona name is required.")
    try:
        message, suggested = get_assist_reply(name, payload.messages)
    except ValueError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"AI assist failed: {exc}")
    return PersonaAssistResponse(message=message, suggested_description=suggested)


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


@router.patch("/personas/{persona_id}", response_model=PersonaRead)
def update_persona(
    persona_id: int,
    payload: PersonaUpdate,
    db: Session = Depends(get_db),
    current_user: models.User | AuthenticatedPrincipal = Depends(get_current_user),
) -> models.Persona:
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Persona name is required.")

    owner_user_id = get_owner_user_id(current_user)
    persona = (
        db.query(models.Persona)
        .filter(models.Persona.id == persona_id, models.Persona.owner_user_id == owner_user_id)
        .first()
    )
    if persona is None:
        raise HTTPException(status_code=404, detail="Persona not found.")

    persona.name = name
    persona.description = payload.description.strip()
    db.commit()
    db.refresh(persona)
    return persona


@router.delete("/personas/{persona_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_persona(
    persona_id: int,
    db: Session = Depends(get_db),
    current_user: models.User | AuthenticatedPrincipal = Depends(get_current_user),
) -> None:
    owner_user_id = get_owner_user_id(current_user)
    persona = (
        db.query(models.Persona)
        .filter(models.Persona.id == persona_id, models.Persona.owner_user_id == owner_user_id)
        .first()
    )
    if persona is None:
        raise HTTPException(status_code=404, detail="Persona not found.")

    evaluations = (
        db.query(models.Evaluation)
        .filter(
            models.Evaluation.owner_user_id == owner_user_id,
            or_(
                models.Evaluation.primary_persona_id == persona_id,
                models.Evaluation.compare_persona_id == persona_id,
            ),
        )
        .all()
    )
    for evaluation in evaluations:
        image = Path(evaluation.image_path)
        if image.is_file():
            try:
                image.unlink()
            except OSError:
                pass
        db.delete(evaluation)

    db.delete(persona)
    db.commit()
