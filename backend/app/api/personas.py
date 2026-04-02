from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_default_project, get_owner_user_id, get_project_for_owner
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
    project_id: int | None = Query(default=None, ge=1),
    db: Session = Depends(get_db),
    current_user: models.User | AuthenticatedPrincipal = Depends(get_current_user),
) -> list[models.Persona]:
    owner_user_id = get_owner_user_id(current_user)
    query = db.query(models.Persona).filter(models.Persona.owner_user_id == owner_user_id)
    if project_id is not None:
        get_project_for_owner(db, owner_user_id, project_id)
        query = query.filter(models.Persona.project_id == project_id)
    return query.order_by(models.Persona.created_at.desc()).all()


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
    project = (
        get_project_for_owner(db, owner_user_id, payload.project_id)
        if payload.project_id is not None
        else get_default_project(db, owner_user_id)
    )
    persona = models.Persona(
        owner_user_id=owner_user_id,
        project_id=project.id,
        name=name,
        description=payload.description.strip(),
    )
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
            models.Evaluation.project_id == persona.project_id,
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
