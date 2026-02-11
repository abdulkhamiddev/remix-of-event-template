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

const Register: React.FC = () => {
  const { register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ identifier?: string; password?: string; confirmPassword?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const redirectTo = useMemo(() => {
    const state = location.state as LocationState | null;
    return state?.from?.pathname || "/";
  }, [location.state]);

  const validate = () => {
    const nextErrors: { identifier?: string; password?: string; confirmPassword?: string } = {};

    if (!identifier.trim()) {
      nextErrors.identifier = "Enter your email or username.";
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      nextErrors.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
    }

    if (confirmPassword !== password) {
      nextErrors.confirmPassword = "Passwords do not match.";
    }

    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await register(identifier, password);
      navigate(redirectTo, { replace: true });
    } catch (error) {
      if (error instanceof ApiError) {
        setFormError(error.message || "Unable to create an account. Please try again.");
      } else {
        setFormError("Unable to create an account. Please try again.");
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
            <CardTitle>Create an account</CardTitle>
            <CardDescription>Get started with TaskFlow in minutes.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {formError && (
              <Alert variant="destructive">
                <AlertDescription>{formError}</AlertDescription>
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
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                />
                {fieldErrors.password && (
                  <p className="text-sm text-destructive">{fieldErrors.password}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                />
                {fieldErrors.confirmPassword && (
                  <p className="text-sm text-destructive">{fieldErrors.confirmPassword}</p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "Creating account..." : "Create account"}
              </Button>
            </form>

            <p className="text-sm text-muted-foreground text-center">
              Already have an account?{" "}
              <Link className="text-foreground hover:underline" to="/login">
                Sign in
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Register;
