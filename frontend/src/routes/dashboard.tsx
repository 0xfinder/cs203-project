import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { requireOnboardingCompleted } from "@/lib/auth";
import { getMe } from "@/lib/me";
import { useMyApprovedContentsWithVotes } from "@/features/content/useContentData";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ThumbsUp, ThumbsDown } from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  beforeLoad: requireOnboardingCompleted,
  component: DashboardPage,
});

function DashboardPage() {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const { data: myContents, isLoading, error } = useMyApprovedContentsWithVotes(userEmail);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const me = await getMe();
        setUserEmail(me.email ?? null);
      } catch (e) {
        console.error("failed to fetch user data:", e);
        setUserEmail(null);
      }
    };
    void fetchUser();
  }, []);

  if (isLoading || userEmail === null) {
    return <div className="p-8 text-center">Loading your dashboard...</div>;
  }

  if (error) {
    return (
      <div className="p-8 text-center text-destructive">
        Error loading your content: {error instanceof Error ? error.message : "Unknown error"}
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
    <div className="flex-1 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">My Dashboard</h1>
        <p className="text-muted-foreground mb-8">
          Track your approved lingo and community engagement
        </p>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Submissions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{sortedContents.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Upvotes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <ThumbsUp className="w-5 h-5 text-green-600" />
                <span className="text-3xl font-bold text-green-600">{totalUpvotes}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Downvotes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <ThumbsDown className="w-5 h-5 text-red-600" />
                <span className="text-3xl font-bold text-red-600">{totalDownvotes}</span>
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
                You haven't submitted any approved lingo yet. Head to the <strong>Add</strong> page
                to get started!
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
                        <CardDescription className="mt-1">
                          {item.content.definition}
                        </CardDescription>
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
                          <p className="text-xs font-semibold text-muted-foreground mb-1">
                            Example
                          </p>
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
      </div>
    </div>
  );
}
