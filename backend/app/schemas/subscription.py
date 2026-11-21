"""Weekly report subscription (frontend: Reports page)."""
from pydantic import BaseModel, Field


class SubscribeBody(BaseModel):
    # Plain str keeps the backend free of the email-validator dependency; checked with a pattern instead.
    email: str = Field(pattern=r"^\S+@\S+\.\S+$")
    roleIds: list[str] = Field(min_length=1)


class SubscribeResult(BaseModel):
    ok: bool = True
