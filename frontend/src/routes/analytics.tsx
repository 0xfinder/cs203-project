import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { requireOnboardingCompleted } from "@/lib/auth";
import { AppPageShell } from "@/components/app-page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Bar, BarChart, XAxis, YAxis, CartesianGrid } from "recharts";
import { Star, Flame, Zap, BookOpen, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/analytics")({
  beforeLoad: async () => {
    await requireOnboardingCompleted();
  },
  component: AnalyticsPage,
});

type DailyXpEntry = { date: string; xp: number };
type WeeklyEntry = { weekStart: string; attempts: number; passed: number };
type UnitAccuracy = { unitTitle: string; correct: number; total: number; accuracyPct: number };
type UserAnalytics = {
  dailyXp: DailyXpEntry[];
  weeklyAttempts: WeeklyEntry[];
  unitAccuracy: UnitAccuracy[];
  totalAttempts: number;
  totalCorrect: number;
  totalQuestions: number;
  lessonsCompleted: number;
  maxStreak: number;
  currentStreak: number;
  avgTimeSeconds: number | null;
};

function formatDuration(seconds: number | null | undefined) {
  if (seconds == null) return "N/A";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}m ${secs}s`;
}

function shortDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00Z");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function shortWeek(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00Z");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

const dailyXpConfig = {
  xp: { label: "XP", color: "var(--color-primary)" },
} satisfies ChartConfig;

const weeklyConfig = {
  passed: { label: "Passed", color: "var(--color-primary)" },
  failed: { label: "Failed", color: "var(--color-muted-foreground)" },
} satisfies ChartConfig;

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4 text-center">
        <div className="mx-auto mb-1 w-fit">{icon}</div>
        <p className="text-2xl font-black text-primary">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      </CardContent>
    </Card>
  );
}

function AnalyticsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["analytics", "me"],
    queryFn: () => api.get("analytics/me").json<UserAnalytics>(),
  });

  if (isLoading) {
    return (
      <AppPageShell contentClassName="max-w-2xl">
        <div className="animate-pulse space-y-6">
          <div className="text-center">
            <div className="size-12 rounded-full bg-muted mx-auto mb-4" />
            <div className="h-8 w-56 rounded-md bg-muted mx-auto mb-2" />
            <div className="h-4 w-40 rounded-md bg-muted mx-auto" />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="rounded-xl border bg-card p-4">
                <div className="size-5 rounded-full bg-muted mx-auto mb-2" />
                <div className="h-6 w-12 rounded-md bg-muted mx-auto mb-1" />
                <div className="h-3 w-16 rounded-md bg-muted mx-auto" />
              </div>
            ))}
          </div>
          <div className="rounded-xl border bg-card p-4 h-52 bg-muted/20" />
          <div className="rounded-xl border bg-card p-4 h-52 bg-muted/20" />
        </div>
      </AppPageShell>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center text-destructive">
        Error loading analytics: {error instanceof Error ? error.message : "Unknown error"}
      </div>
    );
  }

  const accuracy =
    data && data.totalQuestions > 0
      ? Math.round((data.totalCorrect / data.totalQuestions) * 100)
      : null;

  // Last 14 days for daily XP chart
  const last14 = (data?.dailyXp ?? []).slice(-14).map((d) => ({
    date: shortDate(d.date),
    xp: d.xp,
  }));

  // Weekly chart data — split into passed/failed for stacked bars
  const weeklyData = (data?.weeklyAttempts ?? []).map((w) => ({
    week: shortWeek(w.weekStart),
    passed: w.passed,
    failed: w.attempts - w.passed,
  }));

  const totalXp = (data?.dailyXp ?? []).reduce((sum, d) => sum + d.xp, 0);
  const hasAnyXp = last14.some((d) => d.xp > 0);
  const hasAnyWeekly = weeklyData.some((d) => d.passed + d.failed > 0);

  const unitsSorted = [...(data?.unitAccuracy ?? [])].sort((a, b) => a.accuracyPct - b.accuracyPct);
  const weakestUnits = unitsSorted.slice(0, 3);
  const strongestUnits = [...(data?.unitAccuracy ?? [])].sort((a, b) => b.accuracyPct - a.accuracyPct).slice(0, 3);

  return (
    <AppPageShell contentClassName="max-w-2xl">
      <div className="text-center mb-6">
        <TrendingUp className="size-12 text-primary mx-auto mb-4" />
        <h1 className="text-3xl font-bold mb-2">My Progress</h1>
        <p className="text-muted-foreground">Track your learning journey</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-6">
        <StatCard
          icon={<Star className="size-5 text-yellow-500 fill-yellow-500" />}
          label="Total XP"
          value={totalXp.toLocaleString()}
        />
        <StatCard
          icon={<BookOpen className="size-5 text-primary" />}
          label="Lessons Done"
          value={data?.lessonsCompleted ?? 0}
        />
        <StatCard
          icon={<Flame className="size-5 text-orange-500 fill-orange-500" />}
          label="Best Streak"
          value={data?.maxStreak ?? 0}
        />
        <StatCard
          icon={<Zap className="size-5 text-blue-500" />}
          label="Avg Speed"
          value={formatDuration(data?.avgTimeSeconds)}
        />
      </div>

      {/* Overall accuracy bar */}
      {accuracy !== null && (
        <Card className="mb-6">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold">Overall Accuracy</p>
              <span className="text-sm font-bold text-primary">{accuracy}%</span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${accuracy}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              {data?.totalCorrect ?? 0} correct out of {data?.totalQuestions ?? 0} questions across{" "}
              {data?.totalAttempts ?? 0} attempts
            </p>
          </CardContent>
        </Card>
      )}

      {/* Daily XP chart */}
      <Card className="mb-6">
        <CardHeader className="pb-0 pt-4 px-4">
          <CardTitle className="text-sm font-semibold">Daily XP — last 14 days</CardTitle>
        </CardHeader>
        <CardContent className="px-2 pb-4 pt-2">
          {!hasAnyXp ? (
            <div className="h-44 flex items-center justify-center text-xs text-muted-foreground">
              No activity yet — complete a lesson to start tracking!
            </div>
          ) : (
            <ChartContainer config={dailyXpConfig} className="h-44 w-full">
              <BarChart data={last14} barCategoryGap="30%">
                <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.5} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                  width={28}
                />
                <ChartTooltip
                  cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                  content={<ChartTooltipContent hideLabel />}
                />
                <Bar
                  dataKey="xp"
                  radius={[4, 4, 0, 0]}
                  fill="var(--color-primary)"
                  fillOpacity={0.85}
                />
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      {/* Weekly activity chart */}
      <Card className="mb-6">
        <CardHeader className="pb-0 pt-4 px-4">
          <CardTitle className="text-sm font-semibold">Weekly Attempts — last 8 weeks</CardTitle>
        </CardHeader>
        <CardContent className="px-2 pb-4 pt-2">
          {!hasAnyWeekly ? (
            <div className="h-44 flex items-center justify-center text-xs text-muted-foreground">
              No attempts yet — start a lesson!
            </div>
          ) : (
            <>
              <ChartContainer config={weeklyConfig} className="h-44 w-full">
                <BarChart data={weeklyData} barCategoryGap="30%">
                  <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.5} />
                  <XAxis
                    dataKey="week"
                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                    tickLine={false}
                    axisLine={false}
                    width={20}
                  />
                  <ChartTooltip
                    cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                    content={<ChartTooltipContent />}
                  />
                  <Bar dataKey="passed" stackId="a" fill="var(--color-primary)" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="failed" stackId="a" fill="var(--color-muted-foreground)" fillOpacity={0.35} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
              <div className="flex items-center gap-4 mt-1 px-2">
                <div className="flex items-center gap-1.5">
                  <div className="size-2.5 rounded-sm bg-primary" />
                  <span className="text-xs text-muted-foreground">Passed</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="size-2.5 rounded-sm bg-foreground/25" />
                  <span className="text-xs text-muted-foreground">Failed</span>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Weakest / Strongest categories */}
      {(data?.unitAccuracy ?? []).length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mb-6">
          <Card className="border-red-200 dark:border-red-900/40">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold text-red-600 dark:text-red-400">
                Needs Work 📉
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              {weakestUnits.map((u) => (
                <div key={u.unitTitle}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium truncate mr-2">{u.unitTitle}</span>
                    <span className="text-muted-foreground shrink-0">{u.accuracyPct}%</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-red-400 transition-all"
                      style={{ width: `${u.accuracyPct}%` }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-green-200 dark:border-green-900/40">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold text-green-600 dark:text-green-400">
                You're Slay 📈
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              {strongestUnits.map((u) => (
                <div key={u.unitTitle}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium truncate mr-2">{u.unitTitle}</span>
                    <span className="text-muted-foreground shrink-0">{u.accuracyPct}%</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-green-500 transition-all"
                      style={{ width: `${u.accuracyPct}%` }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Current streak callout */}
      {(data?.currentStreak ?? 0) > 0 && (
        <Card className={cn(
          "border-orange-200 bg-orange-50 dark:border-orange-900/40 dark:bg-orange-950/20",
        )}>
          <CardContent className="py-4 px-4 flex items-center gap-3">
            <Flame className="size-8 text-orange-500 fill-orange-500 shrink-0" />
            <div>
              <p className="font-bold text-orange-700 dark:text-orange-400">
                {data?.currentStreak} question streak!
              </p>
              <p className="text-xs text-orange-600/80 dark:text-orange-500/70">
                Keep going! Your best is {data?.maxStreak}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </AppPageShell>
  );
}
