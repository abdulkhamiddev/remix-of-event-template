from apps.common.exceptions import APIError


def require_authenticated(user) -> None:
    if not user or not getattr(user, "is_authenticated", False):
        raise APIError("Unauthorized.", code="unauthorized", status=401)
