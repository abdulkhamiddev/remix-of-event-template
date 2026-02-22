from __future__ import annotations

import json
from datetime import timedelta
from unittest.mock import patch

import fakeredis
from django.conf import settings
from django.test import Client, TestCase, override_settings
from django.utils import timezone

from apps.accounts.models import PasswordResetToken, RefreshToken, User
from apps.accounts.password_reset import hash_reset_token


@override_settings(
    AUTH_RETURN_REFRESH_IN_BODY=False,
    AUTH_COOKIE_SECURE=True,
    AUTH_COOKIE_SAMESITE="Strict",
)
class AuthSecuritySmokeTests(TestCase):
    def setUp(self):
        self.client = Client()
        self._fake_redis = fakeredis.FakeRedis()
        self._rate_limit_redis_patcher = patch(
            "apps.common.rate_limit.get_redis_connection",
            return_value=self._fake_redis,
        )
        self._rate_limit_redis_patcher.start()
        self.addCleanup(self._rate_limit_redis_patcher.stop)

    def _post_json(self, path: str, payload: dict | None = None, client: Client | None = None):
        target = client or self.client
        body = json.dumps(payload if payload is not None else {})
        return target.post(path, data=body, content_type="application/json")

    def test_register_sets_refresh_cookie_and_no_refresh_in_body(self):
        response = self._post_json(
            "/api/auth/register",
            {
                "email": "security@example.com",
                "username": "securityuser",
                "password": "S3cur3!Passw0rd",
            },
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("access", data)
        self.assertIn("user", data)
        self.assertNotIn("refresh", data)

        refresh_cookie = response.cookies.get(settings.AUTH_REFRESH_COOKIE_NAME)
        self.assertIsNotNone(refresh_cookie)
        self.assertEqual(refresh_cookie["path"], "/api/auth/refresh")
        self.assertTrue(bool(refresh_cookie["httponly"]))

        rsid_cookie = response.cookies.get(settings.AUTH_REFRESH_SESSION_COOKIE_NAME)
        self.assertIsNotNone(rsid_cookie)
        self.assertEqual(rsid_cookie["path"], "/api/auth")
        self.assertTrue(bool(rsid_cookie["httponly"]))

    def test_refresh_accepts_empty_body_via_cookie(self):
        register_response = self._post_json(
            "/api/auth/register",
            {
                "email": "refresh@example.com",
                "username": "refreshuser",
                "password": "An0ther!StrongPass",
            },
        )
        self.assertEqual(register_response.status_code, 200)

        response = self._post_json("/api/auth/refresh")
        self.assertEqual(response.status_code, 200)
        self.assertIn("access", response.json())

    def test_refresh_without_cookie_and_without_body_returns_no_refresh(self):
        anonymous = Client()
        response = anonymous.post("/api/auth/refresh", data="", content_type="application/json")
        self.assertEqual(response.status_code, 401)
        data = response.json()
        self.assertEqual(data.get("code"), "no_refresh")

    def test_refresh_reuse_revokes_all_sessions(self):
        register_response = self._post_json(
            "/api/auth/register",
            {
                "email": "reuse@example.com",
                "username": "reuseuser",
                "password": "R3use!StrongPass",
            },
        )
        self.assertEqual(register_response.status_code, 200)
        old_refresh = register_response.cookies[settings.AUTH_REFRESH_COOKIE_NAME].value

        rotate_response = self._post_json("/api/auth/refresh")
        self.assertEqual(rotate_response.status_code, 200)
        new_refresh = rotate_response.cookies[settings.AUTH_REFRESH_COOKIE_NAME].value
        self.assertNotEqual(old_refresh, new_refresh)

        attacker = Client()
        reuse_response = attacker.post(
            "/api/auth/refresh",
            data=json.dumps({"refresh": old_refresh}),
            content_type="application/json",
        )
        self.assertEqual(reuse_response.status_code, 401)
        self.assertEqual(reuse_response.json().get("code"), "refresh_reuse")

        user = User.objects.get(username="reuseuser")
        self.assertEqual(RefreshToken.objects.filter(user=user, revoked_at__isnull=True).count(), 0)

    def test_password_reset_revokes_sessions_and_marks_other_reset_tokens_used(self):
        register_response = self._post_json(
            "/api/auth/register",
            {
                "email": "reset@example.com",
                "username": "resetuser",
                "password": "R3set!StrongPass",
            },
        )
        self.assertEqual(register_response.status_code, 200)
        user = User.objects.get(username="resetuser")
        self.assertGreater(RefreshToken.objects.filter(user=user, revoked_at__isnull=True).count(), 0)

        raw_token = "reset-token-smoke-check-000000000000"
        current = PasswordResetToken.objects.create(
            user=user,
            token_hash=hash_reset_token(raw_token),
            expires_at=timezone.now() + timedelta(minutes=10),
        )
        other = PasswordResetToken.objects.create(
            user=user,
            token_hash=hash_reset_token("other-token-smoke-check-111111111111"),
            expires_at=timezone.now() + timedelta(minutes=10),
        )

        response = self._post_json(
            "/api/auth/reset-password",
            {
                "token": raw_token,
                "newPassword": "N3w!StrongerPass",
            },
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json().get("detail"), "password_reset_ok")

        user.refresh_from_db()
        current.refresh_from_db()
        other.refresh_from_db()
        self.assertTrue(current.used_at is not None)
        self.assertTrue(other.used_at is not None)
        self.assertEqual(RefreshToken.objects.filter(user=user, revoked_at__isnull=True).count(), 0)
