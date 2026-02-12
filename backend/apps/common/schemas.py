from pydantic import Field
from ninja import Schema


class ErrorResponse(Schema):
    detail: str
    code: str
    fields: dict = Field(default_factory=dict)


class PaginationMeta(Schema):
    page: int
    pageSize: int
    total: int
    totalPages: int
