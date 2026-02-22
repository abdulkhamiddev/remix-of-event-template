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
    # Legacy: allow refresh in JSON for older clients.
    # Cookie-based refresh clients should omit this field.
    refresh: str | None = None


class LogoutIn(Schema):
    refresh: str | None = None


class TelegramAuthIn(Schema):
    initData: str = Field(min_length=1)


class TelegramMagicIn(Schema):
    token: str = Field(min_length=32)


class ForgotPasswordIn(Schema):
    emailOrUsername: str = Field(min_length=1)


class ResetPasswordIn(Schema):
    token: str = Field(min_length=32)
    newPassword: str = Field(min_length=8)


class AuthUserOut(Schema):
    id: str
    email: str | None = None
    username: str | None = None
    displayName: str | None = None


class AuthResponse(Schema):
    access: str
    # Cookie-based refresh: refresh token is not returned in JSON.
    refresh: str | None = None
    user: AuthUserOut


class RefreshResponse(Schema):
    access: str
    refresh: str | None = None


class DetailResponse(Schema):
    detail: str
