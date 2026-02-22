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
import PasswordStrength from "@/components/auth/PasswordStrength.tsx";
import { generateStrongPassword, PasswordServerIssue } from "@/lib/passwordStrength.ts";

const MIN_PASSWORD_LENGTH = 8;

type LocationState = { from?: { pathname?: string } };
type RegisterFieldErrors = { identifier?: string; password?: string; confirmPassword?: string };

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
};

const parsePasswordServerIssues = (data: unknown): PasswordServerIssue[] => {
  const payload = asRecord(data);
  const fields = asRecord(payload?.fields);
  const passwordField = fields?.password;

  if (!Array.isArray(passwordField)) return [];
  return passwordField
    .map((item) => asRecord(item))
    .filter((item): item is Record<string, unknown> => Boolean(item))
    .map((item) => ({
      code: typeof item.code === "string" ? item.code : "invalid",
      message: typeof item.message === "string" ? item.message : "Password is invalid.",
    }));
};

const parseIdentifierFieldError = (data: unknown): string | null => {
  const payload = asRecord(data);
  const fields = asRecord(payload?.fields);
  const emailError = fields?.email;
  const usernameError = fields?.username;

  if (typeof emailError === "string" && emailError.trim()) return emailError;
  if (typeof usernameError === "string" && usernameError.trim()) return usernameError;
  return null;
};

const Register: React.FC = () => {
  const { register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<RegisterFieldErrors>({});
  const [passwordServerIssues, setPasswordServerIssues] = useState<PasswordServerIssue[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const redirectTo = useMemo(() => {
    const state = location.state as LocationState | null;
    return state?.from?.pathname || "/";
  }, [location.state]);

  const validate = () => {
    const nextErrors: RegisterFieldErrors = {};

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
    setPasswordServerIssues([]);

    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await register(identifier, password);
      navigate(redirectTo, { replace: true });
    } catch (error) {
      if (error instanceof ApiError) {
        const payload = asRecord(error.data);
        if (payload?.code === "password_invalid") {
          const issues = parsePasswordServerIssues(error.data);
          setPasswordServerIssues(issues);
          setFieldErrors((prev) => ({
            ...prev,
            password: issues[0]?.message || "Password is invalid.",
          }));
          setFormError("Choose a stronger password to continue.");
          return;
        }

        const identifierIssue = parseIdentifierFieldError(error.data);
        if (identifierIssue) {
          setFieldErrors((prev) => ({ ...prev, identifier: identifierIssue }));
        }
        setFormError(error.message || "Unable to create an account. Please try again.");
      } else {
        setFormError("Unable to create an account. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGeneratePassword = () => {
    try {
      const generated = generateStrongPassword(18);
      setPassword(generated);
      setConfirmPassword(generated);
      setPasswordServerIssues([]);
      setFieldErrors((prev) => ({
        ...prev,
        password: undefined,
        confirmPassword: undefined,
      }));
      setFormError(null);
    } catch (_error) {
      setFormError("Secure password generation is not available in this browser.");
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
                  onChange={(event) => {
                    setIdentifier(event.target.value);
                    setFieldErrors((prev) => ({ ...prev, identifier: undefined }));
                  }}
                  placeholder="you@example.com"
                  autoComplete="username"
                />
                {fieldErrors.identifier && (
                  <p className="text-sm text-destructive">{fieldErrors.identifier}</p>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="password">Password</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleGeneratePassword}
                  >
                    Generate strong password
                  </Button>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      setPasswordServerIssues([]);
                      setFieldErrors((prev) => ({ ...prev, password: undefined }));
                    }}
                    autoComplete="new-password"
                    className="pr-16"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 h-8 -translate-y-1/2 px-2"
                    onClick={() => setShowPassword((prev) => !prev)}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </Button>
                </div>
                <PasswordStrength
                  password={password}
                  identifier={identifier}
                  serverIssues={passwordServerIssues}
                />
                {fieldErrors.password && (
                  <p className="text-sm text-destructive">{fieldErrors.password}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm password</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(event) => {
                      setConfirmPassword(event.target.value);
                      setFieldErrors((prev) => ({ ...prev, confirmPassword: undefined }));
                    }}
                    autoComplete="new-password"
                    className="pr-16"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 h-8 -translate-y-1/2 px-2"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                  >
                    {showConfirmPassword ? "Hide" : "Show"}
                  </Button>
                </div>
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
