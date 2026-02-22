from __future__ import annotations

import secrets

from django.conf import settings


def _build_csp(nonce: str) -> str:
    # Strict baseline CSP for SPA/API deployment.
    # style-src keeps 'unsafe-inline' for current styling/runtime compatibility.
    return (
        "default-src 'self'; "
        f"script-src 'self' 'nonce-{nonce}'; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data: https:; "
        "connect-src 'self' https:; "
        "object-src 'none'; "
        "base-uri 'none'; "
        "frame-ancestors 'none'"
    )


class SecurityHeadersMiddleware:
    """
    Adds strict CSP in production with a per-request nonce.

    Notes:
    - Nonce is exposed as `request.csp_nonce` for server-rendered templates.
    - Admin/docs are excluded to avoid breaking Django admin static/inline behavior.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        nonce = secrets.token_urlsafe(18)
        request.csp_nonce = nonce
        response = self.get_response(request)

        if settings.DEBUG:
            return response

        path = (request.path or "").lower()
        admin_prefix = settings.ADMIN_URL.lower()
        if path.startswith(admin_prefix) or path.startswith("/api/docs") or path.startswith("/api/openapi.json"):
            return response

        if "Content-Security-Policy" not in response:
            response["Content-Security-Policy"] = _build_csp(nonce)
        return response

