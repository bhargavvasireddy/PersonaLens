from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_default_project, get_owner_user_id
from app.core.security import AuthenticatedPrincipal
from app.db import models
from app.db.session import get_db
from app.schemas.project import ProjectCreate, ProjectRead

router = APIRouter(tags=["projects"])


@router.get("/projects", response_model=list[ProjectRead])
def list_projects(
    db: Session = Depends(get_db),
    current_user: models.User | AuthenticatedPrincipal = Depends(get_current_user),
) -> list[models.Project]:
    owner_user_id = get_owner_user_id(current_user)
    get_default_project(db, owner_user_id)
    return (
        db.query(models.Project)
        .filter(models.Project.owner_user_id == owner_user_id)
        .order_by(models.Project.created_at.desc(), models.Project.id.desc())
        .all()
    )


@router.post("/projects", response_model=ProjectRead, status_code=status.HTTP_201_CREATED)
def create_project(
    payload: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: models.User | AuthenticatedPrincipal = Depends(get_current_user),
) -> models.Project:
    owner_user_id = get_owner_user_id(current_user)
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Project name is required.")

    project = models.Project(owner_user_id=owner_user_id, name=name)
    db.add(project)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail="A project with that name already exists.") from exc
    db.refresh(project)
    return project
