import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { HTTPError } from "ky";
import { ArrowLeft, ArrowRight, RotateCcw, Sparkles, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { QuestionStep } from "@/features/lessons/components/question-step";
import {
  type LessonAnswer,
  type LessonStepPayload,
  type ReviseAttemptResult,
  type ReviseQueueItem,
  useReviseQueue,
  useSubmitReviseAttempt,
} from "@/features/lessons/useLessonsApi";
import { requireOnboardingCompleted } from "@/lib/auth";

const SESSION_SIZE = 10;

export const Route = createFileRoute("/revise")({
  beforeLoad: requireOnboardingCompleted,
  component: RevisePage,
});

function RevisePage() {
  const navigate = useNavigate();
  const reviseQueue = useReviseQueue(SESSION_SIZE);
  const submitAttempt = useSubmitReviseAttempt();

  const [sessionItems, setSessionItems] = useState<ReviseQueueItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answersByStep, setAnswersByStep] = useState<Record<number, LessonAnswer>>({});
  const [tempAnswer, setTempAnswer] = useState<LessonAnswer>("");
  const [result, setResult] = useState<ReviseAttemptResult | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const queueItems = sessionItems;
  const steps: LessonStepPayload[] = useMemo(
    () =>
      queueItems.map((item, index) => ({
        id: item.stepId,
        orderIndex: index + 1,
        stepType: "QUESTION",
        vocab: null,
        question: item.question,
        dialogueText: null,
        payload: item.payload,
      })),
    [queueItems],
  );
  const currentStep = steps[currentIndex];
  const currentQueueItem = queueItems[currentIndex];

  useEffect(() => {
    const nextItems = reviseQueue.data?.items ?? [];
    if (sessionItems.length === 0) {
      setSessionItems(nextItems);
      setCurrentIndex(0);
      setAnswersByStep({});
      setTempAnswer("");
      setResult(null);
      setSubmitError(null);
    }
  }, [reviseQueue.data?.items, sessionItems.length]);

  useEffect(() => {
    if (!currentStep) {
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

  if (reviseQueue.isLoading) {
    return <div className="p-8 text-center">Loading your revise queue...</div>;
  }

  if (reviseQueue.error) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <Card className="w-full max-w-lg border-destructive/20 bg-destructive/5">
          <CardContent className="pt-6 text-center">
            <h1 className="text-2xl font-bold">Revise is unavailable</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              We couldn&apos;t load your practice queue right now.
            </p>
            <Button className="mt-6" onClick={() => void reviseQueue.refetch()}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (queueItems.length === 0) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4 py-10">
        <Card className="w-full max-w-2xl overflow-hidden border-border/80 bg-card">
          <CardContent className="relative pt-8">
            <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-r from-chart-1/15 via-chart-2/15 to-chart-5/15" />
            <div className="relative">
              <Badge variant="outline" className="border-chart-1/30 bg-background/80">
                Revise queue clear
              </Badge>
              <h1 className="mt-5 text-4xl font-black tracking-tight">No questions are due yet.</h1>
              <p className="mt-4 max-w-xl text-base text-muted-foreground">
                Finish a lesson or come back later. Wrong answers from lessons will surface here
                more often, so this tab gets sharper as you learn.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button size="lg" className="gap-2" onClick={() => navigate({ to: "/lessons" })}>
                  <Sparkles className="size-4" />
                  Go To Learn
                </Button>
                <Button size="lg" variant="outline" onClick={() => void reviseQueue.refetch()}>
                  Refresh Queue
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!currentStep || !currentQueueItem) {
    return null;
  }

  if (result) {
    return (
      <ReviseResultView
        result={result}
        answeredCount={queueItems.length}
        onRetry={() => {
          void restartSession(
            reviseQueue.refetch,
            setSessionItems,
            setAnswersByStep,
            setCurrentIndex,
            setResult,
            setSubmitError,
          );
        }}
        onBackToLearn={() => navigate({ to: "/lessons" })}
      />
    );
  }

  const progressPercent = ((currentIndex + 1) / steps.length) * 100;
  const isLast = currentIndex === steps.length - 1;
  const canContinue = canContinueStep(currentStep, tempAnswer);

  const onContinue = async () => {
    if (!canContinue) {
      return;
    }

    setSubmitError(null);
    const normalizedAnswer = typeof tempAnswer === "string" ? tempAnswer.trim() : tempAnswer;
    const nextAnswers = {
      ...answersByStep,
      [currentStep.id]: normalizedAnswer,
    };
    setAnswersByStep(nextAnswers);

    if (!isLast) {
      setCurrentIndex((value) => value + 1);
      return;
    }

    const payload = steps
      .map((step) => {
        const answer = nextAnswers[step.id];
        if (answer === undefined) {
          return null;
        }
        if (typeof answer === "string" && answer.length === 0) {
          return null;
        }
        return { stepId: step.id, answer };
      })
      .filter((item): item is { stepId: number; answer: LessonAnswer } => item !== null);

    try {
      const submission = await submitAttempt.mutateAsync(payload);
      setResult(submission);
    } catch (error) {
      setSubmitError(await getSubmitErrorMessage(error));
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="border-b bg-card/70 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-4">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5"
            onClick={() => navigate({ to: "/lessons" })}
          >
            <ArrowLeft className="size-4" />
            Exit
          </Button>
          <div className="flex items-center gap-2">
            <Badge className="border-chart-1/30 bg-chart-1/10 text-chart-1 hover:bg-chart-1/10">
              {formatPriorityReason(currentQueueItem.priorityReason)}
            </Badge>
            <Badge variant="outline" className="bg-background/70">
              {currentIndex + 1} / {steps.length}
            </Badge>
          </div>
        </div>
        <div className="mx-auto max-w-5xl px-4 pb-4">
          <div className="h-2 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-orange-500 transition-all duration-300 dark:bg-orange-400"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 lg:grid lg:grid-cols-[300px_minmax(0,1fr)] lg:py-10">
        <aside className="hidden lg:block">
          <Card className="overflow-hidden border-border/80 bg-card">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Revise
                  </p>
                  <h1 className="mt-2 text-3xl font-black tracking-tight">Sharp practice</h1>
                </div>
                <RotateCcw className="mt-1 size-5 text-chart-2" />
              </div>
              <p className="mt-4 text-sm leading-6 text-muted-foreground">
                Questions you missed or left weak in lessons get pulled forward here more often.
              </p>

              <div className="mt-6 grid gap-3">
                <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Target className="size-4 text-chart-5" />
                    Due now
                  </div>
                  <p className="mt-2 text-3xl font-black">{reviseQueue.data?.dueCount ?? 0}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    high priority prompts
                  </p>
                </div>
                <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                  <p className="text-sm font-semibold">Current lesson source</p>
                  <p className="mt-2 text-lg font-bold">{currentQueueItem.lessonTitle}</p>
                  {formatPriorityDescription(currentQueueItem.priorityReason) ? (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {formatPriorityDescription(currentQueueItem.priorityReason)}
                    </p>
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>
        </aside>

        <div className="min-w-0">
          <div className="mx-auto w-full max-w-2xl">
            <div>
              <div>
                <QuestionStep step={currentStep} value={tempAnswer} onChange={setTempAnswer} />
              </div>

              {submitError ? (
                <p className="mt-6 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {submitError}
                </p>
              ) : null}

              <div className="mt-8 flex justify-end">
                <Button
                  size="lg"
                  className="gap-2 sm:min-w-44"
                  onClick={() => {
                    void onContinue();
                  }}
                  disabled={!canContinue || submitAttempt.isPending}
                >
                  {isLast ? (submitAttempt.isPending ? "Checking..." : "Finish Run") : "Next"}
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

function ReviseResultView({
  result,
  answeredCount,
  onRetry,
  onBackToLearn,
}: {
  result: ReviseAttemptResult;
  answeredCount: number;
  onRetry: () => void;
  onBackToLearn: () => void;
}) {
  const missedItems = result.results.filter((item) => !item.correct);
  const correctItems = result.results.filter((item) => item.correct);

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4 py-10">
      <Card className="w-full max-w-3xl overflow-hidden border-border/80 bg-card">
        <CardContent className="pt-8">
          <div className="rounded-[1.75rem] border border-border/70 bg-gradient-to-br from-chart-1/10 via-background to-chart-5/10 p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Revision complete
            </p>
            <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h1 className="text-4xl font-black tracking-tight">{result.score}%</h1>
                <p className="mt-2 text-base text-muted-foreground">
                  {result.correctCount} of {answeredCount} correct
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:min-w-72">
                <ResultStat label="Answered" value={String(answeredCount)} />
                <ResultStat label="Still due" value={String(result.dueCount)} />
              </div>
            </div>
          </div>

          {missedItems.length > 0 ? (
            <div className="mt-6 space-y-3">
              <h2 className="text-lg font-bold">Weak spots to revisit</h2>
              {missedItems.map((item) => (
                <div
                  key={item.stepId}
                  className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3"
                >
                  <p className="text-sm font-semibold">Correct answer</p>
                  <p className="mt-1 text-base">{item.correctAnswer ?? "Unavailable"}</p>
                  {item.explanation ? (
                    <p className="mt-2 text-sm text-muted-foreground">{item.explanation}</p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

          {correctItems.length > 0 ? (
            <div className="mt-6 space-y-3">
              <h2 className="text-lg font-bold">What you did well</h2>
              {correctItems.map((item) => (
                <div
                  key={item.stepId}
                  className="rounded-2xl border border-chart-2/30 bg-chart-2/10 px-4 py-3"
                >
                  <p className="text-sm font-semibold">Correct answer</p>
                  <p className="mt-1 text-base">{item.correctAnswer ?? "Unavailable"}</p>
                  {item.explanation ? (
                    <p className="mt-2 text-sm text-muted-foreground">{item.explanation}</p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

          {missedItems.length === 0 && correctItems.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-chart-2/30 bg-chart-2/10 px-4 py-4">
              <p className="text-sm font-semibold text-chart-2">Clean run.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Your revise queue is in good shape right now.
              </p>
            </div>
          ) : null}

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button size="lg" className="gap-2" onClick={onRetry}>
              <RotateCcw className="size-4" />
              New Revise Run
            </Button>
            <Button size="lg" variant="outline" onClick={onBackToLearn}>
              Back To Learn
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ResultStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-2xl font-black">{value}</p>
    </div>
  );
}

function canContinueStep(step: LessonStepPayload, answer: LessonAnswer) {
  if (step.question?.questionType === "MATCH") {
    if (typeof answer === "string") {
      return false;
    }

    const requiredPairs = step.question.matchPairs.length;
    const filled = step.question.matchPairs.filter((pair) => {
      const value = answer[pair.left];
      return typeof value === "string" && value.trim().length > 0;
    }).length;
    return requiredPairs > 0 && filled === requiredPairs;
  }

  return typeof answer === "string" && answer.trim().length > 0;
}

async function restartSession(
  refetch: () => Promise<unknown>,
  setSessionItems: (value: ReviseQueueItem[]) => void,
  setAnswersByStep: (value: Record<number, LessonAnswer>) => void,
  setCurrentIndex: (value: number) => void,
  setResult: (value: ReviseAttemptResult | null) => void,
  setSubmitError: (value: string | null) => void,
) {
  setSessionItems([]);
  setAnswersByStep({});
  setCurrentIndex(0);
  setResult(null);
  setSubmitError(null);
  await refetch();
}

function formatPriorityReason(reason: string) {
  switch (reason) {
    case "recent_mistake":
      return "Mistake Recovery";
    case "due":
      return "Due Review";
    case "weak":
      return "Weak Signal";
    case "review":
      return "Keep Fresh";
    default:
      return "Discovery Mix";
  }
}

function formatPriorityDescription(reason: string) {
  switch (reason) {
    case "recent_mistake":
      return "";
    case "due":
      return "This one is back on schedule and ready for another pass.";
    case "weak":
      return "You have seen it before, but the system still treats it as fragile.";
    case "review":
      return "This is a steady review question from your recent learning history.";
    default:
      return "This fills out the run from approved lesson content.";
  }
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

    return `Couldn't submit your revise run right now (${error.response.status}). Try again.`;
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "Couldn't submit your revise run right now. Try again.";
}
