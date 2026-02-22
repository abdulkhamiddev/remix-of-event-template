import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button.tsx";
import { telegramMagicLoginRequest } from "@/lib/authApi.ts";
import { authSession } from "@/lib/authSession.ts";
import { ApiError } from "@/lib/apiClient.ts";

const TelegramAuthCallback: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current) return;
    handledRef.current = true;

    const hashParams = new URLSearchParams((location.hash || "").replace(/^#/, ""));
    const queryParams = new URLSearchParams(location.search);
    const token = hashParams.get("token") || queryParams.get("token");
    if (!token) {
      setError("Login token is missing.");
      return;
    }

    // Scrub token from URL immediately (prevents Referer/history leakage).
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("token");
      url.hash = "";
      const scrubbed = url.pathname + (url.searchParams.toString() ? `?${url.searchParams.toString()}` : "");
      window.history.replaceState({}, document.title, scrubbed);
    } catch {
      // Ignore URL parsing failures; token still handled in-memory.
    }

    const run = async () => {
      try {
        const nextState = await telegramMagicLoginRequest(token);
        authSession.setState(nextState);
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
  }, [location.hash, location.search, navigate]);

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
