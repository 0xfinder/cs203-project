import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getLeaderboard } from "@/lib/api";
import { requireOnboardingCompleted } from "@/lib/auth";
import { UserAvatar } from "@/components/user-avatar";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Trophy, Star, Flame, Zap, Clock, User, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";
import { AppPageShell } from "@/components/app-page-shell";
import { optionalCurrentUserViewQueryOptions } from "@/lib/current-user-view";
import { Link } from "@tanstack/react-router";

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
  const [activeTab, setActiveTab] = useState<"global" | "me">("global");

  const currentUserViewQuery = useQuery(optionalCurrentUserViewQueryOptions());
  const profile = currentUserViewQuery.data?.profile ?? null;

  const {
    data: leaderboard,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["leaderboard", sortBy],
    queryFn: () => getLeaderboard(200, sortBy),
  });

  if (isLoading) {
    return (
      <AppPageShell contentClassName="max-w-2xl">
        <div className="animate-pulse">
          <div className="flex flex-col items-center mb-6 gap-3">
            <div className="size-12 rounded-full bg-muted" />
            <div className="h-8 w-48 rounded-md bg-muted" />
            <div className="h-4 w-40 rounded-md bg-muted" />
          </div>
          <div className="h-10 w-full max-w-md mx-auto rounded-lg bg-muted mb-8" />
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="border-b px-4 py-4 bg-muted/30">
              <div className="h-4 w-full rounded-md bg-muted" />
            </div>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3 border-b last:border-0">
                <div className="size-6 rounded-full bg-muted shrink-0" />
                <div className="size-9 rounded-full bg-muted shrink-0" />
                <div className="flex-1 h-4 rounded-md bg-muted" />
                <div className="h-4 w-16 rounded-md bg-muted" />
              </div>
            ))}
          </div>
        </div>
      </AppPageShell>
    );
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
        return entry.maxCorrectStreak || 0;
      case "speed":
        return formatDuration(entry.avgTimeSeconds);
      default:
        return entry.totalScore?.toLocaleString() || 0;
    }
  };

  const myEntry = leaderboard?.find((e) => e.userId === profile?.id) ?? null;
  const myRank = myEntry ? (leaderboard?.indexOf(myEntry) ?? -1) + 1 : null;

  return (
    <AppPageShell contentClassName="max-w-2xl">
      <div className="text-center mb-6">
        <Trophy className="size-12 text-yellow-500 mx-auto mb-4" />
        <h1 className="text-3xl font-bold mb-2">Leaderboard</h1>
        <p className="text-muted-foreground">Top learners in the community</p>
      </div>

      {/* Global / My Stats tabs */}
      <div className="flex justify-center mb-6">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "global" | "me")} className="w-full max-w-md">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="global">
              <Trophy className="size-4 mr-2" />
              Global
            </TabsTrigger>
            <TabsTrigger value="me" disabled={!profile}>
              <User className="size-4 mr-2" />
              My Stats
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {activeTab === "me" && profile && (
        <div className="space-y-4 mb-6">
          {myEntry ? (
            <>
              <Card>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-4">
                    <UserAvatar
                      name={profile.displayName || "Me"}
                      avatarPath={profile.avatarPath}
                      avatarColor={profile.avatarColor}
                      className="size-12"
                    />
                    <div>
                      <p className="font-bold">{profile.displayName || "Anonymous"}</p>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">{profile.role}</p>
                    </div>
                    {myRank && (
                      <div className="ml-auto text-right">
                        <p className="text-3xl font-black text-primary">#{myRank}</p>
                        <p className="text-xs text-muted-foreground">Global rank</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground px-1">vs. community</p>
                {(["points", "streak", "speed"] as const).map((metric) => {
                  const board = leaderboard ?? [];
                  const total = board.length;

                  const rank = metric === "points"
                    ? (board.findIndex((e) => e.userId === profile.id) ?? -1) + 1
                    : metric === "streak"
                    ? ([...board].sort((a, b) => (b.maxCorrectStreak ?? 0) - (a.maxCorrectStreak ?? 0)).findIndex((e) => e.userId === profile.id)) + 1
                    : ([...board].sort((a, b) => (a.avgTimeSeconds ?? 9999) - (b.avgTimeSeconds ?? 9999)).findIndex((e) => e.userId === profile.id)) + 1;

                  const topPct = total > 0 ? Math.max(1, Math.round((rank / total) * 100)) : 100;
                  const isFirst = rank === 1;

                  // Compute each player's position on 0–100 scale (higher = better)
                  const getPos = (e: typeof board[0]) => {
                    if (metric === "points") {
                      const max = Math.max(...board.map((x) => x.totalScore ?? 0), 1);
                      return ((e.totalScore ?? 0) / max) * 100;
                    }
                    if (metric === "streak") {
                      const max = Math.max(...board.map((x) => x.maxCorrectStreak ?? 0), 1);
                      return ((e.maxCorrectStreak ?? 0) / max) * 100;
                    }
                    // speed: lower time = rightmost (better)
                    const times = board.filter((x) => x.avgTimeSeconds != null).map((x) => x.avgTimeSeconds!);
                    if (times.length === 0) return 50;
                    const min = Math.min(...times);
                    const max = Math.max(...times);
                    if (max === min) return 100;
                    const t = e.avgTimeSeconds ?? max * 1.5;
                    return Math.max(0, Math.min(100, ((max - t) / (max - min)) * 100));
                  };

                  const icon = metric === "points"
                    ? <Star className="size-4 text-yellow-500 fill-yellow-500" />
                    : metric === "streak"
                    ? <Flame className="size-4 text-orange-500 fill-orange-500" />
                    : <Zap className="size-4 text-blue-500" />;
                  const label = metric === "points" ? "XP" : metric === "streak" ? "Streak" : "Speed";

                  return (
                    <Card key={metric} className={cn("overflow-hidden", isFirst && "border-yellow-400/60 bg-yellow-50/40 dark:bg-yellow-950/20")}>
                      <CardContent className="pt-3 pb-3 px-4">
                        <div className="flex items-center justify-between mb-3">
                          <span className="flex items-center gap-1.5 text-sm font-semibold">
                            {icon} {label}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                              Top {topPct}%
                            </span>
                            <span className={cn("text-xl font-black", isFirst ? "text-yellow-500" : "text-primary")}>
                              #{rank}
                              {isFirst && " 🏆"}
                            </span>
                            <span className="text-xs text-muted-foreground">/ {total}</span>
                          </div>
                        </div>

                        {/* distribution track — every player is a dot at their real position */}
                        <div className="relative h-5 my-1">
                          <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 bg-muted rounded-full" />
                          {board.map((entry) => {
                            const raw = getPos(entry);
                            // clamp to 2–98% so dots at edges don't get clipped
                            const pos = 2 + (raw / 100) * 96;
                            const isMe = entry.userId === profile.id;
                            return (
                              <div
                                key={entry.userId}
                                title={isMe ? "You" : (entry.displayName || "Player")}
                                className={cn(
                                  "absolute rounded-full -translate-x-1/2 -translate-y-1/2",
                                  isMe
                                    ? cn("size-4 border-2 border-background shadow-lg z-10 ring-2",
                                        isFirst ? "bg-yellow-400 ring-yellow-300" : "bg-primary ring-primary/40")
                                    : "size-1.5 bg-foreground/25 z-0",
                                )}
                                style={{ left: `${pos}%`, top: "50%" }}
                              />
                            );
                          })}
                        </div>

                        <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
                          <span>Lowest</span>
                          <span>Highest</span>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
              <Link
                to="/analytics"
                className="flex items-center justify-between rounded-xl border bg-card px-4 py-3 text-sm transition-colors hover:bg-muted/40"
              >
                <span className="flex items-center gap-2 font-medium">
                  <TrendingUp className="size-4 text-primary" />
                  View full progress breakdown
                </span>
                <span className="text-muted-foreground">→</span>
              </Link>
            </>
          ) : (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground text-sm">
                Complete a lesson to appear on the leaderboard!
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {activeTab === "global" && (
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
      )}

      {activeTab === "global" && (
        <>
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
        </>
      )}
    </AppPageShell>
  );
}
