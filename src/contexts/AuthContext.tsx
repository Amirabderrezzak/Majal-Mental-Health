import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

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

  const fetchUserType = async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("user_type")
      .eq("user_id", userId)
      .maybeSingle();
    setUserType((data?.user_type as UserType) ?? "patient");
    setLoading(false);
  };

  useEffect(() => {
    let currentUserId: string | null = null;
    const apply = (next: Session | null) => {
      setSession(next);
      const nextId = next?.user?.id ?? null;
      if (nextId === currentUserId) return; // token refresh: same user, nothing to reload
      currentUserId = nextId;
      if (nextId) {
        // Only show the full-page loader for a different user. The hourly token
        // refresh used to flip `loading` on, which unmounted the whole space
        // (losing open chats, forms and the call-in-progress state).
        setLoading(true);
        // Deferred: calling Supabase inside onAuthStateChange can deadlock supabase-js.
        setTimeout(() => fetchUserType(nextId), 0);
      } else {
        setUserType(null);
        setLoading(false);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => apply(s));
    supabase.auth.getSession().then(({ data: { session: s } }) => apply(s));
    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    // Journal entries, goals and session notes are cached locally for offline
    // use; don't leave a patient's private notes on a shared phone/computer.
    // Cleared first, so it happens even if the network sign-out stalls.
    const clearPrivateCache = () => {
      try {
        Object.keys(localStorage).filter((k) => k.startsWith("majal_")).forEach((k) => localStorage.removeItem(k));
      } catch { /* storage unavailable */ }
    };
    clearPrivateCache();
    await supabase.auth.signOut().catch((e) => console.warn("signOut:", e));
    clearPrivateCache(); // anything a still-mounted widget wrote meanwhile
    setUserType(null);
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, userType, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
