import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../stores/auth";

export default function RequireAdmin({ children }: { children: ReactNode }) {
  const access = useAuth(s => s.access);
  const refresh = useAuth(s => s.refresh);
  const loc = useLocation();
  if (!access && !refresh) return <Navigate to="/admin/login" replace state={{ from: loc.pathname }} />;
  return <>{children}</>;
}
