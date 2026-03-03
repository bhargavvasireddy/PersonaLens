from datetime import datetime

from pydantic import BaseModel


class PersonaCreate(BaseModel):
    name: str
    description: str = ""


class PersonaRead(BaseModel):
    id: int
    name: str
    description: str
    created_at: datetime

    model_config = {"from_attributes": True}

