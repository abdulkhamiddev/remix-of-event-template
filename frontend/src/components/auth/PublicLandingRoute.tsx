import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext.tsx";

interface PublicLandingRouteProps {
  children: React.ReactNode;
}

export const PublicLandingRoute: React.FC<PublicLandingRouteProps> = ({ children }) => {
  const { isAuthenticated, isHydrated } = useAuth();

  if (isHydrated && isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};
