"""Who is hiring for a role (level 3, category C; frontend: EmployersBlock)."""
from pydantic import BaseModel, Field

from .common import Role, SourceRef


class Employer(BaseModel):
    name: str
    openings: int = Field(ge=0)
    topSkills: list[str] = Field(default_factory=list)  # most named skills in this employer's postings
    sourceUrl: str | None = None  # where the team can check this employer's postings


class Window(BaseModel):
    """The posting period the numbers come from; null when the source gives no usable dates."""

    from_: str = Field(alias="from")
    to: str

    model_config = {"populate_by_name": True}


class EmployersResponse(BaseModel):
    role: Role
    window: Window | None = None
    employers: list[Employer] = Field(default_factory=list)
    source: SourceRef
