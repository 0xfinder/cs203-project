import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { requireOnboardingCompleted } from "@/lib/auth";
import { cn } from "@/lib/utils";
import {
  type AttemptResult,
  type LessonStepPayload,
  useLessonPlay,
  useSubmitLessonAttempt,
} from "@/features/lessons/useLessonsApi";

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

  const { data, isLoading, error } = useLessonPlay(numericLessonId);
  const submitAttempt = useSubmitLessonAttempt();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answersByStep, setAnswersByStep] = useState<Record<number, string>>({});
  const [tempAnswer, setTempAnswer] = useState("");
  const [result, setResult] = useState<AttemptResult | null>(null);

  useEffect(() => {
    setCurrentIndex(0);
    setAnswersByStep({});
    setTempAnswer("");
    setResult(null);
  }, [numericLessonId]);

  const steps = data?.steps ?? [];
  const currentStep = steps[currentIndex];
  const questionSteps = useMemo(
    () => steps.filter((step) => step.stepType === "QUESTION"),
    [steps],
  );

  useEffect(() => {
    if (!currentStep || currentStep.stepType !== "QUESTION") {
      setTempAnswer("");
      return;
    }

    setTempAnswer(answersByStep[currentStep.id] ?? "");
  }, [currentStep, answersByStep]);

  if (isLoading) {
    return <div className="p-8 text-center">Loading lesson...</div>;
  }

  if (error || !data || !currentStep) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-xl text-muted-foreground">Lesson not found</p>
          <Button className="mt-4" onClick={() => navigate({ to: "/lessons" })}>
            Back to Lessons
          </Button>
        </div>
      </div>
    );
  }

  if (result) {
    return (
      <ResultView
        result={result}
        lessonTitle={data.lesson.title}
        onRetry={() => {
          setCurrentIndex(0);
          setAnswersByStep({});
          setTempAnswer("");
          setResult(null);
        }}
        onExit={() => navigate({ to: "/lessons" })}
      />
    );
  }

  const isLast = currentIndex === steps.length - 1;
  const progressPercent = ((currentIndex + 1) / steps.length) * 100;

  const canContinue = (() => {
    if (currentStep.stepType !== "QUESTION") return true;
    return tempAnswer.trim().length > 0;
  })();

  const persistCurrentAnswer = () => {
    if (currentStep.stepType !== "QUESTION") return;
    setAnswersByStep((prev) => ({
      ...prev,
      [currentStep.id]: tempAnswer.trim(),
    }));
  };

  const goNext = async () => {
    if (!canContinue) return;

    persistCurrentAnswer();

    if (!isLast) {
      setCurrentIndex((value) => value + 1);
      return;
    }

    const finalAnswers = {
      ...answersByStep,
      ...(currentStep.stepType === "QUESTION" ? { [currentStep.id]: tempAnswer.trim() } : {}),
    };

    const payloadAnswers = questionSteps
      .map((step) => {
        const answer = finalAnswers[step.id];
        if (!answer) return null;
        return { stepId: step.id, answer };
      })
      .filter((item): item is { stepId: number; answer: string } => item !== null);

    const submission = await submitAttempt.mutateAsync({
      lessonId: numericLessonId,
      answers: payloadAnswers,
    });
    setResult(submission);
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="border-b bg-card/60 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate({ to: "/lessons" })}
            className="gap-1.5"
          >
            <ArrowLeft className="size-4" />
            Exit
          </Button>
          <span className="text-sm font-semibold text-muted-foreground">
            {currentIndex + 1} / {steps.length}
          </span>
        </div>

        <div className="mx-auto max-w-2xl px-4 pb-3">
          <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-gradient-to-r from-chart-1 to-chart-5 transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
        <h1 className="mb-2 text-lg font-semibold text-muted-foreground">{data.lesson.title}</h1>
        <StepBody step={currentStep} tempAnswer={tempAnswer} setTempAnswer={setTempAnswer} />

        <div className="mt-8">
          <Button
            size="lg"
            className="w-full gap-2 text-base"
            onClick={() => {
              void goNext();
            }}
            disabled={!canContinue || submitAttempt.isPending}
          >
            {isLast ? (submitAttempt.isPending ? "Submitting..." : "See Results") : "Continue"}
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function StepBody({
  step,
  tempAnswer,
  setTempAnswer,
}: {
  step: LessonStepPayload;
  tempAnswer: string;
  setTempAnswer: (value: string) => void;
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

  if (!step.question) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p>Question payload missing.</p>
        </CardContent>
      </Card>
    );
  }

  if (step.question.questionType === "MCQ") {
    return (
      <div>
        <h2 className="mb-8 text-2xl font-bold sm:text-3xl">{step.question.prompt}</h2>
        <div className="space-y-3">
          {step.question.choices.map((choice) => {
            const selected = tempAnswer === choice.text;
            return (
              <button
                key={choice.id}
                type="button"
                onClick={() => setTempAnswer(choice.text)}
                className={cn(
                  "w-full rounded-xl border-2 p-4 text-left text-base font-medium transition-all sm:text-lg",
                  selected
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border bg-card text-foreground hover:border-primary/40 hover:bg-accent",
                )}
              >
                {choice.text}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (step.question.questionType === "MATCH") {
    return (
      <div>
        <h2 className="mb-4 text-2xl font-bold sm:text-3xl">{step.question.prompt}</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Enter JSON object for matches, e.g. {'{"term":"meaning"}'}
        </p>
        <Input
          value={tempAnswer}
          onChange={(event) => setTempAnswer(event.target.value)}
          placeholder='{"rizz":"charisma"}'
        />
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-4 text-2xl font-bold sm:text-3xl">{step.question.prompt}</h2>
      <Input
        value={tempAnswer}
        onChange={(event) => setTempAnswer(event.target.value)}
        placeholder="Type your answer"
      />
    </div>
  );
}

function ResultView({
  result,
  lessonTitle,
  onRetry,
  onExit,
}: {
  result: AttemptResult;
  lessonTitle: string;
  onRetry: () => void;
  onExit: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg">
        <CardContent className="pt-8 text-center">
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
            {!result.passed && (
              <Button size="lg" className="w-full text-base" onClick={onRetry}>
                Try Again
              </Button>
            )}
            <Button size="lg" variant="default" className="w-full text-base" onClick={onExit}>
              Back to Lessons
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
