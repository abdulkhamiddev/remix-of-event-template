import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button.tsx";
import { telegramMagicLoginRequest } from "@/lib/authApi.ts";
import { authStorage } from "@/lib/authStorage.ts";
import { ApiError } from "@/lib/apiClient.ts";

const TelegramAuthCallback: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current) return;
    handledRef.current = true;

    const params = new URLSearchParams(location.search);
    const token = params.get("token");
    if (!token) {
      setError("Login token is missing.");
      return;
    }

    const run = async () => {
      try {
        const nextState = await telegramMagicLoginRequest(token);
        authStorage.setState(nextState);
        navigate("/", { replace: true });
      } catch (requestError) {
        if (requestError instanceof ApiError) {
          setError(requestError.message || "Telegram login failed.");
        } else {
          setError("Telegram login failed.");
        }
      }
    };

    void run();
  }, [location.search, navigate]);

  if (!error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="app-surface p-6 text-center">
          <p className="text-sm text-muted-foreground">Signing you in with Telegram...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="app-surface p-6 max-w-md space-y-4">
        <h1 className="text-lg font-semibold text-foreground">Telegram Sign-in Failed</h1>
        <p className="text-sm text-muted-foreground">{error}</p>
        <div className="flex gap-2">
          <Button asChild>
            <Link to="/landing">Back to Landing</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/login">Continue with Email</Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TelegramAuthCallback;
