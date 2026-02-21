import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAuth, useAuth } from "@/lib/auth";

export const Route = createFileRoute("/profile")({
  beforeLoad: requireAuth,
  component: ProfilePage,
});

function ProfilePage() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    void navigate({ to: "/login" });
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-2xl">Profile</CardTitle>
          <CardDescription>Manage your account session.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-lg border bg-muted/20 p-4">
            <p className="text-sm text-muted-foreground">Signed in email</p>
            <p className="mt-1 break-all font-medium">{user?.email ?? "unknown user"}</p>
          </div>
          <Button variant="destructive" onClick={handleSignOut}>
            Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
