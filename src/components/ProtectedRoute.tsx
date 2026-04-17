import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** If set, only allow this user_type to access. Others are redirected. */
  requiredRole?: "patient" | "psychologue";
  /** Where to redirect unauthenticated users (default: /connexion) */
  redirectTo?: string;
}

const ProtectedRoute = ({
  children,
  requiredRole,
  redirectTo = "/connexion",
}: ProtectedRouteProps) => {
  const { user, loading, userType } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-teal-hero">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-[3px] border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    // Preserve the page they tried to visit so we can redirect back after login
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  if (requiredRole && userType && userType !== requiredRole) {
    // Logged in but wrong role — redirect to their correct space
    const correctSpace = userType === "psychologue" ? "/espace-psy" : "/mon-espace";
    return <Navigate to={correctSpace} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
