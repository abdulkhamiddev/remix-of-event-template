from django.contrib.auth import get_user_model
from ninja.security import HttpBearer

from apps.common.jwt import JWTDecodeError, decode_token

User = get_user_model()


class JWTAuth(HttpBearer):
    def authenticate(self, request, token):
        try:
            payload = decode_token(token, expected_type="access")
        except JWTDecodeError:
            return None

        user_id = payload.get("sub")
        if not user_id:
            return None

        try:
            return User.objects.get(id=int(user_id), is_active=True)
        except (TypeError, ValueError, User.DoesNotExist):
            return None
