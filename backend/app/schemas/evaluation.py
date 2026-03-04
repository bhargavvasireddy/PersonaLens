from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class EvaluationIssue(BaseModel):
    title: str
    description: str
    severity: Literal["low", "medium", "high"]
    category: str


class EvaluationResult(BaseModel):
    summary: str
    overall_score: float = Field(ge=0, le=1)
    highlights: list[str] = Field(default_factory=list)
    issues: list[EvaluationIssue] = Field(default_factory=list)
    recommendations: list[str] = Field(default_factory=list)
    frontend_report: str = Field(default="", description="HTML report for frontend display.")


class EvaluationCreateResponse(BaseModel):
    id: int
    image_path: str
    primary_persona_id: int
    primary_persona_name: str
    compare_persona_id: int | None = None
    compare_persona_name: str | None = None
    status: Literal["succeeded", "failed"]
    overall_score: float | None = None
    error_message: str | None = None
    result_json: EvaluationResult | dict[str, object]
    frontend_report: str = ""
    created_at: datetime


class EvaluationRead(EvaluationCreateResponse):
    pass
