import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

type UserType = "patient" | "psychologue" | null;

interface AuthContextType {
  session: Session | null;
  user: User | null;
  userType: UserType;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  userType: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [userType, setUserType] = useState<UserType>(null);

  /** Fetch the user_type from the profiles table */
  const fetchUserType = async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("user_type")
      .eq("user_id", userId)
      .single();
    setUserType((data?.user_type as UserType) ?? "patient");
  };

  useEffect(() => {
    // Listen to future auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        // Use setTimeout to avoid Supabase deadlock on initial mount
        setTimeout(() => fetchUserType(session.user.id), 0);
      } else {
        setUserType(null);
      }
      setLoading(false);
    });

    // Get the current session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        fetchUserType(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUserType(null);
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, userType, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
