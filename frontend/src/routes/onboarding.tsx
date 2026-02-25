import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { HTTPError } from "ky";
import { requireOnboardingPending } from "@/lib/auth";
import { getMe, patchMe, type RoleIntent } from "@/lib/me";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/onboarding")({
  beforeLoad: requireOnboardingPending,
  component: OnboardingPage,
});

function OnboardingPage() {
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [roleIntent, setRoleIntent] = useState<RoleIntent>("LEARNER");
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void getMe()
      .then((me) => {
        if (!active) {
          return;
        }
        if (me.displayName) {
          setDisplayName(me.displayName);
        }
        if (me.role === "CONTRIBUTOR") {
          setRoleIntent("CONTRIBUTOR");
        } else {
          setRoleIntent("LEARNER");
        }
      })
      .catch((requestError) => {
        if (!active) {
          return;
        }
        const message =
          requestError instanceof Error ? requestError.message : "Failed to load onboarding data";
        setError(message);
      })
      .finally(() => {
        if (active) {
          setLoadingProfile(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const trimmedDisplayName = useMemo(() => displayName.trim(), [displayName]);
  const displayNameIsValid = trimmedDisplayName.length >= 2 && trimmedDisplayName.length <= 32;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!displayNameIsValid) {
      setError("Display name must be 2 to 32 characters.");
      return;
    }

    setSaving(true);
    try {
      await patchMe({
        displayName: trimmedDisplayName,
        roleIntent,
      });
      void navigate({ to: "/dashboard" });
    } catch (requestError) {
      if (requestError instanceof HTTPError) {
        try {
          const body = await requestError.response.json<{ message?: string }>();
          setError(body.message ?? "Could not save profile.");
        } catch {
          setError("Could not save profile.");
        }
      } else if (requestError instanceof Error) {
        setError(requestError.message);
      } else {
        setError("Could not save profile.");
      }
    } finally {
      setSaving(false);
    }
  };

  if (loadingProfile) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <p className="text-sm text-muted-foreground">Preparing your profile...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 items-center px-4 py-10 sm:px-6">
      <Card className="w-full border-2">
        <CardHeader className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Welcome to AlphaLingo
          </p>
          <CardTitle className="text-3xl">Set up your profile</CardTitle>
          <CardDescription>
            Tell us what to call you and how you want to start learning.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="space-y-2">
              <Label htmlFor="display-name">What should we call you?</Label>
              <Input
                id="display-name"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="e.g. Kai"
                maxLength={32}
                required
              />
              <p className="text-xs text-muted-foreground">Use 2 to 32 characters.</p>
            </div>

            <div className="space-y-3">
              <Label>I want to start as</Label>
              <div className="grid gap-3 sm:grid-cols-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setRoleIntent("LEARNER")}
                  className={`h-auto flex-col items-start gap-1 whitespace-normal rounded-lg px-4 py-3 text-left transition ${
                    roleIntent === "LEARNER"
                      ? "border-primary bg-primary/10"
                      : "border-border hover:bg-accent"
                  }`}
                >
                  <p className="font-medium">Learner</p>
                  <p className="text-sm text-muted-foreground">
                    Focus on lessons, examples, and review drills.
                  </p>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setRoleIntent("CONTRIBUTOR")}
                  className={`h-auto flex-col items-start gap-1 whitespace-normal rounded-lg px-4 py-3 text-left transition ${
                    roleIntent === "CONTRIBUTOR"
                      ? "border-primary bg-primary/10"
                      : "border-border hover:bg-accent"
                  }`}
                >
                  <p className="font-medium">Contributor</p>
                  <p className="text-sm text-muted-foreground">
                    Submit and help improve community knowledge entries.
                  </p>
                </Button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={saving || !displayNameIsValid}
              className="w-full sm:w-auto"
            >
              {saving ? "Saving profile..." : "Continue to dashboard"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
