from __future__ import annotations

from django.conf import settings
from django.test import Client, TestCase, override_settings


class SecurityHeadersMiddlewareTests(TestCase):
    @override_settings(DEBUG=False)
    def test_csp_header_present_on_healthcheck(self):
        client = Client()
        response = client.get("/healthz")
        self.assertEqual(response.status_code, 200)
        self.assertIn("Content-Security-Policy", response)
        policy = response["Content-Security-Policy"]
        self.assertIn("default-src 'self'", policy)
        self.assertIn("script-src 'self' 'nonce-", policy)

    @override_settings(DEBUG=False)
    def test_csp_header_skipped_for_admin_path(self):
        client = Client()
        admin_url = settings.ADMIN_URL
        response = client.get(admin_url)
        # unauthenticated admin page is still a valid response (redirect/login),
        # and should not force strict CSP to avoid inline-admin breakage.
        self.assertNotIn("Content-Security-Policy", response)

