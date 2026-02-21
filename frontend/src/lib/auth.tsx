import { createContext, useContext, useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { redirect } from "@tanstack/react-router";
import { HTTPError } from "ky";
import { supabase } from "./supabase";
import { getValidAccessToken } from "./session";
import { getMe } from "./me";

interface AuthContext {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContext | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext
      value={{
        user: session?.user ?? null,
        session,
        loading,
        signOut,
      }}
    >
      {children}
    </AuthContext>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

// use in beforeLoad on any route that requires authentication
export async function requireAuth() {
  const token = await getValidAccessToken();
  if (!token) {
    await supabase.auth.signOut();
    throw redirect({ to: "/login" });
  }
}

export async function requireOnboardingCompleted() {
  await requireAuth();
  try {
    const me = await getMe();
    if (!me.onboardingCompleted) {
      throw redirect({ to: "/onboarding" });
    }
  } catch (error) {
    if (error instanceof HTTPError && error.response.status === 401) {
      await supabase.auth.signOut();
      throw redirect({ to: "/login" });
    }
    throw error;
  }
}

export async function requireOnboardingPending() {
  await requireAuth();
  try {
    const me = await getMe();
    if (me.onboardingCompleted) {
      throw redirect({ to: "/dashboard" });
    }
  } catch (error) {
    if (error instanceof HTTPError && error.response.status === 401) {
      await supabase.auth.signOut();
      throw redirect({ to: "/login" });
    }
    throw error;
  }
}
