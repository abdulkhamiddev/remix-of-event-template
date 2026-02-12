import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext.tsx";

interface PublicLandingRouteProps {
  children: React.ReactNode;
}

export const PublicLandingRoute: React.FC<PublicLandingRouteProps> = ({ children }) => {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};
