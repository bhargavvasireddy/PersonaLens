import json
import logging
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_owner_user_id
from app.core.config import settings
from app.core.security import AuthenticatedPrincipal
from app.db import models
from app.db.session import get_db
from app.schemas.evaluation import EvaluationRead, EvaluationResult, SampleUi
from app.services.evaluation_service import AIInvalidJSONError, AIModelCallError, evaluate_ui

router = APIRouter(tags=["evaluations"])
logger = logging.getLogger(__name__)


def _serialize_evaluation(evaluation: models.Evaluation, db: Session, owner_user_id: str) -> EvaluationRead:
    parsed_result: EvaluationResult | dict[str, object] = {}
    try:
        parsed = json.loads(evaluation.result_json)
        if isinstance(parsed, dict):
            try:
                parsed_result = EvaluationResult.model_validate(parsed)
            except Exception:
                parsed_result = parsed
    except json.JSONDecodeError:
        parsed_result = {"raw": evaluation.result_json}

    primary_persona = (
        db.query(models.Persona)
        .filter(models.Persona.id == evaluation.primary_persona_id, models.Persona.owner_user_id == owner_user_id)
        .first()
    )
    compare_persona = None
    if evaluation.compare_persona_id is not None:
        compare_persona = (
            db.query(models.Persona)
            .filter(models.Persona.id == evaluation.compare_persona_id, models.Persona.owner_user_id == owner_user_id)
            .first()
        )

    frontend_report = ""
    sample_ui: SampleUi | None = None
    if isinstance(parsed_result, EvaluationResult):
        frontend_report = getattr(parsed_result, "frontend_report", "") or getattr(parsed_result, "report_markdown", "") or ""
        sample_ui = getattr(parsed_result, "sample_ui", None)
    elif isinstance(parsed_result, dict):
        frontend_report = parsed_result.get("frontend_report") or parsed_result.get("report_markdown") or ""
        raw_su = parsed_result.get("sample_ui")
        if isinstance(raw_su, dict):
            try:
                sample_ui = SampleUi.model_validate(raw_su)
            except Exception:
                sample_ui = None
    if not isinstance(frontend_report, str):
        frontend_report = ""

    return EvaluationRead(
        id=evaluation.id,
        image_path=evaluation.image_path,
        primary_persona_id=evaluation.primary_persona_id,
        primary_persona_name=primary_persona.name if primary_persona is not None else "Unknown",
        compare_persona_id=evaluation.compare_persona_id,
        compare_persona_name=compare_persona.name if compare_persona is not None else None,
        status=evaluation.status,
        overall_score=evaluation.overall_score,
        error_message=evaluation.error_message,
        result_json=parsed_result,
        frontend_report=frontend_report,
        sample_ui=sample_ui,
        created_at=evaluation.created_at,
    )


