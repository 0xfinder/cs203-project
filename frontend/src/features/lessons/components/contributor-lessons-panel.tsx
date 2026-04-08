import { useEffect, useMemo, useState } from "react";
import { BookText, Clock3, FileText, ListChecks, Send, Trash2 } from "lucide-react";
import { LessonForm } from "@/components/lesson-quiz-forms";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type LessonDetail,
  type LessonStepPayload,
  type LessonSummary,
  useDeleteLesson,
  useLessonForEdit,
  useMyLessons,
  useUnits,
} from "@/features/lessons/useLessonsApi";
import { cn } from "@/lib/utils";

type LessonStatusFilter = "DRAFT" | "PENDING_REVIEW" | "REJECTED";

const STATUS_LABELS: Record<LessonStatusFilter, string> = {
  DRAFT: "Drafts",
  PENDING_REVIEW: "Pending Review",
  REJECTED: "Rejected",
};

const STATUS_BADGE_STYLES: Record<LessonStatusFilter, string> = {
  DRAFT: "border-sky-200 bg-sky-50 text-sky-800",
  PENDING_REVIEW: "border-amber-200 bg-amber-50 text-amber-800",
  REJECTED: "border-rose-200 bg-rose-50 text-rose-800",
};

function getLessonStatusBadgeStyle(status: LessonSummary["status"]) {
  if (status === "PENDING_REVIEW") {
    return STATUS_BADGE_STYLES.PENDING_REVIEW;
  }

  if (status === "REJECTED") {
    return STATUS_BADGE_STYLES.REJECTED;
  }

  return STATUS_BADGE_STYLES.DRAFT;
}

