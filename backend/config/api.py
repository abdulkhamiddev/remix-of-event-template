from django.core.exceptions import PermissionDenied, ValidationError as DjangoValidationError
from django.http import Http404
from ninja import NinjaAPI
from ninja.errors import AuthenticationError, AuthorizationError, HttpError, ValidationError

from apps.accounts.api import router as auth_router
from apps.analytics.api import router as analytics_router
from apps.common.exceptions import APIError
from apps.review.api import router as review_router
from apps.streak.api import router as streak_router
from apps.suggestions.api import router as suggestions_router
from apps.tasks.api import router as tasks_router

api = NinjaAPI(
    title="TaskFlow Backend API",
    version="1.0.0",
    docs_url="/docs",
    urls_namespace="backend_api",
)


@api.exception_handler(APIError)
def handle_api_error(request, exc: APIError):
    return api.create_response(
        request,
        {"detail": exc.detail, "code": exc.code, "fields": exc.fields or {}},
        status=exc.status,
    )


@api.exception_handler(HttpError)
def handle_http_error(request, exc: HttpError):
    return api.create_response(
        request,
        {"detail": str(exc), "code": "http_error", "fields": {}},
        status=exc.status_code,
    )


@api.exception_handler(Http404)
def handle_http_404(request, _exc: Http404):
    return api.create_response(
        request,
        {"detail": "Not found.", "code": "not_found", "fields": {}},
        status=404,
    )


@api.exception_handler(AuthenticationError)
def handle_authentication_error(request, _exc: AuthenticationError):
    return api.create_response(
        request,
        {"detail": "Unauthorized.", "code": "unauthorized", "fields": {}},
        status=401,
    )


@api.exception_handler(AuthorizationError)
def handle_authorization_error(request, _exc: AuthorizationError):
    return api.create_response(
        request,
        {"detail": "Forbidden.", "code": "forbidden", "fields": {}},
        status=403,
    )


@api.exception_handler(ValidationError)
def handle_ninja_validation_error(request, exc: ValidationError):
    fields = {}
    for item in exc.errors:
        location = ".".join(str(part) for part in item.get("loc", []) if part not in {"body", "query"})
        if location:
            fields[location] = item.get("msg", "Invalid value")
    return api.create_response(
        request,
        {"detail": "Validation failed.", "code": "validation_error", "fields": fields},
        status=422,
    )


@api.exception_handler(DjangoValidationError)
def handle_django_validation_error(request, exc: DjangoValidationError):
    fields = getattr(exc, "message_dict", {}) or {}
    detail = str(exc.messages[0]) if getattr(exc, "messages", None) else "Validation failed."
    return api.create_response(
        request,
        {"detail": detail, "code": "validation_error", "fields": fields},
        status=422,
    )


@api.exception_handler(PermissionDenied)
def handle_permission_error(request, _exc: PermissionDenied):
    return api.create_response(
        request,
        {"detail": "You do not have permission.", "code": "permission_denied", "fields": {}},
        status=403,
    )


api.add_router("/auth", auth_router)
api.add_router("", tasks_router)
api.add_router("/analytics", analytics_router)
api.add_router("/review", review_router)
api.add_router("/streak", streak_router)
api.add_router("/suggestions", suggestions_router)
