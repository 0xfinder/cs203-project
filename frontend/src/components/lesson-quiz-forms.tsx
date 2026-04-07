import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronUp,
  ClipboardList,
  MessageSquareMore,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUnits } from "@/features/lessons/useLessonsApi";
import { api } from "@/lib/api";
import { getMe } from "@/lib/me";
import { cn } from "@/lib/utils";

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
  return { id: Date.now() + Math.random(), text: "", isCorrect: false };
}

function createPair() {
  return { id: Date.now() + Math.random(), left: "", right: "" };
}

function summarizeStep(step: DraftStep) {
  switch (step.stepType) {
    case "TEACH":
      return {
        label: "Learn",
        title: step.title || "Learn step",
        detail: step.body || "No teaching copy yet.",
      };
    case "DIALOGUE":
      return {
        label: "Dialogue",
        title: "Dialogue",
        detail: step.dialogueText.split("\n")[0] || "No dialogue yet.",
      };
    case "QUESTION":
      return {
        label: "Question",
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
        label: "Recap",
        title: step.headline || "Recap",
        detail: step.summary || "No summary yet.",
      };
  }
}

const fieldClass =
  "mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm transition-colors outline-none placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20";

export function LessonForm({ defaultUnitId }: { defaultUnitId?: number } = {}) {
  const { data: units } = useUnits();
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
  >([createChoice(), createChoice()]);
  const [qMatchPairs, setQMatchPairs] = useState<
    Array<{ id: number | string; left: string; right: string }>
  >([createPair(), createPair()]);
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
      <Card className="border-0 bg-muted/30 shadow-none">
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
    setQChoices([createChoice(), createChoice()]);
    setQMatchPairs([createPair(), createPair()]);
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
      setQChoices(step.choices.length > 0 ? step.choices : [createChoice(), createChoice()]);
      setQMatchPairs(step.matchPairs.length > 0 ? step.matchPairs : [createPair(), createPair()]);
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

  return (
    <form onSubmit={handleSubmitLesson} className="space-y-6">
      <Card className="border-border/60 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Add Lesson</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="lesson-unit">Unit</Label>
            <select
              id="lesson-unit"
              name="unitId"
              value={unitId ?? ""}
              onChange={(e) => setUnitId(Number(e.target.value))}
              className={fieldClass}
            >
              {allUnits.map((unit: any) => (
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
              className={fieldClass}
            />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="lesson-title">Lesson title</Label>
            <Input
              id="lesson-title"
              value={lessonTitle}
              onChange={(e) => setLessonTitle(e.target.value)}
              placeholder="Why “mid” became a drag"
              className={fieldClass}
            />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="lesson-description">Lesson summary</Label>
            <textarea
              id="lesson-description"
              value={lessonDescription}
              onChange={(e) => setLessonDescription(e.target.value)}
              rows={3}
              className={fieldClass}
              placeholder="Describe what this lesson teaches and why it matters."
            />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="lesson-objective">Learning objective</Label>
            <Input
              id="lesson-objective"
              value={learningObjective}
              onChange={(e) => setLearningObjective(e.target.value)}
              placeholder="Optional"
              className={fieldClass}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="space-y-4 pb-4">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-lg">{editingStepId ? "Edit Step" : "Add Step"}</CardTitle>
              {editingStepId ? (
                <Button type="button" variant="ghost" onClick={resetStepEditor}>
                  Cancel
                </Button>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              {(["TEACH", "QUESTION", "DIALOGUE", "RECAP"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  className={cn(
                    "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                    activeStepType === type
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-foreground hover:bg-accent",
                  )}
                  onClick={() => setActiveStepType(type)}
                >
                  {type === "TEACH"
                    ? "Learn"
                    : type === "QUESTION"
                      ? "Question"
                      : type === "DIALOGUE"
                        ? "Dialogue"
                        : "Recap"}
                </button>
              ))}
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
                    className={fieldClass}
                  />
                </div>
                <div>
                  <Label htmlFor="teach-body">Teaching copy</Label>
                  <textarea
                    id="teach-body"
                    value={teachBody}
                    onChange={(e) => setTeachBody(e.target.value)}
                    rows={5}
                    className={fieldClass}
                    placeholder="Explain the meaning, tone, and context."
                  />
                </div>
                <div>
                  <Label htmlFor="teach-example">Example</Label>
                  <Input
                    id="teach-example"
                    value={teachExample}
                    onChange={(e) => setTeachExample(e.target.value)}
                    placeholder="She ate that presentation up."
                    className={fieldClass}
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
                  className={fieldClass}
                  placeholder={"A: that fit ate\nB: exactly"}
                />
              </div>
            ) : null}

            {activeStepType === "QUESTION" ? (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {(["SHORT_ANSWER", "MCQ", "MATCH"] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                        questionType === type
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background text-foreground hover:bg-accent",
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

                <div>
                  <Label htmlFor="question-prompt">Prompt</Label>
                  <textarea
                    id="question-prompt"
                    value={qPrompt}
                    onChange={(e) => setQPrompt(e.target.value)}
                    rows={3}
                    className={fieldClass}
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
                      className={fieldClass}
                    />
                  </div>
                ) : null}

                {questionType === "MCQ" ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <Label>Choices</Label>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setQChoices((current) => [...current, createChoice()])}
                      >
                        <Plus />
                        Add choice
                      </Button>
                    </div>
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
                          className="flex-1"
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
                  </div>
                ) : null}

                {questionType === "MATCH" ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <Label>Match pairs</Label>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setQMatchPairs((current) => [...current, createPair()])}
                      >
                        <Plus />
                        Add pair
                      </Button>
                    </div>
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
                    className={fieldClass}
                  />
                </div>
                <div>
                  <Label htmlFor="recap-summary">Summary</Label>
                  <textarea
                    id="recap-summary"
                    value={recapSummary}
                    onChange={(e) => setRecapSummary(e.target.value)}
                    rows={4}
                    className={fieldClass}
                    placeholder="Wrap up the idea before the learner moves on."
                  />
                </div>
                <div>
                  <Label htmlFor="recap-takeaways">Takeaways</Label>
                  <textarea
                    id="recap-takeaways"
                    value={recapTakeaways}
                    onChange={(e) => setRecapTakeaways(e.target.value)}
                    rows={4}
                    className={fieldClass}
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

        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <ClipboardList className="size-5 text-chart-4" />
              <CardTitle className="text-lg">Steps</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {steps.length === 0 ? (
              <div className="rounded-2xl border border-border bg-background/70 p-4 text-sm text-muted-foreground">
                No steps yet.
              </div>
            ) : (
              steps.map((step, index) => {
                const summary = summarizeStep(step);

                return (
                  <div key={step.id} className="rounded-2xl bg-background/85 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">Step {index + 1}</Badge>
                          <Badge variant="outline">{summary.label}</Badge>
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
