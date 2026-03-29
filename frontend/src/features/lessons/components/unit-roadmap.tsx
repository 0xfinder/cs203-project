import { Link } from "@tanstack/react-router";
import { Check, ChevronRight, Lock, Trash } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ProgressItem, UnitData } from "@/features/lessons/useLessonsApi";
import { getUnitRoadmap } from "@/features/lessons/lesson-roadmap";

type UnitRoadmapProps = {
  unit: UnitData;
  progressItems?: ProgressItem[];
  currentLessonId?: number;
  title?: string;
  interactive?: boolean;
  compact?: boolean;
  allowAllUnlocked?: boolean;
  headerAction?: React.ReactNode;
  onDeleteLesson?: (lessonId: number) => void;
};

export function UnitRoadmap({
  unit,
  progressItems,
  currentLessonId,
  title = "Unit Roadmap",
  interactive = false,
  compact = false,
  allowAllUnlocked = false,
  headerAction,
  onDeleteLesson,
}: UnitRoadmapProps) {
  const progressByLessonId = new Map(progressItems?.map((item) => [item.lessonId, item]) ?? []);
  const roadmap = getUnitRoadmap(unit, progressByLessonId, currentLessonId, allowAllUnlocked ?? false);

  // Merge any client-side placeholder lessons created for this real unit
  let mergedUnit = unit;
  if (typeof window !== "undefined") {
    try {
      const placeholders: any[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i) || "";
        if (!key.startsWith("tempPlaceholderUnit:")) continue;
        try {
          const raw = localStorage.getItem(key);
          if (!raw) continue;
          const parsed = JSON.parse(raw);
          if (parsed?.originalUnitId && parsed.originalUnitId === unit.id) {
            if (Array.isArray(parsed.lessons)) {
              placeholders.push(...parsed.lessons);
            }
          }
        } catch (e) {
          // ignore malformed
        }
      }
      if (placeholders.length > 0) {
        mergedUnit = { ...unit, lessons: [...(unit.lessons ?? []), ...placeholders] } as typeof unit;
      }
    } catch (e) {
      // ignore storage access
    }
  }

  const isPlaceholderLesson = (lesson: any) => {
    if (!lesson) return false;
    const title = String(lesson.title ?? "");
    const slug = String(lesson.slug ?? "");
    return title.startsWith("Placeholder Lesson") || slug.startsWith("placeholder-") || title === "Coming soon";
  };

  // Recompute roadmap using merged unit if placeholders exist
  const effectiveRoadmap = mergedUnit === unit ? roadmap : getUnitRoadmap(mergedUnit, progressByLessonId, currentLessonId, allowAllUnlocked ?? false);
  const displayItems = effectiveRoadmap.items.filter((item) => !isPlaceholderLesson(item.lesson));

  // Compute counts and percent using only non-placeholder lessons so placeholders
  // do not affect the displayed lesson counts or progress.
  const shownCompletedCount = displayItems.filter((item) => item.completed).length;
  const shownTotalLessons = displayItems.length;
  const shownPercentComplete = shownTotalLessons === 0 ? 0 : Math.round((shownCompletedCount / shownTotalLessons) * 100);

  return (
    <Card className="overflow-hidden border-border/70 bg-card shadow-sm">
      <CardHeader className="border-b border-border/70 bg-secondary/20">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.28em] text-muted-foreground">
              {title}
            </p>
            <CardTitle className="mt-2 text-xl leading-tight">{unit.title}</CardTitle>
            {unit.description ? (
              <p className="mt-2 max-w-sm text-sm text-muted-foreground">{unit.description}</p>
            ) : null}
            {headerAction ? <div className="mt-3">{headerAction}</div> : null}
          </div>

          <Badge
            variant="secondary"
            className="rounded-full border border-border bg-background px-3 py-1 text-[0.7rem] font-bold uppercase tracking-[0.18em] text-foreground"
          >
            {shownCompletedCount}/{shownTotalLessons}
          </Badge>
        </div>

        <div className="mt-4">
          <div className="h-2 overflow-hidden rounded-full bg-border/70">
            <div
              className="h-full rounded-full bg-chart-1/70 transition-all duration-500"
              style={{ width: `${shownPercentComplete}%` }}
            />
          </div>
          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {shownPercentComplete}% complete
          </p>
        </div>
      </CardHeader>

      <CardContent className={cn("space-y-3 p-4", compact && "space-y-2 p-3")}>
        {displayItems.map((item, index) => {
          const stepLabel = `${index + 1}`.padStart(2, "0");
          const body = (
            <div
              className={cn(
                "group relative flex items-center gap-3 rounded-2xl border px-3 py-3 transition-all",
                item.current && "border-chart-1/25 bg-chart-1/6",
                !item.current &&
                  item.unlocked &&
                  "border-border/70 bg-background hover:border-chart-1/20 hover:bg-secondary/20",
                !item.unlocked && "border-border/60 bg-secondary/20 opacity-70",
              )}
            >
              <div
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-2xl border text-sm font-black",
                  item.completed && "border-success/40 bg-success/15 text-success",
                  item.current && !item.completed && "border-chart-1/30 bg-background text-chart-1",
                  !item.current &&
                    !item.completed &&
                    item.unlocked &&
                    "border-border bg-card text-foreground",
                  !item.unlocked && "border-border bg-secondary text-muted-foreground",
                )}
              >
                {item.completed ? (
                  <Check className="size-4" />
                ) : item.unlocked ? (
                  stepLabel
                ) : (
                  <Lock className="size-4" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{item.lesson.title}</p>
                {item.lesson.learningObjective ? (
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {item.lesson.learningObjective}
                  </p>
                ) : (
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {item.lesson.description}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                {onDeleteLesson ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      onDeleteLesson(item.lesson.id);
                    }}
                    title="Delete subunit"
                    aria-label="Delete subunit"
                    className="inline-flex items-center justify-center rounded-full p-2 bg-destructive text-destructive-foreground hover:scale-105 transition-transform"
                  >
                    <Trash className="size-4" />
                  </button>
                ) : null}

                {item.unlocked ? (
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                ) : null}
              </div>
            </div>
          );

          if (!interactive) {
            return <div key={item.lesson.id}>{body}</div>;
          }

          if (!item.unlocked) {
            return <div key={item.lesson.id}>{body}</div>;
          }

          return (
            <Link
              key={item.lesson.id}
              to="/lesson/$lessonId"
              params={{ lessonId: String(item.lesson.id) }}
              preload={false}
              className="block"
            >
              {body}
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}
