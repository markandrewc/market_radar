"""Who is hiring for a role (frontend: EmployersBlock)."""
from pydantic import BaseModel, Field

from .common import Role, SourceRef


class Employer(BaseModel):
    name: str
    openings: int = Field(ge=0)
    topSkill: str


class EmployersResponse(BaseModel):
    role: Role
    employers: list[Employer]
    source: SourceRef
