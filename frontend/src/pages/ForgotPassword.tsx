import React from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";

const ForgotPassword: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-background">
      <div className="w-full max-w-md">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Reset your password</CardTitle>
            <CardDescription>This screen is a placeholder for the upcoming reset flow.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Once the backend is connected, you will be able to request a password reset link here.
            </p>
            <Button asChild className="w-full">
              <Link to="/login">Back to sign in</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ForgotPassword;
