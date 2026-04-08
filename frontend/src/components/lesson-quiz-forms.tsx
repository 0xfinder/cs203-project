import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronUp,
  ClipboardList,
  MessageSquareMore,
  Pencil,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  type LessonDetail,
  type LessonStepPayload,
  useLessonForEdit,
  useUnits,
} from "@/features/lessons/useLessonsApi";
import { api } from "@/lib/api";
import { getMe } from "@/lib/me";
import { cn } from "@/lib/utils";

type DraftStepType = "TEACH" | "DIALOGUE" | "QUESTION" | "RECAP";
type DraftQuestionType = "SHORT_ANSWER" | "MCQ" | "MATCH";

type DraftChoice = {
  id: number | string;
  text: string;
  isCorrect?: boolean;
};

type DraftMatchPair = {
  id: number | string;
  left: string;
  right: string;
};

type DraftStepBase = {
  id: string;
  remoteId?: number;
};

type DraftStep =
  | (DraftStepBase & {
      stepType: "TEACH";
      vocabItemId?: number | null;
      title: string;
      body: string;
      example: string;
    })
  | (DraftStepBase & {
      stepType: "DIALOGUE";
      dialogueText: string;
    })
  | (DraftStepBase & {
      stepType: "QUESTION";
      questionType: DraftQuestionType;
      prompt: string;
      acceptedAnswers: string[];
      choices: DraftChoice[];
      matchPairs: DraftMatchPair[];
    })
  | (DraftStepBase & {
      stepType: "RECAP";
      headline: string;
      summary: string;
      takeaways: string[];
    });

type LessonFormProps = {
  defaultUnitId?: number;
  lessonId?: number;
  onSaved?: (lessonId: number) => void;
};

