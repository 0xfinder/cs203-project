import { useState, useEffect, useRef } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CheckCircle2, XCircle, ArrowRight, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireOnboardingCompleted } from "@/lib/auth";
import { lessons } from "@/features/lessons/lessonData";
import type { ProgressMap } from "@/features/lessons/useLessonProgress";
import { cn } from "@/lib/utils";

const STORAGE_KEYS = {
  progress: "alphaLingoProgress",
  streak: "alphaLingoStreak",
  xp: "alphaLingoTotalXP",
  lastPractice: "alphaLingoLastPractice",
} as const;

export const Route = createFileRoute("/lesson/$lessonId")({
  beforeLoad: async () => {
    await requireOnboardingCompleted();
  },
  component: LessonPage,
});

interface Answer {
  questionId: string;
  selectedAnswer: string;
  correct: boolean;
}

function LessonPage() {
  const { lessonId } = Route.useParams();
  const navigate = useNavigate();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [showResults, setShowResults] = useState(false);
  const hasSavedProgressRef = useRef(false);

  const lesson = lessons.find((l) => l.id === lessonId);

  // reset when lesson changes
  useEffect(() => {
    setCurrentIndex(0);
    setSelected(null);
    setShowExplanation(false);
    setAnswers([]);
    setShowResults(false);
    hasSavedProgressRef.current = false;
  }, [lessonId]);

  if (!lesson) {
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

  const question = lesson.questions[currentIndex];
  const isLast = currentIndex === lesson.questions.length - 1;

  const handleSelect = (answer: string) => {
    if (showExplanation) return;
    setSelected(answer);
  };

  const handleCheck = () => {
    if (!selected) return;
    const correct = selected === question.correctAnswer;
    setAnswers((prev) => [...prev, { questionId: question.id, selectedAnswer: selected, correct }]);
    setShowExplanation(true);
  };

  const handleNext = () => {
    if (isLast) {
      setShowResults(true);
    } else {
      setCurrentIndex((i) => i + 1);
      setSelected(null);
      setShowExplanation(false);
    }
  };

  const calculateScore = () => {
    const correct = answers.filter((a) => a.correct).length;
    return Math.round((correct / lesson.questions.length) * 100);
  };

  const saveProgress = () => {
    const score = calculateScore();
    const passed = score >= 60;

    const raw = localStorage.getItem(STORAGE_KEYS.progress);
    const progress: ProgressMap = raw ? JSON.parse(raw) : {};
    const prev = progress[lesson.id] ?? { attempts: 0, score: 0, completed: false };

    progress[lesson.id] = {
      completed: passed || prev.completed,
      score: Math.max(score, prev.score),
      attempts: prev.attempts + 1,
    };
    localStorage.setItem(STORAGE_KEYS.progress, JSON.stringify(progress));

    // xp
    const currentXP = parseInt(localStorage.getItem(STORAGE_KEYS.xp) ?? "0", 10);
    localStorage.setItem(STORAGE_KEYS.xp, String(currentXP + score));

    // streak
    const today = new Date().toDateString();
    const lastPractice = localStorage.getItem(STORAGE_KEYS.lastPractice);
    if (lastPractice !== today) {
      const currentStreak = parseInt(localStorage.getItem(STORAGE_KEYS.streak) ?? "0", 10);
      localStorage.setItem(STORAGE_KEYS.streak, String(currentStreak + 1));
      localStorage.setItem(STORAGE_KEYS.lastPractice, today);
    }
  };

  const retry = () => {
    setCurrentIndex(0);
    setSelected(null);
    setShowExplanation(false);
    setAnswers([]);
    setShowResults(false);
    hasSavedProgressRef.current = false;
  };

  useEffect(() => {
    if (!showResults) return;
    if (hasSavedProgressRef.current) return;

    saveProgress();
    hasSavedProgressRef.current = true;
  }, [showResults]);

  // ---------- results screen ----------
  if (showResults) {
    const score = calculateScore();
    const correctCount = answers.filter((a) => a.correct).length;
    const passed = score >= 60;

    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-lg">
          <CardContent className="pt-8 text-center">
            <div
              className={cn(
                "mx-auto mb-6 flex size-24 items-center justify-center rounded-full bg-gradient-to-br text-5xl",
                passed ? lesson.color : "from-muted to-muted-foreground/30",
              )}
            >
              {passed ? "🎉" : "😅"}
            </div>

            <h2 className="mb-2 text-3xl font-bold">
              {passed ? "Lesson Complete!" : "Keep Practicing!"}
            </h2>
            <p className="mb-6 text-muted-foreground">
              {passed
                ? "No cap, you slayed this lesson! 🔥"
                : "You got this! Try again to unlock the next lesson."}
            </p>

            <div className="mb-6 rounded-2xl bg-secondary p-6">
              <div className="mb-1 text-5xl font-bold">{score}%</div>
              <p className="text-sm text-muted-foreground">
                {correctCount} out of {lesson.questions.length} correct
              </p>
            </div>

            <div className="flex flex-col gap-3">
              {!passed && (
                <Button size="lg" className="w-full text-base" onClick={retry}>
                  Try Again
                </Button>
              )}
              <Button
                size="lg"
                variant={passed ? "default" : "secondary"}
                className="w-full text-base"
                onClick={() => navigate({ to: "/lessons" })}
              >
                {passed ? "Continue" : "Back to Lessons"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ---------- quiz screen ----------
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* top bar */}
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
            {currentIndex + 1} / {lesson.questions.length}
          </span>
        </div>

        {/* progress bar */}
        <div className="mx-auto max-w-2xl px-4 pb-3">
          <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className={cn(
                "h-full rounded-full bg-gradient-to-r transition-all duration-300",
                lesson.color,
              )}
              style={{ width: `${((currentIndex + 1) / lesson.questions.length) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* question body */}
      <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
        <h2 className="mb-8 text-2xl font-bold sm:text-3xl">{question.question}</h2>

        {/* options */}
        <div className="mb-8 space-y-3">
          {question.options?.map((option) => {
            const isSelected = selected === option;
            const isCorrect = option === question.correctAnswer;

            return (
              <button
                key={option}
                type="button"
                disabled={showExplanation}
                onClick={() => handleSelect(option)}
                className={cn(
                  "w-full rounded-xl border-2 p-4 text-left text-base font-medium transition-all sm:text-lg",
                  showExplanation
                    ? isCorrect
                      ? "border-success bg-success/10 text-foreground"
                      : isSelected
                        ? "border-destructive bg-destructive/10 text-foreground"
                        : "border-border bg-card text-muted-foreground"
                    : isSelected
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border bg-card text-foreground hover:border-primary/40 hover:bg-accent",
                )}
              >
                <span className="flex items-center justify-between">
                  <span>{option}</span>
                  {showExplanation && isCorrect && (
                    <CheckCircle2 className="size-5 shrink-0 text-success" />
                  )}
                  {showExplanation && isSelected && !isCorrect && (
                    <XCircle className="size-5 shrink-0 text-destructive" />
                  )}
                </span>
              </button>
            );
          })}
        </div>

        {/* explanation */}
        {showExplanation && (
          <Card className="mb-8 border-chart-1/30 bg-chart-1/5">
            <CardContent className="pt-5">
              <p className="mb-1 text-sm font-bold">
                {selected === question.correctAnswer ? "✅ Correct!" : "❌ Not quite!"}
              </p>
              <p className="text-sm text-muted-foreground">{question.explanation}</p>
            </CardContent>
          </Card>
        )}

        {/* action button */}
        {!showExplanation ? (
          <Button size="lg" className="w-full text-base" disabled={!selected} onClick={handleCheck}>
            Check Answer
          </Button>
        ) : (
          <Button size="lg" className="w-full gap-2 text-base" onClick={handleNext}>
            {isLast ? "See Results" : "Next Question"}
            <ArrowRight className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
