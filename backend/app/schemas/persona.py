from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class PersonaCreate(BaseModel):
    project_id: int | None = None
    name: str
    description: str = ""


class PersonaUpdate(BaseModel):
    name: str
    description: str = ""


class PersonaRead(BaseModel):
    id: int
    project_id: int
    name: str
    description: str
    created_at: datetime

    model_config = {"from_attributes": True}


class AssistMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class PersonaAssistRequest(BaseModel):
    name: str
    messages: list[AssistMessage] = []


class PersonaAssistResponse(BaseModel):
    message: str
    suggested_description: str | None = None
