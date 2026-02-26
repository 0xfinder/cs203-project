import { createFileRoute, Link } from "@tanstack/react-router";
import { Trophy, Flame, Star, Lock, ChevronRight, Lightbulb } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireOnboardingCompleted } from "@/lib/auth";
import { lessons } from "@/features/lessons/lessonData";
import { useLessonProgress } from "@/features/lessons/useLessonProgress";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/lessons")({
  beforeLoad: async () => {
    await requireOnboardingCompleted();
  },
  component: LessonsPage,
});

// s-curve offsets for the winding duolingo-style path (px)
const PATH_OFFSETS = [0, -56, 0, 56] as const;

function LessonsPage() {
  const { progress, streak, totalXP } = useLessonProgress();
  const completedCount = Object.values(progress).filter((p) => p.completed).length;

  const isUnlocked = (level: number) => {
    if (level === 1) return true;
    const prev = lessons.find((l) => l.level === level - 1);
    return prev ? progress[prev.id]?.completed === true : false;
  };

  // the first unlocked-but-incomplete lesson is the "current" one
  const currentLessonId = lessons.find(
    (l) => isUnlocked(l.level) && !progress[l.id]?.completed,
  )?.id;

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6">
      {/* stats badges */}
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

      {/* progress overview */}
      <Card className="mb-10">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Trophy className="size-5 text-chart-1" />
              <CardTitle className="text-lg">Your Progress</CardTitle>
            </div>
            <span className="text-sm font-semibold text-muted-foreground">
              {completedCount} / {lessons.length} Lessons
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-3 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-gradient-to-r from-chart-1 to-chart-5 transition-all duration-700"
              style={{ width: `${(completedCount / lessons.length) * 100}%` }}
            />
          </div>

          {completedCount === lessons.length && (
            <div className="mt-4 rounded-xl border-2 border-success bg-success/10 p-4 text-center">
              <p className="text-base font-bold">
                🎉 You&apos;re fluent in Gen Alpha! No cap, you slayed! 🔥
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* lesson path */}
      <h2 className="mb-6 text-center text-2xl font-bold">Lessons</h2>

      <div className="relative flex flex-col items-center pb-4">
        {lessons.map((lesson, i) => {
          const unlocked = isUnlocked(lesson.level);
          const completed = progress[lesson.id]?.completed === true;
          const isCurrent = lesson.id === currentLessonId;
          const lessonProgress = progress[lesson.id];
          const offset = PATH_OFFSETS[i % PATH_OFFSETS.length];

          return (
            <div key={lesson.id} className="flex flex-col items-center">
              {/* dotted connector */}
              {i > 0 && (
                <div className="flex flex-col items-center gap-1.5 py-1">
                  <span className="block h-1.5 w-1.5 rounded-full bg-border" />
                  <span className="block h-1.5 w-1.5 rounded-full bg-border" />
                  <span className="block h-1.5 w-1.5 rounded-full bg-border" />
                </div>
              )}

              {/* lesson node row */}
              <Link
                to="/lesson/$lessonId"
                params={{ lessonId: lesson.id }}
                preload={false}
                className={cn(
                  "group flex items-center gap-5 rounded-2xl p-2 transition-transform duration-200",
                  !unlocked && "pointer-events-none",
                  unlocked && "hover:scale-[1.03]",
                )}
                style={{ transform: `translateX(${offset}px)` }}
              >
                {/* orb */}
                <div
                  className={cn(
                    "relative flex size-20 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-4xl shadow-lg transition-shadow duration-200",
                    lesson.color,
                    !unlocked && "opacity-40 saturate-0",
                    unlocked && "group-hover:shadow-xl",
                    isCurrent && "ring-4 ring-ring/50",
                  )}
                >
                  {unlocked ? (
                    <span className="drop-shadow">{lesson.icon}</span>
                  ) : (
                    <Lock className="size-8 text-white/80" />
                  )}

                  {/* completed badge */}
                  {completed && (
                    <span className="absolute -right-1 -top-1 flex size-7 items-center justify-center rounded-full bg-success text-sm font-bold text-success-foreground shadow">
                      ✓
                    </span>
                  )}
                </div>

                {/* label */}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3
                      className={cn(
                        "text-base font-bold leading-tight",
                        !unlocked && "text-muted-foreground",
                      )}
                    >
                      {lesson.title}
                    </h3>
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                      Lv {lesson.level}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">{lesson.description}</p>

                  {lessonProgress && (
                    <p className="mt-1 text-xs text-muted-foreground/70">
                      Best: {lessonProgress.score}% · Attempts: {lessonProgress.attempts}
                    </p>
                  )}
                </div>

                {/* chevron for unlocked */}
                {unlocked && <ChevronRight className="size-5 shrink-0 text-muted-foreground/50" />}
              </Link>
            </div>
          );
        })}
      </div>

      {/* pro tips */}
      <Card className="mt-10 border-chart-1/20 bg-chart-1/5">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lightbulb className="size-5 text-chart-4" />
            <CardTitle className="text-base">Pro Tips</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="-mt-2 space-y-1.5 text-sm text-muted-foreground">
          <p>• Complete lessons in order to unlock new ones</p>
          <p>• You need at least 3/5 correct answers to pass</p>
          <p>• Retake lessons to improve your score and earn more XP</p>
          <p>• Build your streak by practicing daily! 🔥</p>
        </CardContent>
      </Card>
    </div>
  );
}
