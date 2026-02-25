import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth, requireOnboardingCompleted } from "@/lib/auth";

export const Route = createFileRoute("/dashboard")({
  beforeLoad: async () => {
    await requireOnboardingCompleted();
  },
  component: DashboardPage,
});

function DashboardPage() {
  const { user } = useAuth();
  const displayName =
    (user as any)?.user_metadata?.full_name?.trim() ||
    (user as any)?.user_metadata?.name?.trim() ||
    user?.email ||
    "unknown user";

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-2xl">Dashboard</CardTitle>
          <CardDescription>
            Signed in as {displayName}. Pick where you want to continue.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button asChild>
            <Link to="/add">Add Term</Link>
          </Button>
          <Button variant="secondary" asChild>
            <Link to="/review">Review Queue</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
