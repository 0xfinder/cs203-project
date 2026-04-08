import { createFileRoute, Link } from "@tanstack/react-router";
import type { CSSProperties } from "react";
import { useState } from "react";
import {
  Trophy,
  Flame,
  Star,
  ChevronRight,
  Lightbulb,
  RotateCcw,
  BookOpenText,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminUnitsPanel } from "@/features/lessons/components/admin-units-panel";
import { requireContributorOrOnboarded } from "@/lib/auth";
import { getLeaderboard } from "@/lib/api";
import { cn } from "@/lib/utils";
import { getUnitRoadmap, getVisibleUnits, progressMap } from "@/features/lessons/lesson-roadmap";
import { useQuery } from "@tanstack/react-query";
import { optionalCurrentUserViewQueryOptions } from "@/lib/current-user-view";
import { useLessonProgress, useUnits } from "@/features/lessons/useLessonsApi";
import { AppPageShell } from "@/components/app-page-shell";

export const Route = createFileRoute("/lessons")({
  beforeLoad: async () => {
    await requireContributorOrOnboarded();
  },
  component: LearnPage,
});

const PATH_OFFSETS = [0, -56, 0, 56] as const;
const MOBILE_PATH_OFFSET_SCALE = 0.28;

function LearnPage() {
  const { data: units, isLoading: unitsLoading, error: unitsError } = useUnits();
  const {
    data: progressItems,
    isLoading: progressLoading,
    error: progressError,
  } = useLessonProgress();

  const currentUserViewQuery = useQuery(optionalCurrentUserViewQueryOptions());
  const profile = currentUserViewQuery.data?.profile ?? null;
  const role = profile?.role;
  const isAdmin = role === "ADMIN" || role === "MODERATOR";
  const isContributor = role === "CONTRIBUTOR" || role === "ADMIN" || role === "MODERATOR";
  const [activeTab, setActiveTab] = useState("learn");
  const leaderboardQuery = useQuery({
    queryKey: ["leaderboard", "points", "lessons-header"],
    queryFn: () => getLeaderboard(200, "points"),
    enabled: !!profile?.id,
  });

  if (unitsLoading || progressLoading) {
    return (
      <AppPageShell contentClassName="max-w-2xl">
        <div className="animate-pulse space-y-6">
          <div className="rounded-xl border bg-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="h-5 w-36 rounded-md bg-muted" />
              <div className="h-4 w-20 rounded-md bg-muted" />
            </div>
            <div className="flex gap-2">
              <div className="h-7 w-16 rounded-full bg-muted" />
              <div className="h-7 w-20 rounded-full bg-muted" />
            </div>
            <div className="h-3 w-full rounded-full bg-muted" />
          </div>
          <div className="h-7 w-24 mx-auto rounded-md bg-muted" />
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex items-center gap-4 rounded-2xl border bg-card p-3"
              style={{ marginLeft: i % 2 === 1 ? "3rem" : "0" }}
            >
              <div className="size-16 shrink-0 rounded-full bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/4 rounded-md bg-muted" />
                <div className="h-3 w-full rounded-md bg-muted" />
              </div>
            </div>
          ))}
        </div>
      </AppPageShell>
    );
  }

  if (unitsError || progressError || !units) {
    return (
      <AppPageShell contentClassName="max-w-2xl text-destructive">
        Failed to load units.
      </AppPageShell>
    );
  }

  const visibleUnits = getVisibleUnits(units);
  const progressByLessonId = progressMap(progressItems);
  const completedCount = visibleUnits.filter((unit) => {
    const roadmap = getUnitRoadmap(unit, progressByLessonId, undefined, isContributor);
    return roadmap.totalLessons > 0 && roadmap.completedCount === roadmap.totalLessons;
  }).length;
  const currentLeaderboardEntry =
    leaderboardQuery.data?.find((entry) => entry.userId === profile?.id) ?? null;
  const streak = currentLeaderboardEntry?.maxCorrectStreak ?? 0;
  const totalXP =
    currentLeaderboardEntry?.totalScore ??
    (progressItems ?? []).reduce((sum, item) => sum + item.bestScore, 0);

  const isUnlocked = () => true;

  const currentUnitId = visibleUnits.find((unit) => {
    const unlocked = isUnlocked();
    const roadmap = getUnitRoadmap(unit, progressByLessonId, undefined, isContributor);
    const completed = roadmap.totalLessons > 0 && roadmap.completedCount === roadmap.totalLessons;
    return unlocked && !completed;
  })?.id;

  const learnContent = (
    <>
      <Card className="mb-10">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Trophy className="size-5 text-chart-1" />
              <CardTitle className="text-lg">Your Progress</CardTitle>
            </div>
            <span className="text-sm font-semibold text-muted-foreground">
              {completedCount} / {visibleUnits.length} Units
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-full bg-orange-500/10 px-3 py-1.5 text-sm font-bold text-orange-600 dark:bg-orange-500/20 dark:text-orange-400">
              <Flame className="size-4" />
              <span>{streak}</span>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-yellow-500/10 px-3 py-1.5 text-sm font-bold text-yellow-600 dark:bg-yellow-500/20 dark:text-yellow-400">
              <Star className="size-4" />
              <span>{totalXP} XP</span>
            </div>
            {profile?.onboardingCompleted ? (
              <Button asChild size="sm" variant="outline" className="ml-auto">
                <Link to="/revise">
                  <RotateCcw className="size-4" />
                  Revise
                </Link>
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-3 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-gradient-to-r from-chart-1 to-chart-5 transition-all duration-700"
              style={{
                width: `${visibleUnits.length === 0 ? 0 : (completedCount / visibleUnits.length) * 100}%`,
              }}
            />
          </div>

          {visibleUnits.length > 0 && completedCount === visibleUnits.length && (
            <div className="mt-4 rounded-xl border-2 border-success bg-success/10 p-4 text-center">
              <p className="text-base font-bold">You completed every current unit.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <h2 className="mb-6 text-center text-2xl font-bold">Learn</h2>

      <div className="relative flex flex-col items-center pb-4">
        {visibleUnits.map((unit, index) => {
          const unlocked = isUnlocked();
          const roadmap = getUnitRoadmap(unit, progressByLessonId, undefined, isContributor);
          const completed =
            roadmap.totalLessons > 0 && roadmap.completedCount === roadmap.totalLessons;
          const isCurrent = unit.id === currentUnitId;
          const launchLesson = roadmap.nextLesson ?? null;
          const offset = PATH_OFFSETS[index % PATH_OFFSETS.length];
          const offsetStyle = {
            "--lesson-offset-mobile": `${Math.round(offset * MOBILE_PATH_OFFSET_SCALE)}px`,
            "--lesson-offset-desktop": `${offset}px`,
          } as CSSProperties;

          const lessonId =
            launchLesson?.id ?? roadmap.orderedLessons[0]?.id ?? unit.lessons[0]?.id ?? null;
          const lessonIdParam = lessonId ? String(lessonId) : null;

          const wrapperClass = cn(
            "group flex w-full max-w-[19rem] items-center gap-3 rounded-2xl p-2 transition-transform duration-200 translate-x-[var(--lesson-offset-mobile)] sm:max-w-none sm:gap-5 sm:translate-x-[var(--lesson-offset-desktop)]",
            !unlocked && "pointer-events-none",
            unlocked && "hover:scale-[1.03]",
          );

          const innerContent = (
            <>
              <div
                className={cn(
                  "relative flex size-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-green-400 to-emerald-500 text-2xl shadow-lg transition-shadow duration-200 sm:size-20",
                  unlocked && "group-hover:shadow-xl",
                  isCurrent && "ring-4 ring-ring/50",
                )}
              >
                <BookOpenText
                  className="size-7 text-white drop-shadow sm:size-9"
                  strokeWidth={2.25}
                />

                {completed && (
                  <span className="absolute -right-1 -top-1 flex size-6 items-center justify-center rounded-full bg-success text-xs font-bold text-success-foreground shadow ring-2 ring-background sm:size-7 sm:text-sm">
                    ✓
                  </span>
                )}
              </div>

              <div className="min-w-0">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                      #{unit.orderIndex}
                    </span>
                    <h3
                      className={cn(
                        "line-clamp-2 text-sm font-bold leading-tight sm:line-clamp-1 sm:text-base",
                      )}
                    >
                      {unit.title}
                    </h3>
                  </div>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                    {roadmap.completedCount}/{roadmap.totalLessons}
                  </span>
                </div>
                <p className="mt-0.5 text-xs leading-5 text-muted-foreground sm:text-sm">
                  {unit.description}
                </p>
              </div>

              {unlocked && lessonIdParam ? (
                <ChevronRight className="hidden size-5 shrink-0 text-muted-foreground/50 sm:block" />
              ) : null}
            </>
          );

          return (
            <div key={unit.id} className="flex flex-col items-center">
              {index > 0 ? (
                <div className="flex flex-col items-center gap-1.5 py-1">
                  <span className="block h-1.5 w-1.5 rounded-full bg-border" />
                  <span className="block h-1.5 w-1.5 rounded-full bg-border" />
                  <span className="block h-1.5 w-1.5 rounded-full bg-border" />
                </div>
              ) : null}

              {lessonIdParam ? (
                <Link
                  to="/lesson/$lessonId"
                  params={{ lessonId: lessonIdParam }}
                  preload={false}
                  className={wrapperClass}
                  style={offsetStyle}
                >
                  {innerContent}
                </Link>
              ) : (
                <div className={wrapperClass} style={offsetStyle}>
                  {innerContent}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Card className="mt-10 border-chart-1/20 bg-chart-1/5">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lightbulb className="size-5 text-chart-4" />
            <CardTitle className="text-base">Pro Tips</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="-mt-2 space-y-1.5 text-sm text-muted-foreground">
          <p>• All units are open, so you can learn in any order</p>
          <p>• Each unit launches the next lesson in that sequence</p>
          <p>• Your best scores and attempts still sync to your account</p>
        </CardContent>
      </Card>
    </>
  );

  return (
    <AppPageShell
      className={isAdmin && activeTab === "units" ? "px-4 py-6 lg:px-6" : undefined}
      contentClassName={isAdmin && activeTab === "units" ? "max-w-none" : "max-w-2xl"}
    >
      {isAdmin ? (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 rounded-2xl bg-muted/70 p-1">
            <TabsTrigger value="learn" className="rounded-xl">
              Learn
            </TabsTrigger>
            <TabsTrigger value="units" className="rounded-xl">
              Units
            </TabsTrigger>
          </TabsList>

          <TabsContent value="learn" className="mt-0">
            {learnContent}
          </TabsContent>
          <TabsContent value="units" className="mt-0">
            <AdminUnitsPanel units={units} />
          </TabsContent>
        </Tabs>
      ) : (
        learnContent
      )}
    </AppPageShell>
  );
}
