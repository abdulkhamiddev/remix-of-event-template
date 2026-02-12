import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Alert, AlertDescription } from "@/components/ui/alert.tsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { forgotPassword } from "@/lib/passwordResetApi.ts";

const ForgotPassword: React.FC = () => {
  const [emailOrUsername, setEmailOrUsername] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      await forgotPassword(emailOrUsername.trim());
    } catch (_error) {
      // Keep the same response message to prevent account enumeration.
    } finally {
      setSubmitted(true);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-background">
      <div className="w-full max-w-md">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Reset your password</CardTitle>
            <CardDescription>Enter your email or username to receive a password reset link.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {submitted && (
              <Alert>
                <AlertDescription>
                  If the account exists, a reset link has been sent to the registered email address.
                </AlertDescription>
              </Alert>
            )}

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="emailOrUsername">Email or Username</Label>
                <Input
                  id="emailOrUsername"
                  value={emailOrUsername}
                  onChange={(event) => setEmailOrUsername(event.target.value)}
                  placeholder="you@example.com"
                  autoComplete="username"
                  required
                />
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting || !emailOrUsername.trim()}>
                {isSubmitting ? "Sending..." : "Send reset link"}
              </Button>
            </form>

            <Button asChild variant="outline" className="w-full">
              <Link to="/login">Back to sign in</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ForgotPassword;
