import { Link } from "@tanstack/react-router";
import { Check, ChevronRight, Lock, Sparkles } from "lucide-react";
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
};

export function UnitRoadmap({
  unit,
  progressItems,
  currentLessonId,
  title = "Unit Roadmap",
  interactive = false,
  compact = false,
}: UnitRoadmapProps) {
  const progressByLessonId = new Map(progressItems?.map((item) => [item.lessonId, item]) ?? []);
  const roadmap = getUnitRoadmap(unit, progressByLessonId, currentLessonId);

  return (
    <Card className="overflow-hidden border-chart-1/20 bg-card/90 shadow-[0_20px_60px_-40px_rgba(0,0,0,0.45)] backdrop-blur">
      <CardHeader className="border-b border-border/70 bg-[radial-gradient(circle_at_top_left,rgba(244,165,70,0.16),transparent_45%),linear-gradient(135deg,rgba(255,247,237,0.95),rgba(255,255,255,0.85))]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.28em] text-muted-foreground">
              {title}
            </p>
            <CardTitle className="mt-2 text-xl leading-tight">{unit.title}</CardTitle>
            {unit.description ? (
              <p className="mt-2 max-w-sm text-sm text-muted-foreground">{unit.description}</p>
            ) : null}
          </div>

          <Badge
            variant="secondary"
            className="rounded-full border border-chart-4/30 bg-chart-4/15 px-3 py-1 text-[0.7rem] font-bold uppercase tracking-[0.18em] text-chart-3"
          >
            {roadmap.completedCount}/{roadmap.totalLessons}
          </Badge>
        </div>

        <div className="mt-4">
          <div className="h-2 overflow-hidden rounded-full bg-secondary/80">
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,var(--color-chart-1),var(--color-chart-4),var(--color-chart-2))] transition-all duration-500"
              style={{ width: `${roadmap.percentComplete}%` }}
            />
          </div>
          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {roadmap.percentComplete}% complete
          </p>
        </div>
      </CardHeader>

      <CardContent className={cn("space-y-3 p-4", compact && "space-y-2 p-3")}>
        {roadmap.items.map((item, index) => {
          const stepLabel = `${index + 1}`.padStart(2, "0");
          const body = (
            <div
              className={cn(
                "group relative flex items-center gap-3 rounded-2xl border px-3 py-3 transition-all",
                item.current &&
                  "border-chart-1/35 bg-chart-1/8 shadow-[0_16px_35px_-26px_rgba(245,158,11,0.8)]",
                !item.current &&
                  item.unlocked &&
                  "border-border/70 bg-background/70 hover:border-chart-1/25 hover:bg-chart-1/5",
                !item.unlocked && "border-border/60 bg-muted/50 opacity-70",
              )}
            >
              <div
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-2xl border text-sm font-black",
                  item.completed && "border-success/40 bg-success/15 text-success",
                  item.current && !item.completed && "border-chart-1/40 bg-chart-1/15 text-chart-1",
                  !item.current &&
                    !item.completed &&
                    item.unlocked &&
                    "border-border bg-card text-foreground",
                  !item.unlocked && "border-border bg-muted text-muted-foreground",
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
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-bold">{item.lesson.title}</p>
                  {item.current ? (
                    <Badge
                      variant="outline"
                      className="rounded-full border-chart-1/30 bg-chart-1/10 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-chart-1"
                    >
                      live
                    </Badge>
                  ) : null}
                </div>
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

              {item.unlocked ? (
                <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              ) : null}
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

        {roadmap.nextLesson ? (
          <div className="rounded-2xl border border-chart-2/25 bg-chart-2/10 px-4 py-3 text-sm">
            <p className="flex items-center gap-2 font-bold text-foreground">
              <Sparkles className="size-4 text-chart-2" />
              Recommended next lesson
            </p>
            <p className="mt-1 text-muted-foreground">{roadmap.nextLesson.title}</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
