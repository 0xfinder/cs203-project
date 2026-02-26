import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getValidAccessToken } from "@/lib/session";
import { getMe } from "@/lib/me";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HTTPError } from "ky";

export const Route = createFileRoute("/login")({
  beforeLoad: async () => {
    const token = await getValidAccessToken();
    if (!token) {
      return;
    }

    try {
      const me = await getMe();
      throw redirect({ to: me.onboardingCompleted ? "/lessons" : "/onboarding" });
    } catch (error) {
      if (error instanceof HTTPError && error.response.status === 401) {
        await supabase.auth.signOut();
        return;
      }
      throw error;
    }
  },
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState(() => {
    try {
      if (typeof window !== "undefined") {
        const hash = window.location.hash;
        const params = new URLSearchParams(window.location.search);
        if (hash === "#signup") return "signup";
        if (params.get("tab") === "signup") return "signup";
      }
    } catch {}
    return "login";
  });

  const handleLogin = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: emailRef.current?.value ?? "",
      password: passwordRef.current?.value ?? "",
    });

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }

    void navigate({ to: "/lessons" });
  };

  const handleSignUp = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email: emailRef.current?.value ?? "",
      password: passwordRef.current?.value ?? "",
    });

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }

    setSuccess("Check your email for a confirmation link, then log in");
    setTab("login");
  };

  return (
    <div className="flex flex-1 items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <Tabs
          value={tab}
          onValueChange={(value) => {
            setTab(value);
            setError(null);
            setSuccess(null);
          }}
        >
          <CardHeader>
            <CardTitle className="text-center text-2xl">
              {tab === "login" ? "Sign in" : "Create an account"}
            </CardTitle>
            <CardDescription className="text-center">
              {tab === "login"
                ? "Log in to your AlphaLingo account"
                : "Sign up to start learning Gen-Alpha culture"}
            </CardDescription>
            <TabsList className="mt-3 w-full gap-0 border-2 border-primary/40 bg-card/80 p-1 shadow-sm">
              <TabsTrigger
                value="login"
                className="flex-1 rounded-r-none border-r border-primary/35 data-[state=active]:bg-primary/20 data-[state=active]:text-foreground"
              >
                Sign In
              </TabsTrigger>
              <TabsTrigger
                value="signup"
                className="flex-1 rounded-l-none data-[state=active]:bg-primary/20 data-[state=active]:text-foreground"
              >
                Sign Up
              </TabsTrigger>
            </TabsList>
          </CardHeader>
          <CardContent>
            {error && (
              <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
            {success && (
              <p className="mb-4 rounded-md bg-green-500/10 px-3 py-2 text-sm text-green-700 dark:text-green-400">
                {success}
              </p>
            )}

            <TabsContent value="login" className="mt-0">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="name@example.com"
                    ref={emailRef}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Password</Label>
                  <Input
                    id="login-password"
                    type="password"
                    placeholder="••••••••"
                    ref={passwordRef}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Logging in…" : "Login"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="mt-0">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="name@example.com"
                    ref={emailRef}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="••••••••"
                    ref={passwordRef}
                    required
                    minLength={6}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Creating account…" : "Sign up"}
                </Button>
              </form>
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>
    </div>
  );
}
