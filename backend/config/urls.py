from django.conf import settings
from django.contrib import admin
from django.http import Http404
from django.http import JsonResponse
from django.urls import path
from ninja.openapi.views import openapi_json, openapi_view

from config.api import api


def healthcheck(_request):
    return JsonResponse({"status": "ok"})


def _can_access_api_docs(request) -> bool:
    if settings.DEBUG:
        return True
    user = getattr(request, "user", None)
    return bool(user and user.is_authenticated and user.is_staff)


def api_docs_view(request, *args, **kwargs):
    if not _can_access_api_docs(request):
        raise Http404("Not found.")
    return openapi_view(request, api=api, **kwargs)


def api_openapi_view(request, *args, **kwargs):
    if not _can_access_api_docs(request):
        raise Http404("Not found.")
    return openapi_json(request, api=api, **kwargs)


urlpatterns = [
    path("admin/", admin.site.urls),
    path("healthz", healthcheck),
    path("api/docs", api_docs_view),
    path("api/docs/", api_docs_view),
    path("api/openapi.json", api_openapi_view),
    path("api/", api.urls),
]