function createStepId() {
  return `step-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createChoice(): DraftChoice {
  return { id: Date.now() + Math.random(), text: "", isCorrect: false };
}

function createPair(): DraftMatchPair {
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

function createDraftStepFromDetail(step: LessonStepPayload): DraftStep {
  if (step.stepType === "TEACH") {
    return {
      id: `remote-step-${step.id}`,
      remoteId: step.id,
      stepType: "TEACH",
      vocabItemId: step.vocab?.id ?? null,
      title: readStringField(step.payload, "title") ?? step.vocab?.term ?? "",
      body: readStringField(step.payload, "body") ?? step.vocab?.definition ?? "",
      example: readStringField(step.payload, "example") ?? step.vocab?.exampleSentence ?? "",
    };
  }

  if (step.stepType === "DIALOGUE") {
    return {
      id: `remote-step-${step.id}`,
      remoteId: step.id,
      stepType: "DIALOGUE",
      dialogueText: step.dialogueText ?? "",
    };
  }

  if (step.stepType === "QUESTION" && step.question) {
    return {
      id: `remote-step-${step.id}`,
      remoteId: step.id,
      stepType: "QUESTION",
      questionType: step.question.questionType,
      prompt: step.question.prompt ?? "",
      acceptedAnswers: step.question.acceptedAnswers ?? [],
      choices:
        step.question.choices?.map((choice) => ({
          id: choice.id,
          text: choice.text,
          isCorrect: !!choice.isCorrect,
        })) ?? [],
      matchPairs:
        step.question.matchPairs?.map((pair) => ({
          id: pair.id,
          left: pair.left,
          right: pair.right ?? "",
        })) ?? [],
    };
  }

  return {
    id: `remote-step-${step.id}`,
    remoteId: step.id,
    stepType: "RECAP",
    headline: readStringField(step.payload, "headline") ?? "Quick recap",
    summary: readStringField(step.payload, "summary") ?? "",
    takeaways: readStringArrayField(step.payload, "takeaways"),
  };
}

const fieldClass =
  "mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm transition-colors outline-none placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20";

export function LessonForm({ defaultUnitId, lessonId, onSaved }: LessonFormProps = {}) {
  const isEditMode = typeof lessonId === "number" && lessonId > 0;
  const { data: units } = useUnits();
  const {
    data: lessonDetail,
    isLoading: isLessonLoading,
    error: lessonLoadError,
  } = useLessonForEdit(lessonId ?? 0);
  const queryClient = useQueryClient();

  const allUnits = useMemo(() => {
    const base = Array.isArray(units) ? units.slice() : [];
    return base.filter((unit: any) => !String(unit.title).includes("(test)"));
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
  const [qChoices, setQChoices] = useState<DraftChoice[]>([createChoice(), createChoice()]);
  const [qMatchPairs, setQMatchPairs] = useState<DraftMatchPair[]>([createPair(), createPair()]);
  const [recapHeadline, setRecapHeadline] = useState("Quick recap");
  const [recapSummary, setRecapSummary] = useState("");
  const [recapTakeaways, setRecapTakeaways] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const currentStatus = lessonDetail?.status ?? "DRAFT";

  useEffect(() => {
    if (!isEditMode && allUnits.length > 0 && unitId === null) {
      let targetId: number | null = null;

      try {
        const stored = sessionStorage.getItem("contentFormUnitId");
        if (stored) {
          targetId = Number(stored);
          sessionStorage.removeItem("contentFormUnitId");
        }
      } catch (storageError) {
        console.error("failed to read unit id from session storage:", storageError);
      }

      if (!targetId && defaultUnitId !== undefined && defaultUnitId !== null) {
        const found = allUnits.find((unit: any) => unit.id === defaultUnitId);
        targetId = found ? defaultUnitId : null;
      }

      setUnitId(targetId ?? allUnits[0].id);
    }
  }, [allUnits, defaultUnitId, isEditMode, unitId]);

  useEffect(() => {
    if (!isEditMode || !lessonDetail) {
      return;
    }

    setUnitId(lessonDetail.unitId);
    setLessonTitle(lessonDetail.title);
    setLessonDescription(lessonDetail.description);
    setLearningObjective(lessonDetail.learningObjective ?? "");
    setEstimatedMinutes(lessonDetail.estimatedMinutes ? String(lessonDetail.estimatedMinutes) : "");
    setSteps(lessonDetail.steps.map(createDraftStepFromDetail));
    setError(null);
    setSuccess(null);
    resetStepEditor();
  }, [isEditMode, lessonDetail]);

  if (allUnits.length === 0) {
    return (
      <Card className="border-0 bg-muted/30 shadow-none">
        <CardContent className="p-6 text-sm text-muted-foreground">
          No units exist yet. An admin needs to create a unit before lessons can be authored.
        </CardContent>
      </Card>
    );
  }

  if (isEditMode && isLessonLoading) {
    return (
      <Card className="border-border/60 shadow-sm">
        <CardContent className="p-6 text-sm text-muted-foreground">
          Loading lesson draft...
        </CardContent>
      </Card>
    );
  }

  if (isEditMode && lessonLoadError) {
    return (
      <Card className="border-border/60 shadow-sm">
        <CardContent className="p-6 text-sm text-destructive">
          Couldn&apos;t load this lesson for editing.
        </CardContent>
      </Card>
    );
  }

  if (
    isEditMode &&
    (!lessonDetail || (currentStatus !== "DRAFT" && currentStatus !== "REJECTED"))
  ) {
    return (
      <Card className="border-border/60 shadow-sm">
        <CardContent className="p-6 text-sm text-muted-foreground">
          This lesson is no longer editable here.
        </CardContent>
      </Card>
    );
  }

  function resetStepEditor() {
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
  }

  function loadStepIntoEditor(step: DraftStep) {
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
  }

  function buildDraftStep(): DraftStep | null {
    if (activeStepType === "TEACH") {
      if (!teachTitle.trim() || !teachBody.trim()) {
        setError("Learn steps need a title and body.");
        return null;
      }

      const existingStep =
        editingStepId != null
          ? steps.find(
              (step): step is Extract<DraftStep, { stepType: "TEACH" }> =>
                step.id === editingStepId,
            )
          : null;

      return {
        id: editingStepId ?? createStepId(),
        remoteId: existingStep?.remoteId,
        stepType: "TEACH",
        vocabItemId: existingStep?.vocabItemId ?? null,
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

      const existingStep =
        editingStepId != null
          ? steps.find(
              (step): step is Extract<DraftStep, { stepType: "DIALOGUE" }> =>
                step.id === editingStepId,
            )
          : null;

      return {
        id: editingStepId ?? createStepId(),
        remoteId: existingStep?.remoteId,
        stepType: "DIALOGUE",
        dialogueText: dialogueText.trim(),
      };
    }

    if (activeStepType === "QUESTION") {
      if (!qPrompt.trim()) {
        setError("Question steps need a prompt.");
        return null;
      }

      const existingStep =
        editingStepId != null
          ? steps.find(
              (step): step is Extract<DraftStep, { stepType: "QUESTION" }> =>
                step.id === editingStepId,
            )
          : null;

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
          remoteId: existingStep?.remoteId,
          stepType: "QUESTION",
          questionType,
          prompt: qPrompt.trim(),
          acceptedAnswers: answers,
          choices: [],
          matchPairs: [],
        };
      }

      if (questionType === "MCQ") {
        const normalizedChoices = qChoices.map((choice) => ({
          ...choice,
          text: choice.text.trim(),
        }));
        const validChoices = normalizedChoices.filter((choice) => choice.text.length > 0);
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
          remoteId: existingStep?.remoteId,
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
        remoteId: existingStep?.remoteId,
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

    const existingStep =
      editingStepId != null
        ? steps.find(
            (step): step is Extract<DraftStep, { stepType: "RECAP" }> => step.id === editingStepId,
          )
        : null;

    return {
      id: editingStepId ?? createStepId(),
      remoteId: existingStep?.remoteId,
      stepType: "RECAP",
      headline: recapHeadline.trim(),
      summary: recapSummary.trim(),
      takeaways,
    };
  }

  function handleAddOrUpdateStep() {
    setError(null);
    const step = buildDraftStep();
    if (!step) {
      return;
    }

    setSteps((current) => {
      if (editingStepId) {
        return current.map((item) => (item.id === editingStepId ? step : item));
      }
      return [...current, step];
    });

    resetStepEditor();
  }

  function moveStep(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= steps.length) {
      return;
    }

    setSteps((current) => {
      const copy = current.slice();
      const [step] = copy.splice(index, 1);
      copy.splice(nextIndex, 0, step);
      return copy;
    });
  }

  function removeStep(stepId: string) {
    setSteps((current) => current.filter((step) => step.id !== stepId));
    if (editingStepId === stepId) {
      resetStepEditor();
    }
  }

  function resetCreateLessonForm() {
    setLessonTitle("");
    setLessonDescription("");
    setLearningObjective("");
    setEstimatedMinutes("");
    setSteps([]);
    resetStepEditor();
  }

  async function createTeachVocabItem(step: Extract<DraftStep, { stepType: "TEACH" }>) {
    const created = await api
      .post("vocab", {
        json: {
          term: step.title,
          definition: step.body,
          example: step.example || null,
        },
      })
      .json<{ id: number }>();

    return created.id;
  }

  async function createApiStepPayload(step: DraftStep, orderIndex: number) {
    if (step.stepType === "TEACH") {
      const vocabItemId = step.vocabItemId ?? (await createTeachVocabItem(step));
      return {
        orderIndex,
        stepType: "TEACH" as const,
        vocabItemId,
        payload: {
          title: step.title,
          body: step.body,
          example: step.example || null,
        },
      };
    }

    if (step.stepType === "DIALOGUE") {
      return {
        orderIndex,
        stepType: "DIALOGUE" as const,
        dialogueText: step.dialogueText,
      };
    }

    if (step.stepType === "QUESTION") {
      if (step.questionType === "SHORT_ANSWER") {
        return {
          orderIndex,
          stepType: "QUESTION" as const,
          questionType: step.questionType,
          prompt: step.prompt,
          acceptedAnswers: step.acceptedAnswers,
        };
      }

      if (step.questionType === "MCQ") {
        return {
          orderIndex,
          stepType: "QUESTION" as const,
          questionType: step.questionType,
          prompt: step.prompt,
          options: step.choices.map((choice) => choice.text),
          correctOptionIndex: step.choices.findIndex((choice) => !!choice.isCorrect),
        };
      }

      return {
        orderIndex,
        stepType: "QUESTION" as const,
        questionType: step.questionType,
        prompt: step.prompt,
        matchPairs: step.matchPairs.map((pair) => ({ left: pair.left, right: pair.right })),
      };
    }

    return {
      orderIndex,
      stepType: "RECAP" as const,
      payload: {
        headline: step.headline,
        summary: step.summary,
        takeaways: step.takeaways,
      },
    };
  }

  async function transitionLessonForSubmission(
    targetLessonId: number,
    statusBeforeSubmit: LessonDetail["status"] | "DRAFT",
    publishDirectly: boolean,
  ) {
    if (statusBeforeSubmit === "REJECTED") {
      await api.patch(`lessons/${targetLessonId}`, { json: { status: "DRAFT" } }).json();
    }

    await api
      .patch(`lessons/${targetLessonId}`, {
        json: { status: "PENDING_REVIEW" },
      })
      .json();

    if (publishDirectly) {
      await api.patch(`lessons/${targetLessonId}`, { json: { status: "APPROVED" } }).json();
    }
  }

  function buildPendingSummary(lessonIdValue: number, unitIdValue: number) {
    const firstStep = steps[0];
    return {
      id: lessonIdValue,
      unitId: unitIdValue,
      title: lessonTitle.trim(),
      slug: `lesson-${lessonIdValue}`,
      description: lessonDescription.trim(),
      learningObjective: learningObjective.trim() || null,
      estimatedMinutes: estimatedMinutes.trim() ? Number(estimatedMinutes) : null,
      orderIndex: 0,
      status: "PENDING_REVIEW" as const,
      firstStepType: firstStep?.stepType ?? null,
      firstQuestionType: firstStep?.stepType === "QUESTION" ? firstStep.questionType : null,
    };
  }

  async function syncExistingLesson(submitAfterSave: boolean) {
    if (!isEditMode || !lessonId || !lessonDetail) {
      throw new Error("Lesson is not ready to edit.");
    }

    await api
      .patch(`lessons/${lessonId}`, {
        json: {
          unitId,
          title: lessonTitle.trim(),
          description: lessonDescription.trim(),
          learningObjective: learningObjective.trim() || null,
          estimatedMinutes: estimatedMinutes.trim() ? Number(estimatedMinutes) : null,
        },
      })
      .json();

    const originalStepIds = new Set(lessonDetail.steps.map((step) => step.id));
    const currentRemoteStepIds = new Set<number>();

    for (const [index, step] of steps.entries()) {
      const payload = await createApiStepPayload(step, index + 1);

      if (step.remoteId) {
        currentRemoteStepIds.add(step.remoteId);
        await api.patch(`lessons/${lessonId}/steps/${step.remoteId}`, { json: payload }).json();
        continue;
      }

      const created = await api
        .post(`lessons/${lessonId}/steps`, { json: payload })
        .json<{ id: number }>();
      currentRemoteStepIds.add(created.id);
    }

    for (const stepId of originalStepIds) {
      if (!currentRemoteStepIds.has(stepId)) {
        await api.delete(`lessons/${lessonId}/steps/${stepId}`);
      }
    }

    const me = await getMe();
    if (submitAfterSave) {
      await transitionLessonForSubmission(
        lessonId,
        lessonDetail.status,
        me.role === "ADMIN" || me.role === "MODERATOR",
      );
    }

    void queryClient.invalidateQueries({ queryKey: ["units"] });
    void queryClient.invalidateQueries({ queryKey: ["lessons"] });
    void queryClient.invalidateQueries({ queryKey: ["lessons", "edit", lessonId] });
    void queryClient.invalidateQueries({ queryKey: ["lessons", "play", lessonId] });
  }

  async function createLesson(submitAfterSave: boolean) {
    if (!unitId) {
      throw new Error("Pick a unit before creating a lesson.");
    }

    let createdLessonId: number | null = null;

    try {
      const me = await getMe();
      const publishDirectly = me.role === "ADMIN" || me.role === "MODERATOR";

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
        .json<{ id: number; unitId?: number }>();

      createdLessonId = created.id;

      for (const [index, step] of steps.entries()) {
        const payload = await createApiStepPayload(step, index + 1);
        await api.post(`lessons/${createdLessonId}/steps`, { json: payload }).json();
      }

      if (submitAfterSave) {
        await transitionLessonForSubmission(createdLessonId, "DRAFT", publishDirectly);

        if (!publishDirectly) {
          const summary = buildPendingSummary(createdLessonId, created.unitId ?? unitId);
          queryClient.setQueryData(["lessons", "pending"], (old: any) => {
            if (!old) {
              return [summary];
            }
            return [summary, ...old];
          });
        }
      }

      void queryClient.invalidateQueries({ queryKey: ["units"] });
      void queryClient.invalidateQueries({ queryKey: ["lessons"] });
      resetCreateLessonForm();

      const publishedDirectly = submitAfterSave && publishDirectly;
      setSuccess(
        publishedDirectly
          ? "Lesson published and added to the curriculum."
          : submitAfterSave
            ? "Lesson submitted for review."
            : "Draft saved.",
      );
      onSaved?.(createdLessonId);
    } catch (error) {
      if (createdLessonId != null) {
        try {
          await api.delete(`lessons/${createdLessonId}`);
        } catch (cleanupError) {
          console.error("failed to clean up partially created lesson:", cleanupError);
        }
      }

      throw error;
    }
  }

  async function handleSave(submitAfterSave: boolean) {
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
      setError("Add at least one step before saving the lesson.");
      return;
    }

    setLoading(true);

    try {
      if (isEditMode) {
        await syncExistingLesson(submitAfterSave);
        setSuccess(
          submitAfterSave
            ? currentStatus === "REJECTED"
              ? "Lesson resubmitted for review."
              : "Lesson submitted for review."
            : currentStatus === "REJECTED"
              ? "Changes saved to this rejected lesson."
              : "Draft saved.",
        );
        onSaved?.(lessonId!);
      } else {
        await createLesson(submitAfterSave);
      }
    } catch (saveError: any) {
      console.error(saveError);
      setError(await extractLessonErrorMessage(saveError));
    } finally {
      setLoading(false);
    }
  }

  const editorHeading = isEditMode ? "Edit Lesson" : "Add Lesson";
  const saveButtonLabel =
    isEditMode && currentStatus === "REJECTED" ? "Save changes" : "Save draft";
  const submitButtonLabel =
    isEditMode && currentStatus === "REJECTED" ? "Resubmit for review" : "Submit lesson";

  return (
    <div className="space-y-6">
      {isEditMode && lessonDetail?.reviewComment ? (
        <div className="rounded-2xl border border-amber-300/70 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">Moderator feedback</p>
          <p className="mt-1">{lessonDetail.reviewComment}</p>
        </div>
      ) : null}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void handleSave(true);
        }}
        className="space-y-6"
      >
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">{editorHeading}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="lesson-unit">Unit</Label>
              <select
                id="lesson-unit"
                name="unitId"
                value={unitId ?? ""}
                onChange={(event) => setUnitId(Number(event.target.value))}
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
                onChange={(event) => setEstimatedMinutes(event.target.value)}
                placeholder="8"
                className={fieldClass}
              />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="lesson-title">Lesson title</Label>
              <Input
                id="lesson-title"
                value={lessonTitle}
                onChange={(event) => setLessonTitle(event.target.value)}
                placeholder="Why “mid” became a drag"
                className={fieldClass}
              />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="lesson-description">Lesson summary</Label>
              <textarea
                id="lesson-description"
                value={lessonDescription}
                onChange={(event) => setLessonDescription(event.target.value)}
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
                onChange={(event) => setLearningObjective(event.target.value)}
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
                <CardTitle className="text-lg">
                  {editingStepId ? "Edit Step" : "Add Step"}
                </CardTitle>
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
                      onChange={(event) => setTeachTitle(event.target.value)}
                      placeholder="What “ate” means online"
                      className={fieldClass}
                    />
                  </div>
                  <div>
                    <Label htmlFor="teach-body">Teaching copy</Label>
                    <textarea
                      id="teach-body"
                      value={teachBody}
                      onChange={(event) => setTeachBody(event.target.value)}
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
                      onChange={(event) => setTeachExample(event.target.value)}
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
                    onChange={(event) => setDialogueText(event.target.value)}
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
                      onChange={(event) => setQPrompt(event.target.value)}
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
                        onChange={(event) => setQAcceptedAnswers(event.target.value)}
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
                            onChange={(event) =>
                              setQChoices((current) =>
                                current.map((item) =>
                                  item.id === choice.id
                                    ? { ...item, text: event.target.value }
                                    : item,
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
                            onChange={(event) =>
                              setQMatchPairs((current) =>
                                current.map((item) =>
                                  item.id === pair.id
                                    ? { ...item, left: event.target.value }
                                    : item,
                                ),
                              )
                            }
                            placeholder={`Left ${index + 1}`}
                          />
                          <span className="text-center text-muted-foreground">→</span>
                          <Input
                            value={pair.right}
                            onChange={(event) =>
                              setQMatchPairs((current) =>
                                current.map((item) =>
                                  item.id === pair.id
                                    ? { ...item, right: event.target.value }
                                    : item,
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
                      onChange={(event) => setRecapHeadline(event.target.value)}
                      placeholder="What to remember"
                      className={fieldClass}
                    />
                  </div>
                  <div>
                    <Label htmlFor="recap-summary">Summary</Label>
                    <textarea
                      id="recap-summary"
                      value={recapSummary}
                      onChange={(event) => setRecapSummary(event.target.value)}
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
                      onChange={(event) => setRecapTakeaways(event.target.value)}
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

        <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card/60 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            {success ? <p className="text-sm text-success">{success}</p> : null}
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={() => {
                void handleSave(false);
              }}
            >
              <Save className="size-4" />
              {loading ? "Saving..." : saveButtonLabel}
            </Button>
            <Button type="submit" size="lg" disabled={loading}>
              {loading ? (
                isEditMode ? (
                  "Saving lesson..."
                ) : (
                  "Creating lesson..."
                )
              ) : (
                <>
                  <MessageSquareMore className="size-4" />
                  {submitButtonLabel}
                </>
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

async function extractLessonErrorMessage(error: any) {
  let message = "Failed to save lesson. Try again.";

  try {
    if (error?.response) {
      const response = error.response;
      let body: any = null;

      try {
        body = await response.json();
      } catch {
        body = await response.text().catch(() => null);
      }

      const bodyMessage =
        body && typeof body === "object"
          ? (body.message ?? body.detail ?? JSON.stringify(body))
          : body;
      message = `Failed to save lesson (${response.status}): ${bodyMessage ?? error?.message ?? "unknown"}`;
    } else if (error?.message) {
      message = error.message;
    }
  } catch (formatError) {
    console.error("failed to format lesson save error:", formatError);
  }

  return message;
}