export function ContributorLessonsPanel() {
  const { data: lessons, isLoading } = useMyLessons();
  const { data: units } = useUnits();
  const deleteLesson = useDeleteLesson();

  const [activeStatus, setActiveStatus] = useState<LessonStatusFilter>("DRAFT");
  const [selectedLessonId, setSelectedLessonId] = useState<number | null>(null);

  const lessonsByStatus = useMemo(() => {
    const grouped: Record<LessonStatusFilter, LessonSummary[]> = {
      DRAFT: [],
      PENDING_REVIEW: [],
      REJECTED: [],
    };

    for (const lesson of lessons ?? []) {
      if (
        lesson.status === "DRAFT" ||
        lesson.status === "PENDING_REVIEW" ||
        lesson.status === "REJECTED"
      ) {
        grouped[lesson.status].push(lesson);
      }
    }

    return grouped;
  }, [lessons]);

  const visibleLessons = lessonsByStatus[activeStatus];
  const selectedLesson = visibleLessons.find((lesson) => lesson.id === selectedLessonId) ?? null;
  const selectedDetailQuery = useLessonForEdit(selectedLessonId ?? 0);

  const unitTitleById = useMemo(() => {
    return new Map((units ?? []).map((unit) => [unit.id, unit.title]));
  }, [units]);

  useEffect(() => {
    if (selectedLessonId && visibleLessons.some((lesson) => lesson.id === selectedLessonId)) {
      return;
    }

    setSelectedLessonId(visibleLessons[0]?.id ?? null);
  }, [selectedLessonId, visibleLessons]);

  async function handleDeleteLesson(lessonId: number) {
    if (!window.confirm("Delete this lesson draft? This cannot be undone.")) {
      return;
    }

    try {
      await deleteLesson.mutateAsync(lessonId);
      setSelectedLessonId((current) => (current === lessonId ? null : current));
    } catch (error) {
      console.error("failed to delete contributor lesson:", error);
      window.alert("Could not delete this lesson right now.");
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-border/70 bg-[linear-gradient(135deg,theme(colors.chart.1/0.08),transparent_42%),linear-gradient(180deg,theme(colors.card),theme(colors.card))] p-6 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <BookText className="size-6" />
            </div>
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">My Lessons</h2>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                Keep draft work in progress here, resubmit rejected lessons after revision, and
                monitor what is waiting on moderation without hunting through other pages.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {(Object.keys(STATUS_LABELS) as LessonStatusFilter[]).map((status) => (
              <button
                key={status}
                type="button"
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                  activeStatus === status
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-foreground hover:bg-accent",
                )}
                onClick={() => setActiveStatus(status)}
              >
                {STATUS_LABELS[status]}
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs",
                    activeStatus === status ? "bg-primary-foreground/15" : "bg-muted",
                  )}
                >
                  {lessonsByStatus[status].length}
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="overflow-hidden border-border/70 py-0 shadow-sm">
          <div className="flex min-h-20 items-center border-b border-border/70 bg-secondary/25 px-6">
            <CardTitle className="text-base">{STATUS_LABELS[activeStatus]}</CardTitle>
          </div>
          <CardContent className="p-3">
            {isLoading ? (
              <div className="rounded-2xl border border-dashed border-border/80 px-4 py-6 text-sm text-muted-foreground">
                Loading your lessons...
              </div>
            ) : visibleLessons.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/80 px-4 py-6 text-sm text-muted-foreground">
                No lessons in this lane yet.
              </div>
            ) : (
              <div className="space-y-2">
                {visibleLessons.map((lesson) => {
                  const selected = lesson.id === selectedLessonId;
                  return (
                    <button
                      key={lesson.id}
                      type="button"
                      onClick={() => setSelectedLessonId(lesson.id)}
                      className={cn(
                        "w-full rounded-2xl border px-4 py-4 text-left transition-colors",
                        selected
                          ? "border-primary bg-primary/6 shadow-sm"
                          : "border-border/70 bg-background hover:bg-accent/40",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{lesson.title}</p>
                          <p className="mt-1 truncate text-xs uppercase tracking-[0.16em] text-muted-foreground">
                            {unitTitleById.get(lesson.unitId) ?? `Unit ${lesson.unitId}`}
                          </p>
                        </div>
                        <Badge
                          className={cn(
                            "border font-medium",
                            getLessonStatusBadgeStyle(lesson.status),
                          )}
                        >
                          {lesson.status === "PENDING_REVIEW"
                            ? "Pending"
                            : lesson.status.toLowerCase()}
                        </Badge>
                      </div>
                      <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">
                        {lesson.learningObjective || lesson.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="min-w-0">
          {!selectedLesson ? (
            <Card className="border-border/70 shadow-sm">
              <CardContent className="flex min-h-[420px] flex-col items-center justify-start px-6 py-12 text-center">
                <div className="flex size-14 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
                  <FileText className="size-6" />
                </div>
                <h3 className="mt-4 text-lg font-semibold">Select a lesson</h3>
                <p className="mt-2 max-w-md text-sm text-muted-foreground">
                  Pick a lesson from the left to continue editing or to inspect what is waiting for
                  review.
                </p>
              </CardContent>
            </Card>
          ) : selectedLesson.status === "PENDING_REVIEW" ? (
            <PendingLessonView
              lesson={selectedLesson}
              detail={selectedDetailQuery.data}
              isLoading={selectedDetailQuery.isLoading}
              unitTitle={
                unitTitleById.get(selectedLesson.unitId) ?? `Unit ${selectedLesson.unitId}`
              }
            />
          ) : (
            <div className="space-y-4">
              <Card className="border-border/70 shadow-sm">
                <CardContent className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        className={cn(
                          "border font-medium",
                          getLessonStatusBadgeStyle(selectedLesson.status),
                        )}
                      >
                        {selectedLesson.status === "REJECTED" ? "Rejected" : "Draft"}
                      </Badge>
                      <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        {unitTitleById.get(selectedLesson.unitId) ??
                          `Unit ${selectedLesson.unitId}`}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold">{selectedLesson.title}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Save changes here or send the lesson back into moderation once the steps are
                        ready.
                      </p>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2 text-destructive hover:text-destructive"
                    disabled={deleteLesson.isPending}
                    onClick={() => void handleDeleteLesson(selectedLesson.id)}
                  >
                    <Trash2 className="size-4" />
                    Delete lesson
                  </Button>
                </CardContent>
              </Card>

              <LessonForm lessonId={selectedLesson.id} onSaved={() => void 0} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PendingLessonView({
  lesson,
  detail,
  isLoading,
  unitTitle,
}: {
  lesson: LessonSummary;
  detail?: LessonDetail;
  isLoading: boolean;
  unitTitle: string;
}) {
  return (
    <div className="space-y-4">
      <Card className="border-border/70 shadow-sm">
        <CardContent className="px-6 py-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={cn("border font-medium", STATUS_BADGE_STYLES.PENDING_REVIEW)}>
              Pending Review
            </Badge>
            <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              {unitTitle}
            </span>
          </div>
          <h3 className="mt-3 text-xl font-semibold">{lesson.title}</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            This submission is read-only while moderators decide whether it should go live. If it is
            rejected, it will return here for revision.
          </p>
          <div className="mt-4 flex flex-wrap gap-3 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              <Clock3 className="size-4" />
              {lesson.estimatedMinutes ? `${lesson.estimatedMinutes} min` : "No duration set"}
            </span>
            <span className="inline-flex items-center gap-2">
              <Send className="size-4" />
              Awaiting moderation
            </span>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/70 shadow-sm">
        <CardHeader className="border-b border-border/70 bg-secondary/20 pb-4">
          <CardTitle className="text-base">Submission Snapshot</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 px-6 py-5">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading submission details...</p>
          ) : detail ? (
            <>
              <div className="space-y-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    Lesson summary
                  </p>
                  <p className="mt-2 text-sm leading-6 text-foreground">{detail.description}</p>
                </div>
                {detail.learningObjective ? (
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      Learning objective
                    </p>
                    <p className="mt-2 text-sm leading-6 text-foreground">
                      {detail.learningObjective}
                    </p>
                  </div>
                ) : null}
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <ListChecks className="size-4 text-muted-foreground" />
                  <p className="text-sm font-semibold">Lesson steps</p>
                </div>
                <div className="space-y-3">
                  {detail.steps.map((step, index) => {
                    const summary = summarizeLiveStep(step);
                    return (
                      <div
                        key={step.id}
                        className="rounded-2xl border border-border/70 bg-background px-4 py-4"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary">Step {index + 1}</Badge>
                          <Badge variant="outline">{summary.label}</Badge>
                        </div>
                        <p className="mt-3 font-semibold">{summary.title}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{summary.detail}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Lesson details are unavailable right now.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function summarizeLiveStep(step: LessonStepPayload) {
  if (step.stepType === "TEACH") {
    return {
      label: "Learn",
      title: readStringField(step, "title") ?? step.vocab?.term ?? "Learn step",
      detail: readStringField(step, "body") ?? step.vocab?.definition ?? "No teaching copy yet.",
    };
  }

  if (step.stepType === "DIALOGUE") {
    return {
      label: "Dialogue",
      title: "Dialogue",
      detail: step.dialogueText?.split("\n")[0] ?? "No dialogue yet.",
    };
  }

  if (step.stepType === "QUESTION") {
    return {
      label: "Question",
      title:
        step.question?.questionType === "MCQ"
          ? "Multiple choice"
          : step.question?.questionType === "MATCH"
            ? "Matching"
            : "Short answer",
      detail: step.question?.prompt ?? "No prompt yet.",
    };
  }

  return {
    label: "Recap",
    title: readStringField(step, "headline") ?? "Recap",
    detail: readStringField(step, "summary") ?? "No summary yet.",
  };
}

function readStringField(step: LessonStepPayload, key: string) {
  const value = step.payload?.[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}
