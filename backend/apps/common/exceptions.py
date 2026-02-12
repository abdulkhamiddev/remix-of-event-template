from typing import Any


class APIError(Exception):
    def __init__(
        self,
        detail: str,
        *,
        code: str = "bad_request",
        status: int = 400,
        fields: dict[str, Any] | None = None,
    ) -> None:
        self.detail = detail
        self.code = code
        self.status = status
        self.fields = fields or {}
        super().__init__(detail)
