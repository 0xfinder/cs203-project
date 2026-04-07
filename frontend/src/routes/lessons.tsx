import { createFileRoute, Link } from "@tanstack/react-router";
import type { CSSProperties } from "react";
import { useState } from "react";
import { Trophy, Flame, Star, Lock, ChevronRight, Lightbulb } from "lucide-react";
import Dialog, { DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LessonForm } from "@/components/lesson-quiz-forms";
import { AdminUnitsPanel } from "@/features/lessons/components/admin-units-panel";
import { requireContributorOrOnboarded } from "@/lib/auth";
import { getLeaderboard } from "@/lib/api";
import { cn } from "@/lib/utils";
import { getUnitRoadmap, getVisibleUnits, progressMap } from "@/features/lessons/lesson-roadmap";
import { useQuery } from "@tanstack/react-query";
import { optionalCurrentUserViewQueryOptions } from "@/lib/current-user-view";
import { useLessonProgress, useUnits } from "@/features/lessons/useLessonsApi";

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
      <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6">Loading units...</div>
    );
  }

  if (unitsError || progressError || !units) {
    return (
      <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 text-destructive sm:px-6">
        Failed to load units.
      </div>
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

  const isUnlocked = (index: number) => {
    if (isContributor) return true;
    if (index === 0) return true;
    const previousUnit = visibleUnits[index - 1];
    const previousRoadmap = getUnitRoadmap(previousUnit, progressByLessonId, undefined, false);
    return (
      previousRoadmap.totalLessons > 0 &&
      previousRoadmap.completedCount === previousRoadmap.totalLessons
    );
  };

  const currentUnitId = visibleUnits.find((unit, index) => {
    const unlocked = isUnlocked(index);
    const roadmap = getUnitRoadmap(unit, progressByLessonId, undefined, isContributor);
    const completed = roadmap.totalLessons > 0 && roadmap.completedCount === roadmap.totalLessons;
    return unlocked && !completed;
  })?.id;

  const learnContent = (
    <>
      <div className="mb-6 flex items-center justify-center gap-3">
        <div className="flex items-center gap-2 rounded-full bg-orange-500/10 px-4 py-2 text-sm font-bold text-orange-600 dark:bg-orange-500/20 dark:text-orange-400">
          <Flame className="size-5" />
          <span>{streak}</span>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-yellow-500/10 px-4 py-2 text-sm font-bold text-yellow-600 dark:bg-yellow-500/20 dark:text-yellow-400">
          <Star className="size-5" />
          <span>{totalXP} XP</span>
        </div>
      </div>

      <Card className="mb-10">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Trophy className="size-5 text-chart-1" />
              <CardTitle className="text-lg">Your Progress</CardTitle>
            </div>
            <span className="text-sm font-semibold text-muted-foreground">
              {completedCount} / {visibleUnits.length} Units
            </span>
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
          const unlocked = isUnlocked(index);
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
                  !unlocked && "opacity-40 saturate-0",
                  unlocked && "group-hover:shadow-xl",
                  isCurrent && "ring-4 ring-ring/50",
                )}
              >
                {unlocked ? (
                  <span className="drop-shadow">📘</span>
                ) : (
                  <Lock className="size-6 text-white/80 sm:size-8" />
                )}

                {completed && (
                  <span className="absolute -right-1 -top-1 flex size-6 items-center justify-center rounded-full bg-success text-xs font-bold text-success-foreground shadow sm:size-7 sm:text-sm">
                    ✓
                  </span>
                )}
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3
                    className={cn(
                      "text-sm font-bold leading-tight sm:text-base",
                      !unlocked && "text-muted-foreground",
                    )}
                  >
                    {unit.title}
                  </h3>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                    #{unit.orderIndex}
                  </span>
                </div>
                <p className="mt-0.5 text-xs leading-5 text-muted-foreground sm:text-sm">
                  {unit.description}
                </p>
                <p className="mt-1 text-[11px] leading-4 text-muted-foreground/70 sm:text-xs">
                  {roadmap.completedCount}/{roadmap.totalLessons} lessons
                  {roadmap.nextLesson ? ` · Next: ${roadmap.nextLesson.title}` : ""}
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
          <p>• Complete units in order to unlock new ones</p>
          <p>• Each unit launches the next lesson in that sequence</p>
          <p>• Your best scores and attempts still sync to your account</p>
        </CardContent>
      </Card>
    </>
  );

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6">
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

      {isContributor ? (
        <div className="fixed bottom-6 right-6 z-30 sm:bottom-8 sm:right-8">
          <Dialog>
            <DialogTrigger asChild>
              <Button size="lg" className="rounded-full px-5 shadow-xl">
                Add Lesson
              </Button>
            </DialogTrigger>
            <DialogContent
              title="Add Lesson"
              description="Build the lesson and submit it for review."
              className="max-h-[92vh] max-w-5xl overflow-y-auto"
            >
              <LessonForm />
            </DialogContent>
          </Dialog>
        </div>
      ) : null}
    </div>
  );
}
