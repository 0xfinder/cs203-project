import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, ThumbsDown, ThumbsUp } from "lucide-react";
import { requireOnboardingCompleted } from "@/lib/auth";
import { useMyApprovedContentsWithVotes } from "@/features/content/useContentData";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { optionalCurrentUserViewQueryOptions } from "@/lib/current-user-view";
import { AppPageShell } from "@/components/app-page-shell";

export const Route = createFileRoute("/dashboard")({
  beforeLoad: requireOnboardingCompleted,
  component: DashboardPage,
});

function DashboardPage() {
  const currentUserViewQuery = useQuery(optionalCurrentUserViewQueryOptions());
  const userEmail = currentUserViewQuery.data?.profile?.email ?? null;
  const { data: myContents, isLoading, error } = useMyApprovedContentsWithVotes();

  if (currentUserViewQuery.isLoading || isLoading || userEmail === null) {
    return <div className="p-8 text-center">Loading your dashboard...</div>;
  }

  if (currentUserViewQuery.error || error) {
    return (
      <div className="p-8 text-center text-destructive">
        Error loading your content:{" "}
        {currentUserViewQuery.error instanceof Error
          ? currentUserViewQuery.error.message
          : error instanceof Error
            ? error.message
            : "Unknown error"}
      </div>
    );
  }

  const sortedContents = (myContents || []).sort((a, b) => {
    const aScore = a.thumbsUp - a.thumbsDown;
    const bScore = b.thumbsUp - b.thumbsDown;
    return bScore - aScore;
  });

  const totalUpvotes = sortedContents.reduce((sum, item) => sum + item.thumbsUp, 0);
  const totalDownvotes = sortedContents.reduce((sum, item) => sum + item.thumbsDown, 0);

  return (
    <AppPageShell contentClassName="max-w-4xl">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
          <BarChart3 className="size-5 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">My Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Track your approved lingo and community engagement
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="mb-8 grid grid-cols-3 gap-2 sm:gap-4">
        <Card>
          <CardHeader className="p-3 pb-1 text-center sm:pb-2">
            <CardTitle className="text-xs font-medium leading-tight text-muted-foreground sm:text-sm">
              <span className="block">Total</span>
              <span className="block">Submissions</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3 pt-0 text-center">
            <div className="text-2xl font-bold sm:text-3xl">{sortedContents.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-3 pb-1 text-center sm:pb-2">
            <CardTitle className="text-xs font-medium leading-tight text-muted-foreground sm:text-sm">
              <span className="block">Total</span>
              <span className="block">Upvotes</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3 pt-0">
            <div className="flex items-center justify-center gap-1.5 sm:gap-2">
              <ThumbsUp className="h-4 w-4 text-green-600 sm:h-5 sm:w-5" />
              <span className="text-2xl font-bold text-green-600 sm:text-3xl">{totalUpvotes}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-3 pb-1 text-center sm:pb-2">
            <CardTitle className="text-xs font-medium leading-tight text-muted-foreground sm:text-sm">
              <span className="block">Total</span>
              <span className="block">Downvotes</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3 pt-0">
            <div className="flex items-center justify-center gap-1.5 sm:gap-2">
              <ThumbsDown className="h-4 w-4 text-red-600 sm:h-5 sm:w-5" />
              <span className="text-2xl font-bold text-red-600 sm:text-3xl">{totalDownvotes}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Content List */}
      <h2 className="text-xl font-semibold mb-4">My Approved Lingo</h2>

      {sortedContents.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              You haven't submitted any approved lingo yet. Head to the <strong>Add</strong> page to
              get started!
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {sortedContents.map((item) => {
            const score = item.thumbsUp - item.thumbsDown;
            const scoreColor =
              score > 0 ? "text-green-600" : score < 0 ? "text-red-600" : "text-muted-foreground";

            return (
              <Card key={item.content.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{item.content.term}</CardTitle>
                      <CardDescription className="mt-1">{item.content.definition}</CardDescription>
                    </div>
                    <div className="ml-4 text-right">
                      <div className={`text-2xl font-bold ${scoreColor}`}>
                        {score > 0 ? "+" : ""}
                        {score}
                      </div>
                      <p className="text-xs text-muted-foreground">Net Score</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {item.content.example && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-1">Example</p>
                        <p className="text-sm italic text-muted-foreground">
                          "{item.content.example}"
                        </p>
                      </div>
                    )}

                    <div className="flex items-center gap-6 pt-2 border-t">
                      <div className="flex items-center gap-2">
                        <ThumbsUp className="w-4 h-4 text-green-600" />
                        <span className="text-sm font-medium">{item.thumbsUp} upvotes</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <ThumbsDown className="w-4 h-4 text-red-600" />
                        <span className="text-sm font-medium">{item.thumbsDown} downvotes</span>
                      </div>
                      <div className="ml-auto">
                        <p className="text-xs text-muted-foreground">
                          Added {new Date(item.content.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </AppPageShell>
  );
}
