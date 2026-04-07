import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronUp,
  ClipboardList,
  MessageSquareMore,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { api } from "@/lib/api";
import { getMe } from "@/lib/me";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useUnits } from "@/features/lessons/useLessonsApi";

type DraftStepType = "TEACH" | "DIALOGUE" | "QUESTION" | "RECAP";
type DraftQuestionType = "SHORT_ANSWER" | "MCQ" | "MATCH";

type DraftStep =
  | {
      id: string;
      stepType: "TEACH";
      title: string;
      body: string;
      example: string;
    }
  | {
      id: string;
      stepType: "DIALOGUE";
      dialogueText: string;
    }
  | {
      id: string;
      stepType: "QUESTION";
      questionType: DraftQuestionType;
      prompt: string;
      acceptedAnswers: string[];
      choices: Array<{ id: number; text: string; isCorrect?: boolean }>;
      matchPairs: Array<{ id: number | string; left: string; right: string }>;
    }
  | {
      id: string;
      stepType: "RECAP";
      headline: string;
      summary: string;
      takeaways: string[];
    };

function createStepId() {
  return `step-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createChoice() {
  return { id: Date.now(), text: "", isCorrect: false };
}

function createPair() {
  return { id: Date.now(), left: "", right: "" };
}

function summarizeStep(step: DraftStep) {
  switch (step.stepType) {
    case "TEACH":
      return {
        title: step.title || "Learn step",
        detail: step.body || "No teaching copy yet.",
      };
    case "DIALOGUE":
      return {
        title: "Dialogue",
        detail: step.dialogueText.split("\n")[0] || "No dialogue yet.",
      };
    case "QUESTION":
      return {
        title:
          step.questionType === "MCQ"
            ? "Multiple choice"
            : step.questionType === "MATCH"
              ? "Matching"
              : "Short answer",
        detail: step.prompt || "No prompt yet.",
      };
    case "RECAP":
      return {
        title: step.headline || "Recap",
        detail: step.summary || "No summary yet.",
      };
  }
}

export function LessonForm({ defaultUnitId }: { defaultUnitId?: number } = {}) {
  const { data: units } = useUnits();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const allUnits = useMemo(() => {
    const base = Array.isArray(units) ? units.slice() : [];
    return base.filter((u: any) => !String(u.title).includes("(test)"));
  }, [units]);

  const [unitId, setUnitId] = useState<number | null>(null);
  const [lessonTitle, setLessonTitle] = useState("");
  const [lessonDescription, setLessonDescription] = useState("");
  const [learningObjective, setLearningObjective] = useState("");
  const [estimatedMinutes, setEstimatedMinutes] = useState("");

  const [activeStepType, setActiveStepType] = useState<DraftStepType>("TEACH");
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [steps, setSteps] = useState<DraftStep[]>([]);

  const [teachTitle, setTeachTitle] = useState("");
  const [teachBody, setTeachBody] = useState("");
  const [teachExample, setTeachExample] = useState("");
  const [dialogueText, setDialogueText] = useState("");
  const [questionType, setQuestionType] = useState<DraftQuestionType>("SHORT_ANSWER");
  const [qPrompt, setQPrompt] = useState("");
  const [qAcceptedAnswers, setQAcceptedAnswers] = useState("");
  const [qChoices, setQChoices] = useState<
    Array<{ id: number; text: string; isCorrect?: boolean }>
  >([createChoice()]);
  const [qMatchPairs, setQMatchPairs] = useState<
    Array<{ id: number | string; left: string; right: string }>
  >([createPair()]);
  const [recapHeadline, setRecapHeadline] = useState("Quick recap");
  const [recapSummary, setRecapSummary] = useState("");
  const [recapTakeaways, setRecapTakeaways] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (allUnits && allUnits.length > 0 && unitId === null) {
      let targetId: number | null = null;

      try {
        const stored = sessionStorage.getItem("contentFormUnitId");
        if (stored) {
          targetId = Number(stored);
          sessionStorage.removeItem("contentFormUnitId");
        }
      } catch (e) {
        console.error("failed to read unit id from session storage:", e);
      }

      if (!targetId && defaultUnitId !== undefined && defaultUnitId !== null) {
        const found = allUnits.find((u: any) => u.id === defaultUnitId);
        targetId = found ? defaultUnitId : null;
      }

      if (targetId) {
        setUnitId(targetId);
      } else {
        setUnitId(allUnits[0].id);
      }
    }
  }, [allUnits, unitId, defaultUnitId]);

  if (allUnits.length === 0) {
    return (
      <Card className="border-dashed border-border/70 bg-background/70">
        <CardContent className="p-6 text-sm text-muted-foreground">
          No units exist yet. An admin needs to create a unit before lessons can be authored.
        </CardContent>
      </Card>
    );
  }

  const resetStepEditor = () => {
    setEditingStepId(null);
    setTeachTitle("");
    setTeachBody("");
    setTeachExample("");
    setDialogueText("");
    setQuestionType("SHORT_ANSWER");
    setQPrompt("");
    setQAcceptedAnswers("");
    setQChoices([createChoice()]);
    setQMatchPairs([createPair()]);
    setRecapHeadline("Quick recap");
    setRecapSummary("");
    setRecapTakeaways("");
  };

  const loadStepIntoEditor = (step: DraftStep) => {
    setEditingStepId(step.id);
    setActiveStepType(step.stepType);

    if (step.stepType === "TEACH") {
      setTeachTitle(step.title);
      setTeachBody(step.body);
      setTeachExample(step.example);
      return;
    }

    if (step.stepType === "DIALOGUE") {
      setDialogueText(step.dialogueText);
      return;
    }

    if (step.stepType === "QUESTION") {
      setQuestionType(step.questionType);
      setQPrompt(step.prompt);
      setQAcceptedAnswers(step.acceptedAnswers.join(", "));
      setQChoices(step.choices.length > 0 ? step.choices : [createChoice()]);
      setQMatchPairs(step.matchPairs.length > 0 ? step.matchPairs : [createPair()]);
      return;
    }

    setRecapHeadline(step.headline);
    setRecapSummary(step.summary);
    setRecapTakeaways(step.takeaways.join("\n"));
  };

  const buildDraftStep = (): DraftStep | null => {
    if (activeStepType === "TEACH") {
      if (!teachTitle.trim() || !teachBody.trim()) {
        setError("Learn steps need a title and body.");
        return null;
      }
      return {
        id: editingStepId ?? createStepId(),
        stepType: "TEACH",
        title: teachTitle.trim(),
        body: teachBody.trim(),
        example: teachExample.trim(),
      };
    }

    if (activeStepType === "DIALOGUE") {
      if (!dialogueText.trim()) {
        setError("Dialogue steps need dialogue text.");
        return null;
      }
      return {
        id: editingStepId ?? createStepId(),
        stepType: "DIALOGUE",
        dialogueText: dialogueText.trim(),
      };
    }

    if (activeStepType === "QUESTION") {
      if (!qPrompt.trim()) {
        setError("Question steps need a prompt.");
        return null;
      }

      if (questionType === "SHORT_ANSWER") {
        const answers = qAcceptedAnswers
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean);
        if (answers.length === 0) {
          setError("Short answer questions need at least one accepted answer.");
          return null;
        }
        return {
          id: editingStepId ?? createStepId(),
          stepType: "QUESTION",
          questionType,
          prompt: qPrompt.trim(),
          acceptedAnswers: answers,
          choices: [],
          matchPairs: [],
        };
      }

      if (questionType === "MCQ") {
        const choices = qChoices.map((choice) => ({ ...choice, text: choice.text.trim() }));
        const validChoices = choices.filter((choice) => choice.text.length > 0);
        const correctCount = validChoices.filter((choice) => !!choice.isCorrect).length;
        if (validChoices.length < 2) {
          setError("Multiple choice questions need at least two choices.");
          return null;
        }
        if (correctCount !== 1) {
          setError("Multiple choice questions need exactly one correct answer.");
          return null;
        }
        return {
          id: editingStepId ?? createStepId(),
          stepType: "QUESTION",
          questionType,
          prompt: qPrompt.trim(),
          acceptedAnswers: [],
          choices: validChoices,
          matchPairs: [],
        };
      }

      const pairs = qMatchPairs
        .map((pair) => ({ ...pair, left: pair.left.trim(), right: pair.right.trim() }))
        .filter((pair) => pair.left && pair.right);
      if (pairs.length < 2) {
        setError("Matching questions need at least two pairs.");
        return null;
      }
      return {
        id: editingStepId ?? createStepId(),
        stepType: "QUESTION",
        questionType,
        prompt: qPrompt.trim(),
        acceptedAnswers: [],
        choices: [],
        matchPairs: pairs,
      };
    }

    const takeaways = recapTakeaways
      .split("\n")
      .map((value) => value.trim())
      .filter(Boolean);
    if (!recapHeadline.trim() || !recapSummary.trim()) {
      setError("Recap steps need a headline and summary.");
      return null;
    }
    return {
      id: editingStepId ?? createStepId(),
      stepType: "RECAP",
      headline: recapHeadline.trim(),
      summary: recapSummary.trim(),
      takeaways,
    };
  };

  const handleAddOrUpdateStep = () => {
    setError(null);
    const step = buildDraftStep();
    if (!step) return;

    setSteps((current) => {
      if (editingStepId) {
        return current.map((item) => (item.id === editingStepId ? step : item));
      }
      return [...current, step];
    });
    resetStepEditor();
  };

  const moveStep = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= steps.length) return;
    setSteps((current) => {
      const copy = current.slice();
      const [step] = copy.splice(index, 1);
      copy.splice(nextIndex, 0, step);
      return copy;
    });
  };

  const removeStep = (stepId: string) => {
    setSteps((current) => current.filter((step) => step.id !== stepId));
    if (editingStepId === stepId) {
      resetStepEditor();
    }
  };

  const resetLessonForm = () => {
    setLessonTitle("");
    setLessonDescription("");
    setLearningObjective("");
    setEstimatedMinutes("");
    setSteps([]);
    resetStepEditor();
  };

  const createTeachStepPayload = async (
    step: Extract<DraftStep, { stepType: "TEACH" }>,
    orderIndex: number,
  ) => {
    const created = await api
      .post("vocab", {
        json: {
          term: step.title,
          definition: step.body,
          example: step.example || null,
        },
      })
      .json<any>();

    return {
      orderIndex,
      stepType: "TEACH",
      vocabItemId: created.id,
    };
  };

  const createApiStepPayload = async (step: DraftStep, orderIndex: number) => {
    if (step.stepType === "TEACH") {
      return createTeachStepPayload(step, orderIndex);
    }

    if (step.stepType === "DIALOGUE") {
      return {
        orderIndex,
        stepType: "DIALOGUE",
        dialogueText: step.dialogueText,
      };
    }

    if (step.stepType === "QUESTION") {
      if (step.questionType === "SHORT_ANSWER") {
        return {
          orderIndex,
          stepType: "QUESTION",
          questionType: step.questionType,
          prompt: step.prompt,
          acceptedAnswers: step.acceptedAnswers,
        };
      }

      if (step.questionType === "MCQ") {
        return {
          orderIndex,
          stepType: "QUESTION",
          questionType: step.questionType,
          prompt: step.prompt,
          options: step.choices.map((choice) => choice.text),
          correctOptionIndex: step.choices.findIndex((choice) => !!choice.isCorrect),
        };
      }

      return {
        orderIndex,
        stepType: "QUESTION",
        questionType: step.questionType,
        prompt: step.prompt,
        matchPairs: step.matchPairs.map((pair) => ({ left: pair.left, right: pair.right })),
      };
    }

    return {
      orderIndex,
      stepType: "RECAP",
      payload: {
        headline: step.headline,
        summary: step.summary,
        takeaways: step.takeaways,
      },
    };
  };

  const handleSubmitLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!unitId) {
      setError("Pick a unit before creating a lesson.");
      return;
    }
    if (!lessonTitle.trim()) {
      setError("Lesson title is required.");
      return;
    }
    if (!lessonDescription.trim()) {
      setError("Lesson summary is required.");
      return;
    }
    if (steps.length === 0) {
      setError("Add at least one step before submitting the lesson.");
      return;
    }

    setLoading(true);
    let createdLessonId: number | null = null;

    try {
      const me = await getMe();
      const isAdmin = me.role === "ADMIN" || me.role === "MODERATOR";
      const created = await api
        .post("lessons", {
          json: {
            unitId,
            title: lessonTitle.trim(),
            description: lessonDescription.trim(),
            learningObjective: learningObjective.trim() || null,
            estimatedMinutes: estimatedMinutes.trim() ? Number(estimatedMinutes) : null,
          },
        })
        .json<any>();

      createdLessonId = created.id;

      for (const [index, step] of steps.entries()) {
        const payload = await createApiStepPayload(step, index + 1);
        await api.post(`lessons/${createdLessonId}/steps`, { json: payload }).json();
      }

      const firstStep = steps[0];

      if (isAdmin) {
        await api
          .patch(`lessons/${createdLessonId}`, { json: { status: "PENDING_REVIEW" } })
          .json();
        await api.patch(`lessons/${createdLessonId}`, { json: { status: "APPROVED" } }).json();
        void queryClient.invalidateQueries({ queryKey: ["units"] });
        setSuccess("Lesson published and added to the curriculum.");
      } else {
        await api
          .patch(`lessons/${createdLessonId}`, { json: { status: "PENDING_REVIEW" } })
          .json();
        const summary = {
          id: created.id,
          unitId: created.unitId ?? unitId,
          title: created.title ?? lessonTitle.trim(),
          slug: created.slug ?? (created.id ? `lesson-${created.id}` : undefined),
          description: created.description ?? lessonDescription.trim(),
          learningObjective: created.learningObjective ?? (learningObjective.trim() || null),
          estimatedMinutes:
            created.estimatedMinutes ?? (estimatedMinutes.trim() ? Number(estimatedMinutes) : null),
          orderIndex: created.orderIndex ?? 0,
          status: "PENDING_REVIEW",
          firstStepType: firstStep?.stepType ?? null,
          firstQuestionType: firstStep?.stepType === "QUESTION" ? firstStep.questionType : null,
        };

        queryClient.setQueryData(["lessons", "pending"], (old: any) => {
          if (!old) return [summary];
          return [summary, ...old];
        });

        try {
          const key = "pendingLessonMeta";
          const raw = localStorage.getItem(key);
          const map = raw ? JSON.parse(raw) : {};
          map[created.id] = {
            firstStepType: summary.firstStepType,
            firstQuestionType: summary.firstQuestionType,
            firstStepPrompt: firstStep?.stepType === "QUESTION" ? firstStep.prompt : null,
          };
          localStorage.setItem(key, JSON.stringify(map));
        } catch (storageError) {
          console.error("failed to save pending lesson metadata:", storageError);
        }

        setSuccess("Lesson submitted for review.");
        setTimeout(() => {
          try {
            sessionStorage.setItem("reviewActiveSub", "lesson");
          } catch (storageError) {
            console.error("failed to set review active sub in session storage:", storageError);
          }
          void navigate({ to: "/review" });
        }, 800);
      }

      resetLessonForm();
    } catch (err: any) {
      console.error(err);
      if (createdLessonId != null) {
        try {
          await api.delete(`lessons/${createdLessonId}`);
        } catch (cleanupError) {
          console.error("failed to clean up partially created lesson:", cleanupError);
        }
      }

      let message = "Failed to create lesson. Try again.";
      try {
        if (err?.response) {
          const res = err.response;
          let body: any = null;
          try {
            body = await res.json();
          } catch {
            body = await res.text().catch(() => null);
          }
          const status = res.status;
          const bodyMsg =
            body && typeof body === "object"
              ? (body.message ?? body.detail ?? JSON.stringify(body))
              : body;
          message = `Failed to create lesson (${status}): ${bodyMsg ?? err?.message ?? "unknown"}`;
        } else if (err?.message) {
          message = err.message;
        }
      } catch (formatError) {
        console.error("failed to format lesson creation error:", formatError);
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const typeButtonClass = (stepType: DraftStepType) =>
    cn(
      "rounded-full border px-4 py-2 text-sm font-semibold transition-colors",
      activeStepType === stepType
        ? "border-primary bg-primary text-primary-foreground"
        : "border-border bg-background text-foreground hover:bg-accent",
    );

  return (
    <form onSubmit={handleSubmitLesson} className="space-y-6">
      <Card className="border-chart-1/20 bg-gradient-to-br from-chart-1/10 via-background to-chart-2/10">
        <CardHeader className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                lesson builder
              </p>
              <CardTitle className="mt-2 text-2xl">
                Build the lesson before it goes to review
              </CardTitle>
            </div>
            <Badge variant="outline" className="border-chart-1/30 bg-background/80 px-3 py-1">
              {steps.length} step{steps.length === 1 ? "" : "s"}
            </Badge>
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Contributors submit complete lessons for review. Admins can publish the lesson
            immediately.
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="lesson-unit">Unit</Label>
            <select
              id="lesson-unit"
              name="unitId"
              value={unitId ?? ""}
              onChange={(e) => setUnitId(Number(e.target.value))}
              className="mt-1 w-full rounded-md border bg-card px-3 py-2"
            >
              {allUnits?.map((unit: any) => (
                <option key={unit.id} value={unit.id}>
                  {unit.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="lesson-minutes">Estimated minutes</Label>
            <Input
              id="lesson-minutes"
              type="number"
              min="1"
              value={estimatedMinutes}
              onChange={(e) => setEstimatedMinutes(e.target.value)}
              placeholder="8"
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="lesson-title">Lesson title</Label>
            <Input
              id="lesson-title"
              value={lessonTitle}
              onChange={(e) => setLessonTitle(e.target.value)}
              placeholder="Why “mid” became a drag"
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="lesson-description">Lesson summary</Label>
            <textarea
              id="lesson-description"
              value={lessonDescription}
              onChange={(e) => setLessonDescription(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-md border bg-card px-3 py-2"
              placeholder="Describe what this lesson teaches and why it matters."
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="lesson-objective">Learning objective (optional)</Label>
            <Input
              id="lesson-objective"
              value={learningObjective}
              onChange={(e) => setLearningObjective(e.target.value)}
              placeholder="Learners can explain how the term is used and when not to use it."
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
        <Card className="border-border/80">
          <CardHeader className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  current step
                </p>
                <CardTitle className="mt-2 text-xl">
                  {editingStepId ? "Edit step" : "Add a step"}
                </CardTitle>
              </div>
              {editingStepId ? (
                <Button type="button" variant="ghost" onClick={resetStepEditor}>
                  Cancel edit
                </Button>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={typeButtonClass("TEACH")}
                onClick={() => setActiveStepType("TEACH")}
              >
                Learn
              </button>
              <button
                type="button"
                className={typeButtonClass("QUESTION")}
                onClick={() => setActiveStepType("QUESTION")}
              >
                Question
              </button>
              <button
                type="button"
                className={typeButtonClass("DIALOGUE")}
                onClick={() => setActiveStepType("DIALOGUE")}
              >
                Dialogue
              </button>
              <button
                type="button"
                className={typeButtonClass("RECAP")}
                onClick={() => setActiveStepType("RECAP")}
              >
                Recap
              </button>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {activeStepType === "TEACH" ? (
              <>
                <div>
                  <Label htmlFor="teach-title">Step title</Label>
                  <Input
                    id="teach-title"
                    value={teachTitle}
                    onChange={(e) => setTeachTitle(e.target.value)}
                    placeholder="What “ate” means online"
                  />
                </div>
                <div>
                  <Label htmlFor="teach-body">Teaching copy</Label>
                  <textarea
                    id="teach-body"
                    value={teachBody}
                    onChange={(e) => setTeachBody(e.target.value)}
                    rows={5}
                    className="mt-1 w-full rounded-md border bg-card px-3 py-2"
                    placeholder="Explain the meaning, tone, and context."
                  />
                </div>
                <div>
                  <Label htmlFor="teach-example">Example (optional)</Label>
                  <Input
                    id="teach-example"
                    value={teachExample}
                    onChange={(e) => setTeachExample(e.target.value)}
                    placeholder="She ate that presentation up."
                  />
                </div>
              </>
            ) : null}

            {activeStepType === "DIALOGUE" ? (
              <div>
                <Label htmlFor="dialogue-text">Dialogue</Label>
                <textarea
                  id="dialogue-text"
                  value={dialogueText}
                  onChange={(e) => setDialogueText(e.target.value)}
                  rows={7}
                  className="mt-1 w-full rounded-md border bg-card px-3 py-2"
                  placeholder={"A: that fit ate\nB: exactly"}
                />
              </div>
            ) : null}

            {activeStepType === "QUESTION" ? (
              <div className="space-y-4">
                <div>
                  <Label>Question type</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(["SHORT_ANSWER", "MCQ", "MATCH"] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                          questionType === type
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background hover:bg-accent",
                        )}
                        onClick={() => setQuestionType(type)}
                      >
                        {type === "SHORT_ANSWER"
                          ? "Short answer"
                          : type === "MCQ"
                            ? "Multiple choice"
                            : "Matching"}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label htmlFor="question-prompt">Prompt</Label>
                  <textarea
                    id="question-prompt"
                    value={qPrompt}
                    onChange={(e) => setQPrompt(e.target.value)}
                    rows={3}
                    className="mt-1 w-full rounded-md border bg-card px-3 py-2"
                    placeholder="Which sentence uses this phrase correctly?"
                  />
                </div>

                {questionType === "SHORT_ANSWER" ? (
                  <div>
                    <Label htmlFor="question-answers">Accepted answers</Label>
                    <Input
                      id="question-answers"
                      value={qAcceptedAnswers}
                      onChange={(e) => setQAcceptedAnswers(e.target.value)}
                      placeholder="answer one, answer two"
                    />
                  </div>
                ) : null}

                {questionType === "MCQ" ? (
                  <div className="space-y-2">
                    <Label>Choices</Label>
                    {qChoices.map((choice) => (
                      <div key={choice.id} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="builder-mcq-correct"
                          checked={!!choice.isCorrect}
                          onChange={() =>
                            setQChoices((current) =>
                              current.map((item) => ({
                                ...item,
                                isCorrect: item.id === choice.id,
                              })),
                            )
                          }
                        />
                        <Input
                          value={choice.text}
                          onChange={(e) =>
                            setQChoices((current) =>
                              current.map((item) =>
                                item.id === choice.id ? { ...item, text: e.target.value } : item,
                              ),
                            )
                          }
                          placeholder="Choice text"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() =>
                            setQChoices((current) =>
                              current.filter((item) => item.id !== choice.id),
                            )
                          }
                          disabled={qChoices.length <= 2}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setQChoices((current) => [...current, createChoice()])}
                    >
                      <Plus />
                      Add choice
                    </Button>
                  </div>
                ) : null}

                {questionType === "MATCH" ? (
                  <div className="space-y-2">
                    <Label>Match pairs</Label>
                    {qMatchPairs.map((pair, index) => (
                      <div
                        key={pair.id}
                        className="grid gap-2 sm:grid-cols-[1fr_auto_1fr_auto] sm:items-center"
                      >
                        <Input
                          value={pair.left}
                          onChange={(e) =>
                            setQMatchPairs((current) =>
                              current.map((item) =>
                                item.id === pair.id ? { ...item, left: e.target.value } : item,
                              ),
                            )
                          }
                          placeholder={`Left ${index + 1}`}
                        />
                        <span className="text-center text-muted-foreground">→</span>
                        <Input
                          value={pair.right}
                          onChange={(e) =>
                            setQMatchPairs((current) =>
                              current.map((item) =>
                                item.id === pair.id ? { ...item, right: e.target.value } : item,
                              ),
                            )
                          }
                          placeholder={`Right ${index + 1}`}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() =>
                            setQMatchPairs((current) =>
                              current.filter((item) => item.id !== pair.id),
                            )
                          }
                          disabled={qMatchPairs.length <= 2}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setQMatchPairs((current) => [...current, createPair()])}
                    >
                      <Plus />
                      Add pair
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : null}

            {activeStepType === "RECAP" ? (
              <>
                <div>
                  <Label htmlFor="recap-headline">Headline</Label>
                  <Input
                    id="recap-headline"
                    value={recapHeadline}
                    onChange={(e) => setRecapHeadline(e.target.value)}
                    placeholder="What to remember"
                  />
                </div>
                <div>
                  <Label htmlFor="recap-summary">Summary</Label>
                  <textarea
                    id="recap-summary"
                    value={recapSummary}
                    onChange={(e) => setRecapSummary(e.target.value)}
                    rows={4}
                    className="mt-1 w-full rounded-md border bg-card px-3 py-2"
                    placeholder="Wrap up the idea before the learner moves on."
                  />
                </div>
                <div>
                  <Label htmlFor="recap-takeaways">Takeaways (one per line)</Label>
                  <textarea
                    id="recap-takeaways"
                    value={recapTakeaways}
                    onChange={(e) => setRecapTakeaways(e.target.value)}
                    rows={4}
                    className="mt-1 w-full rounded-md border bg-card px-3 py-2"
                    placeholder={"Use with praise\nMostly positive\nVery online tone"}
                  />
                </div>
              </>
            ) : null}

            <div className="flex justify-end">
              <Button type="button" onClick={handleAddOrUpdateStep}>
                {editingStepId ? (
                  <>
                    <Pencil />
                    Update step
                  </>
                ) : (
                  <>
                    <Plus />
                    Add step
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/80">
          <CardHeader>
            <div className="flex items-center gap-3">
              <ClipboardList className="size-5 text-chart-4" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  lesson sequence
                </p>
                <CardTitle className="mt-2 text-xl">Ordered steps</CardTitle>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {steps.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/70 bg-background/60 p-5 text-sm text-muted-foreground">
                Add steps on the left. This builder creates one lesson with a real step sequence
                instead of one-step wrapper lessons.
              </div>
            ) : (
              steps.map((step, index) => {
                const summary = summarizeStep(step);
                return (
                  <div
                    key={step.id}
                    className="rounded-2xl border border-border/70 bg-background/80 p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">Step {index + 1}</Badge>
                          <Badge variant="outline">
                            {step.stepType === "TEACH"
                              ? "Learn"
                              : step.stepType === "DIALOGUE"
                                ? "Dialogue"
                                : step.stepType === "QUESTION"
                                  ? "Question"
                                  : "Recap"}
                          </Badge>
                        </div>
                        <p className="mt-3 font-semibold">{summary.title}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{summary.detail}</p>
                      </div>

                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => moveStep(index, -1)}
                          disabled={index === 0}
                        >
                          <ChevronUp />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => moveStep(index, 1)}
                          disabled={index === steps.length - 1}
                        >
                          <ChevronDown />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => loadStepIntoEditor(step)}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => removeStep(step.id)}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}

            <div className="rounded-2xl border border-chart-2/20 bg-chart-2/10 p-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2 font-semibold text-foreground">
                <Sparkles className="size-4 text-chart-2" />
                review model
              </div>
              <p className="mt-2">
                The full lesson gets reviewed as one unit. Steps do not carry their own approval
                status.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          {success ? <p className="text-sm text-success">{success}</p> : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
        <Button type="submit" size="lg" disabled={loading}>
          {loading ? (
            "Creating lesson..."
          ) : (
            <>
              <MessageSquareMore className="size-4" />
              Submit lesson
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

export function QuizForm() {
  const { data: units } = useUnits();
  const [unitId, setUnitId] = useState<number | null>(null);
  const [quizTitle, setQuizTitle] = useState("");
  const [quizDescription, setQuizDescription] = useState("");
  const [questions, setQuestions] = useState<
    Array<{
      prompt: string;
      questionType: string;
      choices: Array<{ text: string; isCorrect?: boolean }>;
    }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (units && units.length > 0 && unitId === null) setUnitId(units[0].id);
  }, [units, unitId]);

  const addQuestion = () =>
    setQuestions((q) => [
      ...q,
      { prompt: "", questionType: "MCQ", choices: [{ text: "", isCorrect: false }] },
    ]);
  const removeQuestion = (idx: number) => setQuestions((q) => q.filter((_, i) => i !== idx));
  const updateQuestion = (idx: number, patch: Partial<any>) =>
    setQuestions((q) => q.map((qq, i) => (i === idx ? { ...qq, ...patch } : qq)));

  const handleSubmitQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const me = await getMe();
      const payload = {
        unitId,
        title: quizTitle.trim(),
        description: quizDescription.trim() || undefined,
        questions: questions.map((q, i) => ({
          orderIndex: i,
          prompt: q.prompt,
          questionType: q.questionType,
          choices: q.choices.map((c, idx) => ({
            orderIndex: idx,
            text: c.text,
            isCorrect: !!c.isCorrect,
          })),
        })),
        submittedBy: me.email ?? null,
      };

      await api.post("quizzes", { json: payload }).json();
      setSuccess("Quiz submitted — it will appear after review.");
      setQuizTitle("");
      setQuizDescription("");
      setQuestions([]);
    } catch (err) {
      console.error(err);
      setError("Failed to submit quiz. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmitQuiz} className="space-y-4">
      <div>
        <Label htmlFor="quiz-unit">Unit</Label>
        <select
          id="quiz-unit"
          name="unitId"
          value={unitId ?? ""}
          onChange={(e) => setUnitId(Number(e.target.value))}
          className="mt-1 w-full rounded-md border bg-card px-3 py-2"
        >
          {units?.map((u: any) => (
            <option key={u.id} value={u.id}>
              {u.title}
            </option>
          ))}
        </select>
      </div>

      <div>
        <Label htmlFor="quiz-title">Quiz Title</Label>
        <Input
          id="quiz-title"
          name="quizTitle"
          value={quizTitle}
          onChange={(e) => setQuizTitle(e.target.value)}
        />
      </div>

      <div>
        <Label htmlFor="quiz-description">Description</Label>
        <textarea
          id="quiz-description"
          name="quizDescription"
          value={quizDescription}
          onChange={(e) => setQuizDescription(e.target.value)}
          className="mt-1 w-full rounded-md border bg-card px-3 py-2"
          rows={3}
        />
      </div>

      <div>
        <Label>Questions</Label>
        <div className="space-y-3 mt-2">
          {questions.map((q, qi) => (
            <div key={qi} className="border p-3 rounded-md bg-background">
              <div className="flex justify-between items-center">
                <strong>Question {qi + 1}</strong>
                <div className="flex gap-2">
                  <select
                    value={q.questionType}
                    onChange={(e) => updateQuestion(qi, { questionType: e.target.value })}
                    className="rounded-md border bg-card px-2"
                  >
                    <option value="MCQ">Multiple Choice</option>
                    <option value="SHORT_ANSWER">Short Answer</option>
                    <option value="MATCH">Matching</option>
                  </select>
                  <Button type="button" variant="destructive" onClick={() => removeQuestion(qi)}>
                    Remove
                  </Button>
                </div>
              </div>

              <div className="mt-2">
                <Input
                  id={`quiz-${qi}-prompt`}
                  name={`questions[${qi}].prompt`}
                  value={q.prompt}
                  onChange={(e) => updateQuestion(qi, { prompt: e.target.value })}
                  placeholder="Question prompt"
                />
              </div>

              {q.questionType === "MCQ" && (
                <div className="mt-2 space-y-2">
                  {q.choices.map((c, ci) => (
                    <div key={ci} className="flex gap-2 items-center">
                      <input
                        id={`quiz-${qi}-choice-${ci}-isCorrect`}
                        name={`questions[${qi}].choices[${ci}].isCorrect`}
                        type="checkbox"
                        checked={!!c.isCorrect}
                        onChange={(e) =>
                          updateQuestion(qi, {
                            choices: q.choices.map((cc, idx) =>
                              idx === ci ? { ...cc, isCorrect: e.target.checked } : cc,
                            ),
                          })
                        }
                      />
                      <Input
                        id={`quiz-${qi}-choice-${ci}-text`}
                        name={`questions[${qi}].choices[${ci}].text`}
                        value={c.text}
                        onChange={(e) =>
                          updateQuestion(qi, {
                            choices: q.choices.map((cc, idx) =>
                              idx === ci ? { ...cc, text: e.target.value } : cc,
                            ),
                          })
                        }
                      />
                    </div>
                  ))}
                  <Button
                    type="button"
                    onClick={() =>
                      updateQuestion(qi, {
                        choices: [...q.choices, { text: "", isCorrect: false }],
                      })
                    }
                  >
                    Add Choice
                  </Button>
                </div>
              )}
            </div>
          ))}

          <Button type="button" onClick={addQuestion}>
            Add Question
          </Button>
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={loading}>
          {loading ? "Submitting…" : "Submit Quiz"}
        </Button>
      </div>
      {success && <p className="text-sm text-green-600">{success}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </form>
  );
}
