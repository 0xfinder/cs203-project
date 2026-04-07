import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getLeaderboard } from "@/lib/api";
import { requireOnboardingCompleted } from "@/lib/auth";
import { UserAvatar } from "@/components/user-avatar";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Trophy, Star, Flame, Zap, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";
import { AppPageShell } from "@/components/app-page-shell";

export const Route = createFileRoute("/leaderboard")({
  beforeLoad: async () => {
    await requireOnboardingCompleted();
  },
  component: LeaderboardPage,
});

function formatDuration(seconds: number | undefined) {
  if (seconds === undefined || seconds === null) return "N/A";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}m ${secs}s`;
}

function LeaderboardPage() {
  const [sortBy, setSortBy] = useState("points");

  const {
    data: leaderboard,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["leaderboard", sortBy],
    queryFn: () => getLeaderboard(50, sortBy),
  });

  if (isLoading) {
    return <div className="p-8 text-center">Loading rankings...</div>;
  }

  if (error) {
    return (
      <div className="p-8 text-center text-destructive">
        Error loading leaderboard: {error instanceof Error ? error.message : "Unknown error"}
      </div>
    );
  }

  const getMetricLabel = () => {
    switch (sortBy) {
      case "streak":
        return "Max Streak";
      case "speed":
        return "Avg Speed";
      default:
        return "Total XP";
    }
  };

  const getMetricIcon = () => {
    switch (sortBy) {
      case "streak":
        return <Flame className="size-3.5 text-orange-500 fill-orange-500" />;
      case "speed":
        return <Clock className="size-3.5 text-blue-500" />;
      default:
        return <Star className="size-3.5 text-yellow-500 fill-yellow-500" />;
    }
  };

  const getMetricValue = (entry: any) => {
    switch (sortBy) {
      case "streak":
        return `${entry.maxCorrectStreak || 0} 🔥`;
      case "speed":
        return formatDuration(entry.avgTimeSeconds);
      default:
        return entry.totalScore?.toLocaleString() || 0;
    }
  };

  return (
    <AppPageShell contentClassName="max-w-2xl">
      <div className="text-center mb-6">
        <Trophy className="size-12 text-yellow-500 mx-auto mb-4" />
        <h1 className="text-3xl font-bold mb-2">Global Leaderboard</h1>
        <p className="text-muted-foreground">Top learners in the community</p>
      </div>

      <div className="flex justify-center mb-8">
        <Tabs value={sortBy} onValueChange={setSortBy} className="w-full max-w-md">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="points">
              <Star className="size-4 mr-2" />
              Points
            </TabsTrigger>
            <TabsTrigger value="streak">
              <Flame className="size-4 mr-2" />
              Streak
            </TabsTrigger>
            <TabsTrigger value="speed">
              <Zap className="size-4 mr-2" />
              Speed
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <Card className="gap-0 overflow-hidden py-0">
        <CardHeader className="grid-rows-1 items-center gap-0 border-b bg-muted/30 px-4 py-4 [.border-b]:pb-4">
          <div className="grid grid-cols-[3rem_1fr_8rem] items-center text-sm font-semibold text-muted-foreground">
            <span className="flex items-center justify-center">Rank</span>
            <span className="flex items-center">User</span>
            <span className="flex items-center justify-end">{getMetricLabel()}</span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {leaderboard?.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No rankings available yet. Be the first to complete a lesson!
            </div>
          ) : (
            <div className="divide-y">
              {leaderboard?.map((entry, index) => {
                const isTopThree = index < 3;
                const rankIcon =
                  index === 0 ? (
                    <span className="text-xl">🥇</span>
                  ) : index === 1 ? (
                    <span className="text-xl">🥈</span>
                  ) : index === 2 ? (
                    <span className="text-xl">🥉</span>
                  ) : (
                    <span className="text-sm font-medium text-muted-foreground">{index + 1}</span>
                  );

                return (
                  <div
                    key={entry.userId}
                    className={cn(
                      "grid grid-cols-[3rem_1fr_8rem] items-center px-4 py-3 transition-colors",
                      isTopThree ? "bg-primary/5" : "hover:bg-muted/30",
                    )}
                  >
                    <div className="flex justify-center">{rankIcon}</div>
                    <div className="flex items-center gap-3 overflow-hidden">
                      <UserAvatar
                        name={entry.displayName || "Anonymous Learner"}
                        avatarPath={entry.avatarPath}
                        avatarColor={entry.avatarColor}
                      />
                      <span className="font-semibold truncate">
                        {entry.displayName || "Anonymous Learner"}
                      </span>
                    </div>
                    <div className="text-right flex items-center justify-end gap-1.5">
                      {getMetricIcon()}
                      <span className="font-bold text-primary">{getMetricValue(entry)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mt-8 text-center text-xs text-muted-foreground">
        <p>Rankings are updated in real-time based on your activity.</p>
      </div>
    </AppPageShell>
  );
}
