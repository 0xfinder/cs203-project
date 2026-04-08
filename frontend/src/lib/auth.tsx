import { createContext, useContext, useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { redirect } from "@tanstack/react-router";
import { HTTPError } from "ky";
import { supabase } from "./supabase";
import { getValidAccessToken } from "./session";
import { requiredCurrentUserViewQueryOptions } from "./current-user-view";
import { queryClient } from "./query-client";

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
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        void queryClient.invalidateQueries({ queryKey: ["current-user-view"] });
      }
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
    const me = await getRequiredUserProfile();
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
    const me = await getRequiredUserProfile();
    if (me.onboardingCompleted) {
      throw redirect({ to: "/lessons" });
    }
  } catch (error) {
    if (error instanceof HTTPError && error.response.status === 401) {
      await supabase.auth.signOut();
      throw redirect({ to: "/login" });
    }
    throw error;
  }
}

// Allow contributors (and higher roles) to access content even if onboarding
export async function requireContributorOrOnboarded() {
  await requireAuth();
  try {
    const me = await getRequiredUserProfile();
    const allowedRoles = ["CONTRIBUTOR", "MODERATOR", "ADMIN"];
    if (!me.onboardingCompleted && !allowedRoles.includes(me.role)) {
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

export async function requireContributorRole() {
  await requireAuth();
  try {
    const me = await getRequiredUserProfile();
    const allowedRoles = ["CONTRIBUTOR", "MODERATOR", "ADMIN"];
    if (!allowedRoles.includes(me.role)) {
      throw redirect({ to: me.onboardingCompleted ? "/lessons" : "/onboarding" });
    }
  } catch (error) {
    if (error instanceof HTTPError && error.response.status === 401) {
      await supabase.auth.signOut();
      throw redirect({ to: "/login" });
    }
    throw error;
  }
}

export async function requireModeratorRole() {
  await requireAuth();
  try {
    const me = await getRequiredUserProfile();
    const allowedRoles = ["MODERATOR", "ADMIN"];
    if (!allowedRoles.includes(me.role)) {
      throw redirect({ to: me.onboardingCompleted ? "/lessons" : "/onboarding" });
    }
  } catch (error) {
    if (error instanceof HTTPError && error.response.status === 401) {
      await supabase.auth.signOut();
      throw redirect({ to: "/login" });
    }
    throw error;
  }
}

async function getRequiredUserProfile() {
  const currentUserView = await queryClient.ensureQueryData(requiredCurrentUserViewQueryOptions());
  if (!currentUserView.profile) {
    throw new Error("Could not load current user profile");
  }
  return currentUserView.profile;
}
