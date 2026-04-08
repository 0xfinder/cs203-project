import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { HTTPError } from "ky";
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Dialog, { DialogTrigger, DialogContent } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { UnitRoadmap } from "@/features/lessons/components/unit-roadmap";
import { getUnitRoadmap, progressMap } from "@/features/lessons/lesson-roadmap";
import { requireContributorOrOnboarded } from "@/lib/auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { optionalCurrentUserViewQueryOptions } from "@/lib/current-user-view";
import {
  type AttemptResult,
  type LessonAnswer,
  type LessonStepPayload,
  useLessonPlay,
  useLessonForEdit,
  useLessonProgress,
  useUpdateLessonProgress,
  useSubmitLessonAttempt,
  useUnits,
  useDeleteStep,
  usePatchStep,
  useDeleteLesson,
} from "@/features/lessons/useLessonsApi";
import { QuestionStep } from "@/features/lessons/components/question-step";
import { LessonForm } from "@/components/lesson-quiz-forms";

export const Route = createFileRoute("/lesson/$lessonId")({
  beforeLoad: async () => {
    await requireContributorOrOnboarded();
  },
  component: LessonPage,
});

function LessonPage() {
  const navigate = useNavigate();
  const { lessonId } = Route.useParams();
  const numericLessonId = Number(lessonId);
  const hasValidLessonId = Number.isInteger(numericLessonId) && numericLessonId > 0;

  const { data, isLoading } = useLessonPlay(numericLessonId);
  const { data: editData } = useLessonForEdit(numericLessonId);
  const { data: units, refetch: refetchUnits } = useUnits();
  const { data: progressItems } = useLessonProgress();
  const submitAttempt = useSubmitLessonAttempt();
  const updateProgress = useUpdateLessonProgress();
  const deleteLesson = useDeleteLesson();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answersByStep, setAnswersByStep] = useState<Record<number, LessonAnswer>>({});
  const [tempAnswer, setTempAnswer] = useState<LessonAnswer>("");
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const startedAtRef = useRef<string>(new Date().toISOString());
  const progressThrottleMs = 1200;
  const lastProgressSentAtRef = useRef(0);
  const pendingProgressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resumeAppliedRef = useRef(false);

  useEffect(() => {
    setCurrentIndex(0);
    setAnswersByStep({});
    setTempAnswer("");
    setResult(null);
    setSubmitError(null);
    lastProgressSentAtRef.current = 0;
    resumeAppliedRef.current = false;
    startedAtRef.current = new Date().toISOString();
    if (pendingProgressTimerRef.current) {
      clearTimeout(pendingProgressTimerRef.current);
      pendingProgressTimerRef.current = null;
    }
  }, [numericLessonId]);

  useEffect(() => {
    return () => {
      if (pendingProgressTimerRef.current) {
        clearTimeout(pendingProgressTimerRef.current);
        pendingProgressTimerRef.current = null;
      }
    };
  }, []);
  const lessonData = data;
  const steps: LessonStepPayload[] = lessonData?.steps ?? [];

  const currentStep = steps[currentIndex];
  const questionSteps = useMemo(
    () => steps.filter((step) => step.stepType === "QUESTION"),
    [steps],
  );
  const progressByLessonId = useMemo(() => progressMap(progressItems), [progressItems]);
  const currentUnit = useMemo(() => {
    if (!units) return null;
    return (
      units.find((unit) => unit.lessons?.some((lesson) => lesson.id === numericLessonId)) ?? null
    );
  }, [units, numericLessonId]);
  const displayUnit = useMemo(() => {
    if (!currentUnit) return null;
    const lessons = Array.isArray(currentUnit?.lessons) ? currentUnit.lessons : [];
    const isPlaceholder = (lesson: any) => {
      const title = String(lesson?.title ?? "");
      const slug = String(lesson?.slug ?? "");
      const description = String(lesson?.description ?? "");
      return (
        title.startsWith("Placeholder Lesson") ||
        slug.startsWith("placeholder-") ||
        title === "Coming soon" ||
        title.startsWith("New Lesson") ||
        slug.startsWith("new-lesson-") ||
        description === "Coming soon"
      );
    };
    const filtered = lessons.filter((l: any) => {
      // Show placeholder lessons
      if (isPlaceholder(l)) return true;
      // Show approved/published lessons, hide DRAFT/PENDING_REVIEW/REJECTED
      if (l.status === "DRAFT" || l.status === "PENDING_REVIEW" || l.status === "REJECTED")
        return false;
      // Show everything else (published, approved, etc.)
      return true;
    });

    return filtered.length > 0
      ? ({ ...currentUnit, lessons: filtered } as typeof currentUnit)
      : ({ ...currentUnit, lessons: [] } as typeof currentUnit);
  }, [currentUnit]);

  const unitRoadmap = useMemo(
    () => (displayUnit ? getUnitRoadmap(displayUnit, progressByLessonId, numericLessonId) : null),
    [displayUnit, progressByLessonId, numericLessonId],
  );

  const nextLesson = useMemo(() => {
    if (!unitRoadmap) {
      return null;
    }

    const currentLessonIndex = unitRoadmap.orderedLessons.findIndex(
      (lesson) => lesson.id === numericLessonId,
    );

    if (currentLessonIndex < 0) {
      return null;
    }

    return unitRoadmap.orderedLessons[currentLessonIndex + 1] ?? null;
  }, [unitRoadmap, numericLessonId]);

  const currentUserViewQuery = useQuery(optionalCurrentUserViewQueryOptions());
  const currentRole = currentUserViewQuery.data?.profile?.role;
  const isContributor = currentRole === "CONTRIBUTOR";
  const isAdmin = currentRole === "ADMIN" || currentRole === "MODERATOR";

  const handleDeleteLesson = (lessonIdToDelete: number) => {
    try {
      if (!window.confirm("Delete this lesson? This cannot be undone.")) return;
      void deleteLesson.mutateAsync(lessonIdToDelete).then(() => {
        void refetchUnits();
        if (lessonIdToDelete === numericLessonId) {
          void navigate({ to: "/lessons" });
        }
      });
    } catch (e) {
      console.error("failed to delete lesson:", e);
      // ignore
    }
  };

  useEffect(() => {
    if (!currentStep || currentStep.stepType !== "QUESTION") {
      setTempAnswer("");
      return;
    }

    const existingAnswer = answersByStep[currentStep.id];
    if (existingAnswer !== undefined) {
      setTempAnswer(existingAnswer);
      return;
    }

    if (currentStep.question?.questionType === "MATCH") {
      setTempAnswer({});
      return;
    }

    setTempAnswer("");
  }, [currentStep, answersByStep]);

  useEffect(() => {
    if (resumeAppliedRef.current) {
      return;
    }
    if (!lessonData || steps.length === 0) {
      return;
    }

    const progressItem = progressItems?.find((item) => item.lessonId === numericLessonId);
    if (!progressItem?.lastStepId || progressItem.completedAt) {
      resumeAppliedRef.current = true;
      return;
    }

    const lastStepIndex = steps.findIndex((step) => step.id === progressItem.lastStepId);
    if (lastStepIndex < 0) {
      resumeAppliedRef.current = true;
      return;
    }

    const resumeIndex = Math.min(lastStepIndex + 1, steps.length - 1);
    setCurrentIndex(resumeIndex);
    resumeAppliedRef.current = true;
  }, [lessonData, steps, progressItems, numericLessonId]);

  if (!hasValidLessonId) {
    return (
      <div className="flex flex-1 items-center justify-center bg-background px-4">
        <div className="text-center">
          <p className="text-xl text-muted-foreground">Invalid lesson ID</p>
          <Button className="mt-4" onClick={() => navigate({ to: "/lessons" })}>
            Back to Learn
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return <div className="p-8 text-center">Loading lesson...</div>;
  }

  if (!lessonData) {
    return (
      <div className="flex flex-1 items-center justify-center bg-background px-4">
        <div className="text-center">
          <p className="text-xl text-muted-foreground">Lesson not found</p>
          <Button className="mt-4" onClick={() => navigate({ to: "/lessons" })}>
            Back to Learn
          </Button>
        </div>
      </div>
    );
  }

  if (!currentStep) {
    return (
      <div className="flex flex-1 items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <h2 className="text-xl font-semibold">Lesson Content Coming Soon</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              This lesson exists, but no steps have been published yet.
            </p>
            <Button className="mt-4" onClick={() => navigate({ to: "/lessons" })}>
              Back to Learn
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (result) {
    return (
      <ResultView
        result={result}
        lessonTitle={lessonData.lesson.title}
        unitTitle={currentUnit?.title ?? null}
        questionSteps={questionSteps}
        nextLessonTitle={result.passed ? (nextLesson?.title ?? null) : null}
        onRetry={() => {
          setCurrentIndex(0);
          setAnswersByStep({});
          setTempAnswer("");
          setResult(null);
          setSubmitError(null);
        }}
        onExit={() => {
          void navigate({ to: "/lessons" });
        }}
        onContinue={
          result.passed && nextLesson && !isAdmin && !isContributor
            ? () => {
                void navigate({
                  to: "/lesson/$lessonId",
                  params: { lessonId: String(nextLesson.id) },
                });
              }
            : undefined
        }
      />
    );
  }

  const isLast = currentIndex === steps.length - 1;
  const progressPercent = ((currentIndex + 1) / steps.length) * 100;

  const canContinue = (() => {
    if (currentStep.stepType !== "QUESTION") return true;
    if (currentStep.question?.questionType === "MATCH") {
      if (typeof tempAnswer === "string") return false;
      const requiredPairs = currentStep.question.matchPairs.length;
      const filled = currentStep.question.matchPairs.filter((pair) => {
        const value = tempAnswer[pair.left];
        return typeof value === "string" && value.trim().length > 0;
      }).length;
      return requiredPairs > 0 && filled === requiredPairs;
    }
    return typeof tempAnswer === "string" && tempAnswer.trim().length > 0;
  })();

  const persistCurrentAnswer = () => {
    if (currentStep.stepType !== "QUESTION") return;
    const normalizedAnswer = typeof tempAnswer === "string" ? tempAnswer.trim() : tempAnswer;
    setAnswersByStep((prev) => ({
      ...prev,
      [currentStep.id]: normalizedAnswer,
    }));
  };

  const queueProgressUpdate = (lastStepId: number) => {
    const now = Date.now();
    const elapsedMs = now - lastProgressSentAtRef.current;

    const send = () => {
      lastProgressSentAtRef.current = Date.now();
      updateProgress.mutate({ lessonId: numericLessonId, lastStepId });
    };

    if (elapsedMs >= progressThrottleMs) {
      if (pendingProgressTimerRef.current) {
        clearTimeout(pendingProgressTimerRef.current);
        pendingProgressTimerRef.current = null;
      }
      send();
      return;
    }

    if (pendingProgressTimerRef.current) {
      clearTimeout(pendingProgressTimerRef.current);
    }

    pendingProgressTimerRef.current = setTimeout(() => {
      send();
      pendingProgressTimerRef.current = null;
    }, progressThrottleMs - elapsedMs);
  };

  const goNext = async () => {
    if (!canContinue) return;

    setSubmitError(null);
    persistCurrentAnswer();

    if (!isLast) {
      queueProgressUpdate(currentStep.id);
      setCurrentIndex((value) => value + 1);
      return;
    }

    const finalAnswers = {
      ...answersByStep,
      ...(currentStep.stepType === "QUESTION"
        ? { [currentStep.id]: typeof tempAnswer === "string" ? tempAnswer.trim() : tempAnswer }
        : {}),
    };

    const payloadAnswers = questionSteps
      .map((step) => {
        const answer = finalAnswers[step.id];
        if (answer === undefined) return null;
        if (typeof answer === "string" && answer.length === 0) return null;
        return { stepId: step.id, answer };
      })
      .filter((item): item is { stepId: number; answer: LessonAnswer } => item !== null);

    try {
      const submission = await submitAttempt.mutateAsync({
        lessonId: numericLessonId,
        startedAt: startedAtRef.current,
        answers: payloadAnswers,
      });
      setResult(submission);
    } catch (error) {
      setSubmitError(await getSubmitErrorMessage(error));
    }
  };

  return (
    <div className="flex flex-1 flex-col bg-background">
      <div className="border-b bg-card/60 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate({ to: "/lessons" })}
              className="gap-1.5"
            >
              <ArrowLeft className="size-4" />
              Exit
            </Button>
            {/* admin edit/delete controls moved to bottom area for per-page editing */}
          </div>
          <div className="text-right">
            {currentUnit ? (
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {currentUnit.title}
              </p>
            ) : null}
            <span className="text-sm font-semibold text-muted-foreground">
              {currentIndex + 1} / {steps.length}
            </span>
          </div>
        </div>
        <div className="mx-auto max-w-6xl px-4 pb-3">
          <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-gradient-to-r from-chart-1 to-chart-5 transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 lg:py-10">
        <div className="grid gap-8 lg:grid-cols-[320px_minmax(0,1fr)]">
          {currentUnit ? (
            <aside className="hidden lg:block">
              <div className="sticky top-6">
                <UnitRoadmap
                  unit={displayUnit ?? currentUnit}
                  progressItems={progressItems}
                  currentLessonId={numericLessonId}
                  title="Unit Lessons"
                  interactive
                  allowAllUnlocked={isContributor || isAdmin}
                  onDeleteLesson={handleDeleteLesson}
                  headerAction={
                    isContributor || isAdmin ? (
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="default">Add Content</Button>
                        </DialogTrigger>
                        <DialogContent
                          title="Add Content"
                          description="Create a lesson for this unit"
                          className="max-w-2xl max-h-[90vh] overflow-y-auto"
                        >
                          <LessonForm defaultUnitId={currentUnit?.id ?? undefined} />
                        </DialogContent>
                      </Dialog>
                    ) : null
                  }
                />
              </div>
            </aside>
          ) : null}

          <div className="min-w-0">
            <div className="mx-auto w-full max-w-2xl">
              <h1 className="mb-2 text-lg font-semibold text-muted-foreground">
                {lessonData.lesson.title}
              </h1>

              <div className="relative">
                <StepBody
                  step={currentStep}
                  tempAnswer={tempAnswer}
                  setTempAnswer={setTempAnswer}
                />

                {(isContributor || isAdmin) && (
                  <>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                      className="absolute left-0 top-1/2 z-20 hidden -translate-y-1/2 -translate-x-full lg:inline-flex"
                      disabled={currentIndex === 0}
                    >
                      <ChevronLeft className="size-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        void goNext();
                      }}
                      disabled={submitAttempt.isPending || !canContinue}
                      className="absolute right-0 top-1/2 z-20 hidden -translate-y-1/2 translate-x-full lg:inline-flex"
                    >
                      <ChevronRight className="size-4" />
                    </Button>
                  </>
                )}
              </div>

              <div className="mt-8">
                {submitError ? (
                  <p className="mb-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    {submitError}
                  </p>
                ) : null}
                {!isAdmin && !isContributor && (
                  <Button
                    size="lg"
                    className="w-full gap-2 text-base"
                    onClick={() => {
                      void goNext();
                    }}
                    disabled={submitAttempt.isPending || !canContinue}
                  >
                    {isLast
                      ? submitAttempt.isPending
                        ? "Submitting..."
                        : "See Results"
                      : "Continue"}
                    <ArrowRight className="size-4" />
                  </Button>
                )}
                {(isContributor || isAdmin) && (
                  <div className="grid grid-cols-2 gap-3 lg:hidden">
                    <Button
                      size="lg"
                      className="gap-2"
                      onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                      disabled={currentIndex === 0}
                    >
                      <ChevronLeft className="size-4" />
                      Previous
                    </Button>
                    <Button
                      size="lg"
                      className="gap-2"
                      onClick={() => {
                        void goNext();
                      }}
                      disabled={submitAttempt.isPending || !canContinue}
                    >
                      {isLast ? "Finish" : "Next"}
                      <ChevronRight className="size-4" />
                    </Button>
                  </div>
                )}
                {/* Arrows moved adjacent to the step card above (to the sides) */}

                {isAdmin && currentStep ? (
                  <div className="mt-4 flex gap-2">
                    {(() => {
                      const editStep = editData?.steps?.find((s) => s.id === currentStep?.id);
                      return (
                        <AdminEditStepButton
                          lessonId={numericLessonId}
                          step={currentStep}
                          editStep={editStep}
                          onSaved={() => void null}
                        />
                      );
                    })()}
                    <AdminDeleteStepButton
                      lessonId={numericLessonId}
                      stepId={currentStep.id}
                      onDeleted={() => {
                        setCurrentIndex((idx) =>
                          Math.max(0, Math.min(idx, Math.max(0, steps.length - 2))),
                        );
                      }}
                    />
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

async function getSubmitErrorMessage(error: unknown) {
  if (error instanceof HTTPError) {
    const payload = (await error.response
      .clone()
      .json()
      .catch(() => null)) as { message?: string; error?: string } | null;

    if (payload?.message) {
      return payload.message;
    }

    if (payload?.error) {
      return payload.error;
    }

    return `Couldn't submit your lesson right now (${error.response.status}). Try again.`;
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "Couldn't submit your lesson right now. Try again.";
}

function StepBody({
  step,
  tempAnswer,
  setTempAnswer,
}: {
  step: LessonStepPayload;
  tempAnswer: LessonAnswer;
  setTempAnswer: (value: LessonAnswer) => void;
}) {
  if (step.stepType === "TEACH" && step.vocab) {
    // Use payload if available (edited values), otherwise fall back to vocab
    const title = readStringField(step.payload, "title") ?? step.vocab.term;
    const body = readStringField(step.payload, "body") ?? step.vocab.definition;
    const example = readStringField(step.payload, "example") ?? step.vocab.exampleSentence;

    return (
      <Card className="border-chart-1/30 bg-chart-1/5">
        <CardContent className="pt-6">
          <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">learn</p>
          <h2 className="mt-2 text-3xl font-bold">{title}</h2>
          <p className="mt-4 text-lg">{body}</p>
          {example && <p className="mt-3 text-sm italic text-muted-foreground">"{example}"</p>}
        </CardContent>
      </Card>
    );
  }

  if (step.stepType === "DIALOGUE") {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">dialogue</p>
          <p className="mt-3 text-lg">{step.dialogueText ?? "Dialogue step"}</p>
        </CardContent>
      </Card>
    );
  }

  if (step.stepType === "RECAP") {
    const headline = readStringField(step.payload, "headline") ?? "Quick recap";
    const summary =
      readStringField(step.payload, "summary") ??
      "You reached the end of this lesson. Lock in the key idea before you move on.";
    const takeaways = readStringArrayField(step.payload, "takeaways");

    return (
      <Card className="border-chart-2/25 bg-chart-2/8">
        <CardContent className="pt-6">
          <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">recap</p>
          <h2 className="mt-2 text-3xl font-bold">{headline}</h2>
          <p className="mt-4 text-base text-muted-foreground">{summary}</p>
          {takeaways.length > 0 ? (
            <div className="mt-5 space-y-3">
              {takeaways.map((takeaway) => (
                <div
                  key={takeaway}
                  className="rounded-2xl border border-border/70 bg-background/80 px-4 py-3"
                >
                  <p className="text-sm font-medium">{takeaway}</p>
                </div>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  return <QuestionStep step={step} value={tempAnswer} onChange={setTempAnswer} />;
}

function ResultView({
  result,
  lessonTitle,
  unitTitle,
  questionSteps,
  nextLessonTitle,
  onRetry,
  onExit,
  onContinue,
}: {
  result: AttemptResult;
  lessonTitle: string;
  unitTitle: string | null;
  questionSteps: LessonStepPayload[];
  nextLessonTitle: string | null;
  onRetry: () => void;
  onExit: () => void;
  onContinue?: () => void;
}) {
  const questionStepById = new Map(questionSteps.map((step) => [step.id, step]));

  return (
    <div className="flex flex-1 items-center justify-center bg-background p-4">
      <Card className="w-full max-w-4xl">
        <CardContent className="pt-8">
          <div className="text-center">
            {unitTitle ? (
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {unitTitle}
              </p>
            ) : null}
            <h2 className="mb-1 text-3xl font-bold">{lessonTitle}</h2>
            <p className="mb-6 text-muted-foreground">
              {result.passed ? "Lesson complete" : "Try again"}
            </p>

            <div className="mb-6 rounded-2xl bg-secondary p-6">
              <div className="mb-1 text-5xl font-bold">{result.score}%</div>
              <p className="text-sm text-muted-foreground">
                {result.correctCount} out of {result.totalQuestions} correct
              </p>
            </div>
          </div>

          {result.results.length > 0 ? (
            <div className="mb-6 space-y-4">
              <div className="px-1">
                <h3 className="text-base font-semibold">Report</h3>
                <p className="text-sm text-muted-foreground">
                  Review what you got right and what to tighten up.
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {result.results.map((item, index) => {
                  const step = questionStepById.get(item.stepId);
                  const prompt = step?.question?.prompt ?? `Question ${index + 1}`;

                  return (
                    <div
                      key={item.stepId}
                      className="rounded-2xl border border-border/70 bg-card/70 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="min-w-0 font-medium">{prompt}</p>
                        <Badge
                          variant={item.correct ? "default" : "secondary"}
                          className="px-3 py-1 text-xs font-semibold"
                        >
                          {item.correct ? "Correct" : "Review"}
                        </Badge>
                      </div>

                      {!item.correct && item.submittedAnswer !== null ? (
                        <p className="mt-3 text-sm text-muted-foreground">
                          You selected:{" "}
                          <span className="font-medium text-foreground">
                            {renderSubmittedAnswer(item.submittedAnswer)}
                          </span>
                        </p>
                      ) : null}

                      {!item.correct && item.correctAnswer ? (
                        <p className="mt-2 text-sm text-muted-foreground">
                          Correct answer:{" "}
                          <span className="font-medium text-foreground">{item.correctAnswer}</span>
                        </p>
                      ) : null}

                      {item.explanation ? (
                        <p className="mt-2 text-sm text-muted-foreground">{item.explanation}</p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="flex flex-col gap-3">
            {result.passed && onContinue && nextLessonTitle ? (
              <Button size="lg" className="w-full text-base" onClick={onContinue}>
                Continue to {nextLessonTitle}
              </Button>
            ) : null}
            {!result.passed && (
              <Button size="lg" className="w-full text-base" onClick={onRetry}>
                Try Again
              </Button>
            )}
            <Button size="lg" variant="default" className="w-full text-base" onClick={onExit}>
              Back to Learn
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function renderSubmittedAnswer(answer: LessonAnswer) {
  if (typeof answer === "string") {
    return answer.trim().length > 0 ? answer : "No answer";
  }

  const pairs = Object.entries(answer)
    .filter(([, value]) => typeof value === "string" && value.trim().length > 0)
    .map(([left, right]) => `${left} = ${right}`);

  return pairs.length > 0 ? pairs.join("; ") : "No answer";
}

function readStringField(payload: LessonStepPayload["payload"], key: string) {
  const value = payload?.[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function readStringArrayField(payload: LessonStepPayload["payload"], key: string) {
  const value = payload?.[key];
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function AdminDeleteStepButton({
  lessonId,
  stepId,
  onDeleted,
}: {
  lessonId: number;
  stepId: number;
  onDeleted?: () => void;
}) {
  const deleteStep = useDeleteStep();
  const [busy, setBusy] = useState(false);

  const handle = async () => {
    if (!confirm("Delete this step? This cannot be undone.")) return;
    setBusy(true);
    try {
      await deleteStep.mutateAsync({ lessonId, stepId });
      onDeleted?.();
    } catch (err) {
      alert(`Error deleting step: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button size="sm" variant="destructive" disabled={busy} onClick={handle}>
      Delete step
    </Button>
  );
}

function AdminEditStepButton({
  lessonId,
  step,
  editStep,
  onSaved,
}: {
  lessonId: number;
  step: LessonStepPayload;
  editStep?: LessonStepPayload;
  onSaved?: () => void;
}) {
  const patchStep = usePatchStep();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  // Use editStep (with answers) if available, otherwise fallback to step (learner-safe)
  const stepForEditing = editStep ?? step;

  // Form fields - initialize based on step type
  const [term, setTerm] = useState(stepForEditing.vocab?.term ?? "");
  const [defText, setDefText] = useState(stepForEditing.vocab?.definition ?? "");
  const [example, setExample] = useState(stepForEditing.vocab?.exampleSentence ?? "");
  const [dialogueText, setDialogueText] = useState(stepForEditing.dialogueText ?? "");
  const [qPrompt, setQPrompt] = useState(stepForEditing.question?.prompt ?? "");
  const [questionType, setQuestionType] = useState<"MCQ" | "MATCH" | "SHORT_ANSWER">(
    (stepForEditing.question?.questionType as any) || "SHORT_ANSWER",
  );
  const [qChoices, setQChoices] = useState(
    stepForEditing.question?.choices?.map((c) => ({
      id: c.id,
      text: c.text,
      isCorrect: c.isCorrect,
    })) ?? [{ id: Date.now(), text: "", isCorrect: false }],
  );

  // Match pairs state
  const [qMatchPairs, setQMatchPairs] = useState<
    Array<{ left: string; right: string; id?: string }>
  >(
    stepForEditing.question?.matchPairs?.map((p) => ({
      left: p.left,
      right: p.right ?? "",
      id: String(p.left),
    })) ?? [{ left: "", right: "", id: String(Date.now()) }],
  );

  // Helper to normalize acceptedAnswers - could be array or string
  const normalizeAcceptedAnswers = (answers: any): string => {
    if (!answers) return "";
    if (Array.isArray(answers)) return answers.join(", ");
    if (typeof answers === "string") return answers;
    return "";
  };

  const [qAcceptedAnswers, setQAcceptedAnswers] = useState(
    normalizeAcceptedAnswers(stepForEditing.question?.acceptedAnswers),
  );

  // RECAP fields
  const readStringField = (payload: any, key: string): string => {
    if (!payload || typeof payload !== "object") return "";
    return payload[key] ?? "";
  };
  const readStringArrayField = (payload: any, key: string): string[] => {
    if (!payload || typeof payload !== "object") return [];
    const val = payload[key];
    if (Array.isArray(val)) return val;
    return [];
  };

  const [recapHeadline, setRecapHeadline] = useState(
    readStringField(stepForEditing.payload, "headline") ?? "Quick recap",
  );
  const [recapSummary, setRecapSummary] = useState(
    readStringField(stepForEditing.payload, "summary") ??
      "You reached the end of this lesson. Lock in the key idea before you move on.",
  );
  const [recapTakeaways, setRecapTakeaways] = useState(
    readStringArrayField(stepForEditing.payload, "takeaways").join("\n"),
  );

  useEffect(() => {
    if (!open) return;
    // Reset form when step changes
    // For TEACH: use payload if available (edited values), otherwise vocab
    setTerm((stepForEditing.payload as any)?.title ?? stepForEditing.vocab?.term ?? "");
    setDefText((stepForEditing.payload as any)?.body ?? stepForEditing.vocab?.definition ?? "");
    setExample(
      (stepForEditing.payload as any)?.example ?? stepForEditing.vocab?.exampleSentence ?? "",
    );
    setDialogueText(stepForEditing.dialogueText ?? "");
    setQPrompt(stepForEditing.question?.prompt ?? "");
    setQuestionType((stepForEditing.question?.questionType as any) || "SHORT_ANSWER");
    setQChoices(
      stepForEditing.question?.choices?.map((c) => ({
        id: c.id,
        text: c.text,
        isCorrect: c.isCorrect,
      })) ?? [{ id: Date.now(), text: "", isCorrect: false }],
    );
    setQMatchPairs(
      stepForEditing.question?.matchPairs?.map((p) => ({
        left: p.left,
        right: p.right ?? "",
        id: String(p.left),
      })) ?? [{ left: "", right: "", id: String(Date.now()) }],
    );
    // Explicitly load accepted answers - check both question and payload fields
    const answers =
      stepForEditing.question?.acceptedAnswers ?? (stepForEditing.payload as any)?.acceptedAnswers;
    if (Array.isArray(answers) && answers.length > 0) {
      setQAcceptedAnswers(answers.join(", "));
    } else if (typeof answers === "string" && answers.trim()) {
      setQAcceptedAnswers(answers);
    } else {
      setQAcceptedAnswers("");
    }

    // Reset RECAP fields
    setRecapHeadline(readStringField(stepForEditing.payload, "headline") ?? "Quick recap");
    setRecapSummary(
      readStringField(stepForEditing.payload, "summary") ??
        "You reached the end of this lesson. Lock in the key idea before you move on.",
    );
    setRecapTakeaways(readStringArrayField(stepForEditing.payload, "takeaways").join("\n"));
  }, [stepForEditing, open]);

  const handleSave = async () => {
    setBusy(true);
    try {
      let body: any = {
        orderIndex: stepForEditing.orderIndex,
        stepType: step.stepType,
      };

      if (step.stepType === "TEACH") {
        body = {
          ...body,
          vocabItemId: step.vocab?.id ?? null,
          payload: {
            title: term.trim(),
            body: defText.trim(),
            example: example.trim() || null,
            partOfSpeech: stepForEditing.vocab?.partOfSpeech ?? null,
          },
        };
      } else if (stepForEditing.stepType === "DIALOGUE") {
        body = {
          ...body,
          dialogueText: dialogueText.trim(),
        };
      } else if (stepForEditing.stepType === "QUESTION") {
        const acceptedAnswersArray =
          questionType === "SHORT_ANSWER"
            ? qAcceptedAnswers
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean)
            : [];

        const optionsArray = questionType === "MCQ" ? qChoices.map((c) => c.text) : null;

        // Find the index of the correct answer for MCQ
        const correctOptionIndex =
          questionType === "MCQ" ? qChoices.findIndex((c) => c.isCorrect) : null;

        // Build matchPairs for MATCH type
        const matchPairsArray =
          questionType === "MATCH"
            ? qMatchPairs
                .filter((p) => p.left.trim() && p.right.trim())
                .map((p) => ({ left: p.left, right: p.right }))
            : null;

        body = {
          ...body,
          questionId: stepForEditing.question?.id ?? null,
          questionType,
          prompt: qPrompt.trim(),
          explanation: stepForEditing.question?.explanation ?? null,
          options: optionsArray,
          correctOptionIndex: correctOptionIndex,
          acceptedAnswers: acceptedAnswersArray,
          matchPairs: matchPairsArray,
        };
      } else if (stepForEditing.stepType === "RECAP") {
        const takeawaysArray = recapTakeaways
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean);
        body = {
          ...body,
          payload: {
            headline: recapHeadline.trim(),
            summary: recapSummary.trim(),
            takeaways: takeawaysArray,
          },
        };
      }

      await patchStep.mutateAsync({ lessonId, stepId: stepForEditing.id, body });
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ["lessons", "play", lessonId] }),
        queryClient.refetchQueries({ queryKey: ["lessons", "edit", lessonId] }),
      ]);

      setOpen(false);
      onSaved?.();
    } catch (err) {
      alert(`Error saving: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        Edit
      </Button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-2xl rounded-lg bg-card p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="mb-4 text-lg font-semibold">
              Edit{" "}
              {step.stepType === "TEACH"
                ? "Definition"
                : step.stepType === "DIALOGUE"
                  ? "Dialogue"
                  : "Question"}
            </h3>

            <form className="space-y-4 pr-4">
              {step.stepType === "TEACH" && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1">Term</label>
                    <input
                      type="text"
                      className="w-full rounded-md border bg-background px-3 py-2"
                      value={term}
                      onChange={(e) => setTerm(e.target.value)}
                      placeholder="Enter term"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Definition</label>
                    <textarea
                      className="w-full rounded-md border bg-background px-3 py-2 text-base"
                      rows={3}
                      value={defText}
                      onChange={(e) => setDefText(e.target.value)}
                      placeholder="Enter definition"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Example sentence (optional)
                    </label>
                    <textarea
                      className="w-full rounded-md border bg-background px-3 py-2 text-base"
                      rows={2}
                      value={example}
                      onChange={(e) => setExample(e.target.value)}
                      placeholder="Enter example"
                    />
                  </div>
                </>
              )}

              {step.stepType === "DIALOGUE" && (
                <div>
                  <label className="block text-sm font-medium mb-1">Dialogue</label>
                  <textarea
                    className="w-full rounded-md border bg-background px-3 py-2 text-base font-mono text-sm"
                    rows={6}
                    value={dialogueText}
                    onChange={(e) => setDialogueText(e.target.value)}
                    placeholder="Enter dialogue"
                  />
                </div>
              )}

              {step.stepType === "QUESTION" && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1">Question type</label>
                    <div className="w-full rounded-md border bg-muted/30 px-3 py-2">
                      <p className="text-sm">
                        {questionType === "MCQ"
                          ? "Multiple Choice"
                          : questionType === "MATCH"
                            ? "Matching"
                            : "Short Answer"}
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Question</label>
                    <textarea
                      className="w-full rounded-md border bg-background px-3 py-2 text-base"
                      rows={2}
                      value={qPrompt}
                      onChange={(e) => setQPrompt(e.target.value)}
                      placeholder="Enter question"
                    />
                  </div>

                  {questionType === "MCQ" && (
                    <div>
                      <label className="block text-sm font-medium mb-2">Choices</label>
                      <div className="space-y-2">
                        {qChoices.map((choice, idx) => (
                          <div key={choice.id} className="flex items-center gap-2">
                            <input
                              type="text"
                              className="flex-1 rounded-md border bg-background px-3 py-2"
                              value={choice.text}
                              onChange={(e) => {
                                const updated = [...qChoices];
                                updated[idx] = { ...choice, text: e.target.value };
                                setQChoices(updated);
                              }}
                              placeholder={`Choice ${idx + 1}`}
                            />
                            <input
                              type="checkbox"
                              checked={!!choice.isCorrect}
                              onChange={(e) => {
                                const updated = [...qChoices];
                                updated[idx] = { ...choice, isCorrect: e.target.checked };
                                setQChoices(updated);
                              }}
                              title="Mark as correct"
                            />
                            <button
                              type="button"
                              onClick={() => setQChoices(qChoices.filter((_, i) => i !== idx))}
                              className="text-sm text-red-500 hover:underline"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() =>
                            setQChoices([
                              ...qChoices,
                              { id: Date.now(), text: "", isCorrect: false },
                            ])
                          }
                          className="text-sm text-blue-500 hover:underline"
                        >
                          + Add choice
                        </button>
                      </div>
                    </div>
                  )}

                  {questionType === "MATCH" && (
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Match pairs (Left → Right)
                      </label>
                      <div className="space-y-2">
                        {qMatchPairs.map((pair, idx) => (
                          <div key={pair.id} className="flex gap-2 items-end">
                            <div className="flex-1">
                              <input
                                type="text"
                                className="w-full rounded-md border bg-background px-3 py-2"
                                value={pair.left}
                                onChange={(e) => {
                                  const updated = [...qMatchPairs];
                                  updated[idx] = { ...pair, left: e.target.value };
                                  setQMatchPairs(updated);
                                }}
                                placeholder={`Term ${idx + 1}`}
                              />
                            </div>
                            <span className="text-muted-foreground">→</span>
                            <div className="flex-1">
                              <input
                                type="text"
                                className="w-full rounded-md border bg-background px-3 py-2"
                                value={pair.right}
                                onChange={(e) => {
                                  const updated = [...qMatchPairs];
                                  updated[idx] = { ...pair, right: e.target.value };
                                  setQMatchPairs(updated);
                                }}
                                placeholder={`Definition ${idx + 1}`}
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setQMatchPairs(qMatchPairs.filter((_, i) => i !== idx))
                              }
                              className="text-sm text-red-500 hover:underline whitespace-nowrap"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() =>
                            setQMatchPairs([
                              ...qMatchPairs,
                              { left: "", right: "", id: String(Date.now()) },
                            ])
                          }
                          className="text-sm text-blue-500 hover:underline"
                        >
                          + Add pair
                        </button>
                      </div>
                    </div>
                  )}

                  {questionType === "SHORT_ANSWER" && (
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Accepted answers (comma-separated)
                      </label>
                      <textarea
                        className="w-full rounded-md border bg-background px-3 py-2 text-base"
                        rows={2}
                        value={qAcceptedAnswers}
                        onChange={(e) => setQAcceptedAnswers(e.target.value)}
                        placeholder="e.g. answer1, answer2"
                      />
                    </div>
                  )}
                </>
              )}

              {step.stepType === "RECAP" && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1">Headline</label>
                    <input
                      type="text"
                      className="w-full rounded-md border bg-background px-3 py-2"
                      value={recapHeadline}
                      onChange={(e) => setRecapHeadline(e.target.value)}
                      placeholder="Enter headline"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Summary</label>
                    <textarea
                      className="w-full rounded-md border bg-background px-3 py-2 text-base"
                      rows={3}
                      value={recapSummary}
                      onChange={(e) => setRecapSummary(e.target.value)}
                      placeholder="Enter summary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Takeaways (one per line)
                    </label>
                    <textarea
                      className="w-full rounded-md border bg-background px-3 py-2 text-base font-mono text-sm"
                      rows={4}
                      value={recapTakeaways}
                      onChange={(e) => setRecapTakeaways(e.target.value)}
                      placeholder="Enter takeaways, one per line"
                    />
                  </div>
                </>
              )}
            </form>

            <div className="mt-6 flex justify-end gap-2 flex-shrink-0">
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={busy}>
                {busy ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
