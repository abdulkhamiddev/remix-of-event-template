import React, { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Alert, AlertDescription } from "@/components/ui/alert.tsx";
import { useAuth } from "@/contexts/AuthContext.tsx";
import { ApiError } from "@/lib/apiClient.ts";
import { isAuthMockEnabled } from "@/lib/authMock.ts";

const MIN_PASSWORD_LENGTH = 8;

type LocationState = { from?: { pathname?: string } };

const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ identifier?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [telegramHint, setTelegramHint] = useState<string | null>(null);

  const redirectTo = useMemo(() => {
    const state = location.state as LocationState | null;
    return state?.from?.pathname || "/";
  }, [location.state]);

  const telegramRequested = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("provider") === "telegram";
  }, [location.search]);

  const validate = () => {
    const nextErrors: { identifier?: string; password?: string } = {};

    if (!identifier.trim()) {
      nextErrors.identifier = "Enter your email or username.";
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      nextErrors.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
    }

    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setTelegramHint(null);

    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await login(identifier, password);
      navigate(redirectTo, { replace: true });
    } catch (error) {
      if (error instanceof ApiError) {
        setFormError(error.message || "Unable to sign in. Please try again.");
      } else {
        setFormError("Unable to sign in. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-background">
      <div className="w-full max-w-md">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Welcome back</CardTitle>
            <CardDescription>Sign in to continue managing your tasks.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {formError && (
              <Alert variant="destructive">
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}
            {telegramHint && (
              <Alert>
                <AlertDescription>{telegramHint}</AlertDescription>
              </Alert>
            )}
            {telegramRequested && !telegramHint && (
              <Alert>
                <AlertDescription>Telegram option is available below. Start from Telegram app to use `initData` flow.</AlertDescription>
              </Alert>
            )}
            {isAuthMockEnabled() && (
              <Alert>
                <AlertDescription>Mock auth is enabled. Network errors will fall back to dev login.</AlertDescription>
              </Alert>
            )}
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="identifier">Email or Username</Label>
                <Input
                  id="identifier"
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                  placeholder="you@example.com"
                  autoComplete="username"
                />
                {fieldErrors.identifier && (
                  <p className="text-sm text-destructive">{fieldErrors.identifier}</p>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link className="text-sm text-muted-foreground hover:text-foreground" to="/forgot-password">
                    Forgot password?
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                />
                {fieldErrors.password && (
                  <p className="text-sm text-destructive">{fieldErrors.password}</p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "Signing in..." : "Sign in"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => setTelegramHint("Open TaskFlow from Telegram WebApp/Login Widget to continue with Telegram sign-in.")}
              >
                Start with Telegram
              </Button>
            </form>

            <p className="text-sm text-muted-foreground text-center">
              New here?{" "}
              <Link className="text-foreground hover:underline" to="/register">
                Create an account
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Login;
