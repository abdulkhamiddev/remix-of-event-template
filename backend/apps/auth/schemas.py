from ninja import Schema
from pydantic import model_validator


class AuthUserSchema(Schema):
    id: str
    email: str | None = None
    username: str | None = None
    displayName: str | None = None

    @staticmethod
    def resolve_id(obj) -> str:
        return str(obj.id)

    @staticmethod
    def resolve_displayName(obj) -> str | None:
        full_name = obj.get_full_name().strip() if hasattr(obj, "get_full_name") else ""
        return full_name or obj.username or None


class IdentifierPasswordSchema(Schema):
    username: str | None = None
    email: str | None = None
    password: str

    @model_validator(mode="after")
    def validate_identifier(self):
        if not self.username and not self.email:
            raise ValueError("Either username or email is required.")
        return self


class RefreshSchema(Schema):
    refresh: str


class AuthResponseSchema(Schema):
    access: str
    refresh: str
    user: AuthUserSchema | None = None


class RefreshResponseSchema(Schema):
    access: str
    refresh: str


class MessageSchema(Schema):
    detail: str
