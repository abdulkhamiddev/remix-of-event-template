from ninja import Schema
from pydantic import Field, model_validator


class RegisterIn(Schema):
    email: str | None = None
    username: str | None = None
    password: str

    @model_validator(mode="after")
    def validate_identifier(self):
        if not (self.email or self.username):
            raise ValueError("Either email or username is required.")
        return self


class LoginIn(Schema):
    email: str | None = None
    username: str | None = None
    password: str

    @model_validator(mode="after")
    def validate_identifier(self):
        if not (self.email or self.username):
            raise ValueError("Either email or username is required.")
        return self


class RefreshIn(Schema):
    refresh: str


class LogoutIn(Schema):
    refresh: str | None = None


class TelegramAuthIn(Schema):
    initData: str = Field(min_length=1)


class AuthUserOut(Schema):
    id: str
    email: str | None = None
    username: str | None = None
    displayName: str | None = None


class AuthResponse(Schema):
    access: str
    refresh: str
    user: AuthUserOut


class RefreshResponse(Schema):
    access: str
    refresh: str