@router.post("/evaluate", response_model=EvaluationRead)
def create_evaluation(
    image: UploadFile | None = File(default=None),
    primary_persona_id: str | None = Form(default=None),
    compare_persona_id: str | None = Form(default=None),
    db: Session = Depends(get_db),
    current_user: models.User | AuthenticatedPrincipal = Depends(get_current_user),
) -> EvaluationRead:
    owner_user_id = get_owner_user_id(current_user)

    if image is None:
        raise HTTPException(status_code=400, detail="Image file is required.")
    if primary_persona_id is None or not primary_persona_id.strip():
        raise HTTPException(status_code=400, detail="primary_persona_id is required.")
    try:
        primary_persona_id_value = int(primary_persona_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="primary_persona_id must be an integer.") from exc

    primary_persona = (
        db.query(models.Persona)
        .filter(models.Persona.id == primary_persona_id_value, models.Persona.owner_user_id == owner_user_id)
        .first()
    )
    if primary_persona is None:
        raise HTTPException(status_code=400, detail="Primary persona not found.")

    compare_persona_id_value: int | None = None
    if compare_persona_id is not None and compare_persona_id.strip():
        try:
            compare_persona_id_value = int(compare_persona_id)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="compare_persona_id must be an integer.") from exc

        compare_persona = (
            db.query(models.Persona)
            .filter(models.Persona.id == compare_persona_id_value, models.Persona.owner_user_id == owner_user_id)
            .first()
        )
        if compare_persona is None:
            raise HTTPException(status_code=400, detail="Compare persona not found.")
    else:
        compare_persona = None

    upload_dir = Path(settings.upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)

    extension = Path(image.filename or "").suffix
    filename = f"{uuid4().hex}{extension}"
    target_path = upload_dir / filename

    file_bytes = image.file.read()
    target_path.write_bytes(file_bytes)
    logger.info("Saved upload to %s", target_path)

    logger.info("Calling AI models for evaluation (feedback + sample UI)...")
    try:
        result_payload = evaluate_ui(
            image_path=str(target_path),
            primary_persona=primary_persona,
            compare_persona=compare_persona,
        )
        logger.info("AI returned OK")
        evaluation = models.Evaluation(
            owner_user_id=owner_user_id,
            image_path=str(target_path),
            primary_persona_id=primary_persona_id_value,
            compare_persona_id=compare_persona_id_value,
            status="succeeded",
            overall_score=result_payload.overall_score,
            error_message=None,
            result_json=json.dumps(result_payload.model_dump()),
        )
        db.add(evaluation)
        db.commit()
        db.refresh(evaluation)
        logger.info("Saved evaluation id=%s to DB", evaluation.id)
        return _serialize_evaluation(evaluation, db, owner_user_id)
    except AIModelCallError as exc:
        logger.exception("AI evaluation failed: %s", exc)
        failed_evaluation = models.Evaluation(
            owner_user_id=owner_user_id,
            image_path=str(target_path),
            primary_persona_id=primary_persona_id_value,
            compare_persona_id=compare_persona_id_value,
            status="failed",
            overall_score=None,
            error_message=str(exc),
            result_json=json.dumps({"error": "AI evaluation failed"}),
        )
        db.add(failed_evaluation)
        db.commit()
        db.refresh(failed_evaluation)
        logger.info("Saved evaluation id=%s to DB", failed_evaluation.id)
        raise HTTPException(status_code=502, detail="AI evaluation failed") from exc
    except AIInvalidJSONError as exc:
        logger.exception("AI returned invalid JSON: %s", exc)
        failed_evaluation = models.Evaluation(
            owner_user_id=owner_user_id,
            image_path=str(target_path),
            primary_persona_id=primary_persona_id_value,
            compare_persona_id=compare_persona_id_value,
            status="failed",
            overall_score=None,
            error_message="AI returned invalid JSON",
            result_json=json.dumps({"error": "AI returned invalid JSON"}),
        )
        db.add(failed_evaluation)
        db.commit()
        db.refresh(failed_evaluation)
        logger.info("Saved evaluation id=%s to DB", failed_evaluation.id)
        raise HTTPException(status_code=500, detail="AI returned invalid JSON") from exc


@router.get("/evaluations", response_model=list[EvaluationRead])
def list_evaluations(
    persona_id: int | None = Query(default=None, ge=1),
    db: Session = Depends(get_db),
    current_user: models.User | AuthenticatedPrincipal = Depends(get_current_user),
) -> list[EvaluationRead]:
    owner_user_id = get_owner_user_id(current_user)

    query = db.query(models.Evaluation).filter(models.Evaluation.owner_user_id == owner_user_id)
    if persona_id is not None:
        persona = (
            db.query(models.Persona)
            .filter(models.Persona.id == persona_id, models.Persona.owner_user_id == owner_user_id)
            .first()
        )
        if persona is None:
            raise HTTPException(status_code=404, detail="Persona not found.")

        query = query.filter(
            or_(
                models.Evaluation.primary_persona_id == persona_id,
                models.Evaluation.compare_persona_id == persona_id,
            )
        )

    rows = query.order_by(models.Evaluation.created_at.desc()).all()
    return [_serialize_evaluation(row, db, owner_user_id) for row in rows]
