import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { HTTPError } from "ky";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { UnitRoadmap } from "@/features/lessons/components/unit-roadmap";
import { findUnitByLessonId, getUnitRoadmap, progressMap } from "@/features/lessons/lesson-roadmap";
import { requireOnboardingCompleted } from "@/lib/auth";
import {
  type AttemptResult,
  type LessonAnswer,
  type LessonStepPayload,
  useLessonPlay,
  useLessonProgress,
  useUpdateLessonProgress,
  useSubmitLessonAttempt,
  useUnits,
} from "@/features/lessons/useLessonsApi";
import { QuestionStep } from "@/features/lessons/components/question-step";

export const Route = createFileRoute("/lesson/$lessonId")({
  beforeLoad: async () => {
    await requireOnboardingCompleted();
  },
  component: LessonPage,
});

function LessonPage() {
  const navigate = useNavigate();
  const { lessonId } = Route.useParams();
  const numericLessonId = Number(lessonId);
  const hasValidLessonId = Number.isInteger(numericLessonId) && numericLessonId > 0;

  const { data, isLoading, error } = useLessonPlay(numericLessonId);
  const { data: units } = useUnits();
  const { data: progressItems } = useLessonProgress();
  const submitAttempt = useSubmitLessonAttempt();
  const updateProgress = useUpdateLessonProgress();

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

  const steps = data?.steps ?? [];
  const currentStep = steps[currentIndex];
  const questionSteps = useMemo(
    () => steps.filter((step) => step.stepType === "QUESTION"),
    [steps],
  );
  const progressByLessonId = useMemo(() => progressMap(progressItems), [progressItems]);
  const currentUnit = useMemo(
    () => (units ? findUnitByLessonId(units, numericLessonId) : null),
    [units, numericLessonId],
  );
  const unitRoadmap = useMemo(
    () => (currentUnit ? getUnitRoadmap(currentUnit, progressByLessonId, numericLessonId) : null),
    [currentUnit, progressByLessonId, numericLessonId],
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
    if (!data || steps.length === 0) {
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
  }, [data, steps, progressItems, numericLessonId]);

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

  if (error || !data) {
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
        lessonTitle={data.lesson.title}
        unitTitle={currentUnit?.title ?? null}
        nextLessonTitle={result.passed ? (nextLesson?.title ?? null) : null}
        onRetry={() => {
          setCurrentIndex(0);
          setAnswersByStep({});
          setTempAnswer("");
          setResult(null);
          setSubmitError(null);
        }}
        onExit={() => navigate({ to: "/lessons" })}
        onContinue={
          result.passed && nextLesson
            ? () =>
                navigate({ to: "/lesson/$lessonId", params: { lessonId: String(nextLesson.id) } })
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
        answers: payloadAnswers,
        startedAt: startedAtRef.current,
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
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate({ to: "/lessons" })}
            className="gap-1.5"
          >
            <ArrowLeft className="size-4" />
            Exit
          </Button>
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
                  unit={currentUnit}
                  progressItems={progressItems}
                  currentLessonId={numericLessonId}
                  title="Unit Lessons"
                  interactive
                />
              </div>
            </aside>
          ) : null}

          <div className="min-w-0">
            <div className="mx-auto w-full max-w-2xl">
              <h1 className="mb-2 text-lg font-semibold text-muted-foreground">
                {data.lesson.title}
              </h1>
              <StepBody step={currentStep} tempAnswer={tempAnswer} setTempAnswer={setTempAnswer} />

              <div className="mt-8">
                {submitError ? (
                  <p className="mb-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    {submitError}
                  </p>
                ) : null}
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
    return (
      <Card className="border-chart-1/30 bg-chart-1/5">
        <CardContent className="pt-6">
          <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">learn</p>
          <h2 className="mt-2 text-3xl font-bold">{step.vocab.term}</h2>
          <p className="mt-4 text-lg">{step.vocab.definition}</p>
          {step.vocab.exampleSentence && (
            <p className="mt-3 text-sm italic text-muted-foreground">
              "{step.vocab.exampleSentence}"
            </p>
          )}
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
  nextLessonTitle,
  onRetry,
  onExit,
  onContinue,
}: {
  result: AttemptResult;
  lessonTitle: string;
  unitTitle: string | null;
  nextLessonTitle: string | null;
  onRetry: () => void;
  onExit: () => void;
  onContinue?: () => void;
}) {
  return (
    <div className="flex flex-1 items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg">
        <CardContent className="pt-8 text-center">
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
