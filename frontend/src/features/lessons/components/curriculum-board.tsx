import { type ReactNode, type RefObject, useEffect, useMemo, useRef, useState } from "react";
import {
  type DragEndEvent,
  DndContext,
  PointerSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { BookOpenText, Layers3, ListOrdered, Plus, Save, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  type CreateLessonInput,
  type LessonDetail,
  type LessonStepPayload,
  type LessonSummary,
  type StepWriteInput,
  type UnitData,
  useCreateLesson,
  useCreateStep,
  useCreateUnit,
  useDeleteLesson,
  useDeleteStep,
  useDeleteUnit,
  useLessonForEdit,
  usePatchLesson,
  usePatchStep,
  useUpdateUnit,
} from "@/features/lessons/useLessonsApi";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

const sensorsConfig = {
  activationConstraint: {
    distance: 8,
  },
};

const fieldClass =
  "mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm transition-colors outline-none placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20";

type DraftStepType = "TEACH" | "QUESTION" | "DIALOGUE" | "RECAP";
type DraftQuestionType = "SHORT_ANSWER" | "MCQ" | "MATCH";
type EditorMode = "edit" | "create";

type LessonFormState = {
  title: string;
  description: string;
  learningObjective: string;
  estimatedMinutes: string;
};

type StepEditorState = {
  stepType: DraftStepType;
  teachTitle: string;
  teachBody: string;
  teachExample: string;
  dialogueText: string;
  questionType: DraftQuestionType;
  questionPrompt: string;
  questionAcceptedAnswers: string;
  questionChoices: Array<{ id: number; text: string; isCorrect: boolean }>;
  questionMatchPairs: Array<{ id: number; left: string; right: string }>;
  recapHeadline: string;
  recapSummary: string;
  recapTakeaways: string;
};

function createChoice() {
  return { id: Date.now() + Math.random(), text: "", isCorrect: false };
}

function createPair() {
  return { id: Date.now() + Math.random(), left: "", right: "" };
}

function sortUnitsForBoard(units: UnitData[]) {
  return [...units]
    .map((unit) => ({
      ...unit,
      lessons: [...(Array.isArray(unit.lessons) ? unit.lessons : [])].sort(
        (left, right) => left.orderIndex - right.orderIndex,
      ),
    }))
    .sort((left, right) => left.orderIndex - right.orderIndex);
}

function getApprovedLessons(unit: UnitData | null) {
  if (!unit) {
    return [];
  }

  return [...unit.lessons]
    .filter((lesson) => lesson.status === "APPROVED")
    .sort((left, right) => left.orderIndex - right.orderIndex);
}

function getLessonSummaryFallback(detail: LessonDetail, existing?: LessonSummary): LessonSummary {
  return {
    id: detail.id,
    unitId: detail.unitId,
    title: detail.title,
    slug: existing?.slug ?? `lesson-${detail.id}`,
    description: detail.description,
    learningObjective: detail.learningObjective,
    estimatedMinutes: detail.estimatedMinutes,
    orderIndex: detail.orderIndex,
    status: detail.status,
    publishedAt: detail.publishedAt ?? null,
  };
}

function reorderByIds<T extends { id: number }>(items: T[], activeId: number, overId: number) {
  const activeIndex = items.findIndex((item) => item.id === activeId);
  const overIndex = items.findIndex((item) => item.id === overId);

  if (activeIndex < 0 || overIndex < 0 || activeIndex === overIndex) {
    return items;
  }

  const next = items.slice();
  const [moved] = next.splice(activeIndex, 1);
  next.splice(overIndex, 0, moved);
  return next;
}

function normalizeApprovedLessonCollection(
  allLessons: LessonSummary[],
  orderedApprovedIds: number[],
) {
  const lessonById = new Map(allLessons.map((lesson) => [lesson.id, lesson]));
  const orderedApproved = orderedApprovedIds
    .map((id) => lessonById.get(id))
    .filter((lesson): lesson is LessonSummary => Boolean(lesson));
  const hidden = allLessons
    .filter((lesson) => lesson.status !== "APPROVED")
    .sort((left, right) => left.orderIndex - right.orderIndex);

  let orderIndex = 1;
  const normalizedApproved = orderedApproved.map((lesson) => ({
    ...lesson,
    orderIndex: orderIndex++,
  }));
  const normalizedHidden = hidden.map((lesson) => ({
    ...lesson,
    orderIndex: orderIndex++,
  }));

  return [...normalizedApproved, ...normalizedHidden];
}

function summarizeStep(step: LessonStepPayload) {
  if (step.stepType === "TEACH") {
    const title = readStringField(step.payload, "title") || step.vocab?.term || "Learn step";
    const detail =
      readStringField(step.payload, "body") || step.vocab?.definition || "No teaching copy yet.";
    return { title, detail };
  }

  if (step.stepType === "DIALOGUE") {
    return {
      title: "Dialogue",
      detail: (step.dialogueText ?? "").split("\n")[0] || "No dialogue yet.",
    };
  }

  if (step.stepType === "QUESTION") {
    const questionType = step.question?.questionType;
    return {
      title:
        questionType === "MCQ"
          ? "Multiple choice"
          : questionType === "MATCH"
            ? "Matching"
            : "Short answer",
      detail: step.question?.prompt || "No prompt yet.",
    };
  }

  return {
    title: readStringField(step.payload, "headline") || "Recap",
    detail: readStringField(step.payload, "summary") || "No summary yet.",
  };
}

function readStringField(payload: LessonStepPayload["payload"], key: string) {
  const value = payload?.[key];
  return typeof value === "string" && value.trim().length > 0 ? value : "";
}

function readStringArrayField(payload: LessonStepPayload["payload"], key: string) {
  const value = payload?.[key];
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function createEmptyLessonForm(): LessonFormState {
  return {
    title: "",
    description: "",
    learningObjective: "",
    estimatedMinutes: "",
  };
}

function createLessonFormFromSummary(lesson: LessonSummary): LessonFormState {
  return {
    title: lesson.title,
    description: lesson.description,
    learningObjective: lesson.learningObjective ?? "",
    estimatedMinutes: lesson.estimatedMinutes === null ? "" : String(lesson.estimatedMinutes),
  };
}

function createEmptyStepState(): StepEditorState {
  return {
    stepType: "TEACH",
    teachTitle: "",
    teachBody: "",
    teachExample: "",
    dialogueText: "",
    questionType: "SHORT_ANSWER",
    questionPrompt: "",
    questionAcceptedAnswers: "",
    questionChoices: [createChoice(), createChoice()],
    questionMatchPairs: [createPair(), createPair()],
    recapHeadline: "Quick recap",
    recapSummary: "",
    recapTakeaways: "",
  };
}

function createStateFromStep(step: LessonStepPayload): StepEditorState {
  return {
    stepType: step.stepType,
    teachTitle: readStringField(step.payload, "title") || step.vocab?.term || "",
    teachBody: readStringField(step.payload, "body") || step.vocab?.definition || "",
    teachExample: readStringField(step.payload, "example") || step.vocab?.exampleSentence || "",
    dialogueText: step.dialogueText ?? "",
    questionType: (step.question?.questionType as DraftQuestionType | undefined) ?? "SHORT_ANSWER",
    questionPrompt: step.question?.prompt ?? "",
    questionAcceptedAnswers: (step.question?.acceptedAnswers ?? []).join(", "),
    questionChoices: step.question?.choices?.map((choice) => ({
      id: choice.id ?? Date.now() + Math.random(),
      text: choice.text,
      isCorrect: Boolean(choice.isCorrect),
    })) ?? [createChoice(), createChoice()],
    questionMatchPairs: step.question?.matchPairs?.map((pair) => ({
      id: pair.id ?? Date.now() + Math.random(),
      left: pair.left,
      right: pair.right ?? "",
    })) ?? [createPair(), createPair()],
    recapHeadline: readStringField(step.payload, "headline") || "Quick recap",
    recapSummary: readStringField(step.payload, "summary"),
    recapTakeaways: readStringArrayField(step.payload, "takeaways").join("\n"),
  };
}

async function buildStepWriteInput(
  state: StepEditorState,
  initialStep?: LessonStepPayload,
  explicitOrderIndex?: number,
): Promise<StepWriteInput> {
  const orderIndex = explicitOrderIndex ?? initialStep?.orderIndex ?? 1;

  if (state.stepType === "TEACH") {
    if (!state.teachTitle.trim() || !state.teachBody.trim()) {
      throw new Error("Learn steps need a title and body.");
    }

    let vocabItemId = initialStep?.stepType === "TEACH" ? (initialStep.vocab?.id ?? null) : null;
    if (!vocabItemId) {
      const created = await api
        .post("vocab", {
          json: {
            term: state.teachTitle.trim(),
            definition: state.teachBody.trim(),
            example: state.teachExample.trim() || null,
            partOfSpeech:
              initialStep?.stepType === "TEACH" ? (initialStep.vocab?.partOfSpeech ?? null) : null,
          },
        })
        .json<{ id: number }>();
      vocabItemId = created.id;
    }

    return {
      orderIndex,
      stepType: "TEACH",
      vocabItemId,
      payload: {
        title: state.teachTitle.trim(),
        body: state.teachBody.trim(),
        example: state.teachExample.trim() || null,
        partOfSpeech:
          initialStep?.stepType === "TEACH" ? (initialStep.vocab?.partOfSpeech ?? null) : null,
      },
    };
  }

  if (state.stepType === "DIALOGUE") {
    if (!state.dialogueText.trim()) {
      throw new Error("Dialogue steps need dialogue text.");
    }

    return {
      orderIndex,
      stepType: "DIALOGUE",
      dialogueText: state.dialogueText.trim(),
    };
  }

  if (state.stepType === "QUESTION") {
    if (!state.questionPrompt.trim()) {
      throw new Error("Question steps need a prompt.");
    }

    if (state.questionType === "SHORT_ANSWER") {
      const acceptedAnswers = state.questionAcceptedAnswers
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);

      if (acceptedAnswers.length === 0) {
        throw new Error("Short answer questions need at least one accepted answer.");
      }

      return {
        orderIndex,
        stepType: "QUESTION",
        questionType: "SHORT_ANSWER",
        prompt: state.questionPrompt.trim(),
        acceptedAnswers,
      };
    }

    if (state.questionType === "MCQ") {
      const choices = state.questionChoices
        .map((choice) => ({ ...choice, text: choice.text.trim() }))
        .filter((choice) => choice.text.length > 0);
      const correctOptionIndex = choices.findIndex((choice) => choice.isCorrect);

      if (choices.length < 2) {
        throw new Error("Multiple choice questions need at least two choices.");
      }

      if (correctOptionIndex < 0 || choices.filter((choice) => choice.isCorrect).length !== 1) {
        throw new Error("Multiple choice questions need exactly one correct answer.");
      }

      return {
        orderIndex,
        stepType: "QUESTION",
        questionType: "MCQ",
        prompt: state.questionPrompt.trim(),
        options: choices.map((choice) => choice.text),
        correctOptionIndex,
      };
    }

    const matchPairs = state.questionMatchPairs
      .map((pair) => ({ left: pair.left.trim(), right: pair.right.trim() }))
      .filter((pair) => pair.left.length > 0 && pair.right.length > 0);

    if (matchPairs.length < 2) {
      throw new Error("Matching questions need at least two pairs.");
    }

    return {
      orderIndex,
      stepType: "QUESTION",
      questionType: "MATCH",
      prompt: state.questionPrompt.trim(),
      matchPairs,
    };
  }

  if (!state.recapHeadline.trim() || !state.recapSummary.trim()) {
    throw new Error("Recap steps need a headline and summary.");
  }

  return {
    orderIndex,
    stepType: "RECAP",
    payload: {
      headline: state.recapHeadline.trim(),
      summary: state.recapSummary.trim(),
      takeaways: state.recapTakeaways
        .split("\n")
        .map((value) => value.trim())
        .filter(Boolean),
    },
  };
}

async function buildStepWriteInputFromExistingStep(step: LessonStepPayload, orderIndex: number) {
  if (step.stepType === "TEACH") {
    return {
      orderIndex,
      stepType: "TEACH" as const,
      vocabItemId: step.vocab?.id ?? null,
      payload: {
        title: readStringField(step.payload, "title") || step.vocab?.term || "",
        body: readStringField(step.payload, "body") || step.vocab?.definition || "",
        example: readStringField(step.payload, "example") || step.vocab?.exampleSentence || null,
        partOfSpeech: step.vocab?.partOfSpeech ?? null,
      },
    };
  }

  if (step.stepType === "DIALOGUE") {
    return {
      orderIndex,
      stepType: "DIALOGUE" as const,
      dialogueText: step.dialogueText ?? "",
    };
  }

  if (step.stepType === "QUESTION") {
    if (step.question?.questionType === "MCQ") {
      return {
        orderIndex,
        stepType: "QUESTION" as const,
        questionType: "MCQ" as const,
        prompt: step.question.prompt,
        explanation: step.question.explanation,
        options: step.question.choices.map((choice) => choice.text),
        correctOptionIndex: step.question.choices.findIndex((choice) => Boolean(choice.isCorrect)),
      };
    }

    if (step.question?.questionType === "MATCH") {
      return {
        orderIndex,
        stepType: "QUESTION" as const,
        questionType: "MATCH" as const,
        prompt: step.question.prompt,
        explanation: step.question.explanation,
        matchPairs: step.question.matchPairs.map((pair) => ({
          left: pair.left,
          right: pair.right ?? "",
        })),
      };
    }

    return {
      orderIndex,
      stepType: "QUESTION" as const,
      questionType: "SHORT_ANSWER" as const,
      prompt: step.question?.prompt ?? "",
      explanation: step.question?.explanation,
      acceptedAnswers: step.question?.acceptedAnswers ?? [],
    };
  }

  return {
    orderIndex,
    stepType: "RECAP" as const,
    payload: {
      headline: readStringField(step.payload, "headline") || "Quick recap",
      summary: readStringField(step.payload, "summary"),
      takeaways: readStringArrayField(step.payload, "takeaways"),
    },
  };
}

function mergeNodeRefs<T>(...refs: Array<(node: T | null) => void>) {
  return (node: T | null) => {
    refs.forEach((ref) => ref(node));
  };
}

function BoardColumn({
  title,
  description,
  icon,
  action,
  children,
  footer,
  footerRef,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  footerRef?: RefObject<HTMLDivElement | null>;
}) {
  return (
    <section className="flex min-h-[24rem] flex-col overflow-hidden rounded-2xl border border-border/70 bg-card/70 lg:min-h-0">
      <div className="flex items-start justify-between gap-4 border-b border-border/70 px-4 py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">{icon}</span>
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-foreground">
              {title}
            </h2>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        </div>
        {action}
      </div>
      <div className="flex-1 overflow-hidden">{children}</div>
      {footer ? (
        <div ref={footerRef} className="border-t border-border/70 p-4">
          {footer}
        </div>
      ) : null}
    </section>
  );
}

function ReorderableListItem({
  id,
  selected,
  onSelect,
  children,
}: {
  id: string;
  selected: boolean;
  onSelect: () => void;
  children: ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef: setDragNodeRef,
    transform,
    isDragging,
  } = useDraggable({ id });
  const { isOver, setNodeRef: setDropNodeRef } = useDroppable({ id });

  return (
    <button
      type="button"
      ref={mergeNodeRefs<HTMLButtonElement>(setDragNodeRef, setDropNodeRef)}
      onClick={onSelect}
      className={cn(
        "w-full rounded-none border-b border-border/70 px-4 py-3 text-left transition-colors",
        selected ? "bg-primary/8" : "bg-transparent hover:bg-accent/50",
        isOver && "bg-accent/60",
        isDragging && "opacity-70 shadow-sm",
      )}
      style={{
        transform: transform ? CSS.Translate.toString(transform) : undefined,
      }}
      {...attributes}
      {...listeners}
    >
      <div className="flex items-start gap-3">
        <span className="pt-1 text-xs text-muted-foreground">::</span>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </button>
  );
}

function statusBadgeTone(status: LessonSummary["status"]) {
  if (status === "APPROVED") {
    return "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400";
  }
  if (status === "PENDING_REVIEW") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400";
  }
  if (status === "REJECTED") {
    return "border-destructive/30 bg-destructive/10 text-destructive";
  }
  return "border-border/70 bg-secondary text-secondary-foreground";
}

export function CurriculumBoard({ units }: { units: UnitData[] }) {
  const queryClient = useQueryClient();
  const createUnit = useCreateUnit();
  const updateUnit = useUpdateUnit();
  const deleteUnit = useDeleteUnit();
  const createLesson = useCreateLesson();
  const patchLesson = usePatchLesson();
  const deleteLesson = useDeleteLesson();
  const createStep = useCreateStep();
  const patchStep = usePatchStep();
  const deleteStep = useDeleteStep();
  const sensors = useSensors(useSensor(PointerSensor, sensorsConfig));

  const [boardUnits, setBoardUnits] = useState<UnitData[]>(() => sortUnitsForBoard(units));
  const [selectedUnitId, setSelectedUnitId] = useState<number | null>(null);
  const [selectedLessonId, setSelectedLessonId] = useState<number | null>(null);
  const [selectedStepId, setSelectedStepId] = useState<number | null>(null);

  const [unitMode, setUnitMode] = useState<EditorMode>("edit");
  const [lessonMode, setLessonMode] = useState<EditorMode>("edit");
  const [stepMode, setStepMode] = useState<EditorMode>("edit");

  const [unitTitle, setUnitTitle] = useState("");
  const [unitDescription, setUnitDescription] = useState("");
  const [lessonForm, setLessonForm] = useState<LessonFormState>(createEmptyLessonForm());
  const [stepForm, setStepForm] = useState<StepEditorState>(createEmptyStepState());

  const [unitFeedback, setUnitFeedback] = useState<string | null>(null);
  const [lessonFeedback, setLessonFeedback] = useState<string | null>(null);
  const [stepFeedback, setStepFeedback] = useState<string | null>(null);

  const [stepItems, setStepItems] = useState<LessonStepPayload[]>([]);
  const unitFooterRef = useRef<HTMLDivElement | null>(null);
  const lessonFooterRef = useRef<HTMLDivElement | null>(null);
  const stepFooterRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setBoardUnits(sortUnitsForBoard(units));
  }, [units]);

  const sortedUnits = useMemo(() => sortUnitsForBoard(boardUnits), [boardUnits]);
  const selectedUnit = sortedUnits.find((unit) => unit.id === selectedUnitId) ?? null;
  const approvedLessons = useMemo(() => getApprovedLessons(selectedUnit), [selectedUnit]);
  const selectedLesson = approvedLessons.find((lesson) => lesson.id === selectedLessonId) ?? null;

  const lessonDetailQuery = useLessonForEdit(selectedLesson?.id ?? 0);
  const selectedLessonDetail =
    selectedLesson && lessonDetailQuery.data?.id === selectedLesson.id
      ? lessonDetailQuery.data
      : null;

  const selectedStep = stepItems.find((step) => step.id === selectedStepId) ?? null;

  useEffect(() => {
    if (sortedUnits.length === 0) {
      setSelectedUnitId(null);
      return;
    }
    if (selectedUnitId && !sortedUnits.some((unit) => unit.id === selectedUnitId)) {
      setSelectedUnitId(null);
    }
  }, [sortedUnits, selectedUnitId]);

  useEffect(() => {
    if (!selectedUnit) {
      setSelectedLessonId(null);
      return;
    }
    if (selectedLessonId && !approvedLessons.some((lesson) => lesson.id === selectedLessonId)) {
      setSelectedLessonId(null);
    }
  }, [selectedUnit, approvedLessons, selectedLessonId]);

  useEffect(() => {
    const nextSteps =
      selectedLessonDetail?.steps
        ?.slice()
        .sort((left, right) => left.orderIndex - right.orderIndex) ?? [];
    setStepItems(nextSteps);
  }, [selectedLessonDetail]);

  useEffect(() => {
    if (stepItems.length === 0) {
      setSelectedStepId(null);
      return;
    }
    if (selectedStepId && !stepItems.some((step) => step.id === selectedStepId)) {
      setSelectedStepId(null);
    }
  }, [stepItems, selectedStepId]);

  useEffect(() => {
    const shouldScroll = unitMode === "create" || Boolean(selectedUnitId);
    if (!shouldScroll || typeof window === "undefined" || window.innerWidth >= 1024) {
      return;
    }
    const node = unitFooterRef.current;
    if (!node) {
      return;
    }
    window.requestAnimationFrame(() => {
      node.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [selectedUnitId, unitMode]);

  useEffect(() => {
    const shouldScroll = lessonMode === "create" || Boolean(selectedLessonId);
    if (!shouldScroll || typeof window === "undefined" || window.innerWidth >= 1024) {
      return;
    }
    const node = lessonFooterRef.current;
    if (!node) {
      return;
    }
    window.requestAnimationFrame(() => {
      node.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [selectedLessonId, lessonMode]);

  useEffect(() => {
    const shouldScroll = stepMode === "create" || Boolean(selectedStepId);
    if (!shouldScroll || typeof window === "undefined" || window.innerWidth >= 1024) {
      return;
    }
    const node = stepFooterRef.current;
    if (!node) {
      return;
    }
    window.requestAnimationFrame(() => {
      node.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [selectedStepId, stepMode]);

  useEffect(() => {
    if (unitMode !== "edit" || !selectedUnit) {
      return;
    }
    setUnitTitle(selectedUnit.title);
    setUnitDescription(selectedUnit.description ?? "");
  }, [selectedUnit, unitMode]);

  useEffect(() => {
    if (lessonMode !== "edit" || !selectedLesson) {
      return;
    }
    setLessonForm(createLessonFormFromSummary(selectedLesson));
  }, [selectedLesson, lessonMode]);

  useEffect(() => {
    if (stepMode !== "edit" || !selectedStep) {
      return;
    }
    setStepForm(createStateFromStep(selectedStep));
  }, [selectedStep, stepMode]);

  const persistUnitOrder = async (nextUnits: UnitData[]) => {
    const previousUnits = boardUnits;
    setBoardUnits(nextUnits);
    try {
      for (const [index, unit] of nextUnits.entries()) {
        await api.patch(`units/${unit.id}`, { json: { orderIndex: index + 1 } }).json<UnitData>();
      }
      void queryClient.invalidateQueries({ queryKey: ["units"] });
    } catch (error) {
      setBoardUnits(previousUnits);
      setUnitFeedback(error instanceof Error ? error.message : "Could not reorder units.");
    }
  };

  const persistLessonOrder = async (unitId: number, nextLessons: LessonSummary[]) => {
    const previousUnits = boardUnits;
    setBoardUnits((current) =>
      current.map((unit) => (unit.id === unitId ? { ...unit, lessons: nextLessons } : unit)),
    );
    try {
      for (const lesson of nextLessons) {
        await api.patch(`lessons/${lesson.id}`, { json: { orderIndex: lesson.orderIndex } }).json();
      }
      void queryClient.invalidateQueries({ queryKey: ["units"] });
      void queryClient.invalidateQueries({ queryKey: ["lessons"] });
      if (selectedLessonId) {
        void queryClient.invalidateQueries({ queryKey: ["lessons", "edit", selectedLessonId] });
        void queryClient.invalidateQueries({ queryKey: ["lessons", "play", selectedLessonId] });
      }
    } catch (error) {
      setBoardUnits(previousUnits);
      setLessonFeedback(error instanceof Error ? error.message : "Could not reorder lessons.");
    }
  };

  const persistStepOrder = async (nextSteps: LessonStepPayload[]) => {
    if (!selectedLesson) {
      return;
    }
    const previousSteps = stepItems;
    setStepItems(nextSteps);
    try {
      for (const [index, step] of nextSteps.entries()) {
        const body = await buildStepWriteInputFromExistingStep(step, index + 1);
        await api.patch(`lessons/${selectedLesson.id}/steps/${step.id}`, { json: body }).json();
      }
      void queryClient.invalidateQueries({ queryKey: ["lessons", "edit", selectedLesson.id] });
      void queryClient.invalidateQueries({ queryKey: ["lessons", "play", selectedLesson.id] });
      void queryClient.invalidateQueries({ queryKey: ["lessons"] });
      void queryClient.invalidateQueries({ queryKey: ["units"] });
    } catch (error) {
      setStepItems(previousSteps);
      setStepFeedback(error instanceof Error ? error.message : "Could not reorder lesson steps.");
    }
  };

  const handleUnitDragEnd = (event: DragEndEvent) => {
    if (!event.over?.id || event.active.id === event.over.id) {
      return;
    }

    const activeId = Number.parseInt(String(event.active.id).replace("unit:", ""), 10);
    const overId = Number.parseInt(String(event.over.id).replace("unit:", ""), 10);
    const reordered = reorderByIds(sortedUnits, activeId, overId).map((unit, index) => ({
      ...unit,
      orderIndex: index + 1,
    }));
    void persistUnitOrder(reordered);
  };

  const handleLessonDragEnd = (event: DragEndEvent) => {
    if (!selectedUnit || !event.over?.id || event.active.id === event.over.id) {
      return;
    }

    const activeId = Number.parseInt(String(event.active.id).replace("lesson:", ""), 10);
    const overId = Number.parseInt(String(event.over.id).replace("lesson:", ""), 10);
    const reorderedApproved = reorderByIds(approvedLessons, activeId, overId);
    const nextLessons = normalizeApprovedLessonCollection(
      selectedUnit.lessons,
      reorderedApproved.map((lesson) => lesson.id),
    );
    void persistLessonOrder(selectedUnit.id, nextLessons);
  };

  const handleStepDragEnd = (event: DragEndEvent) => {
    if (!event.over?.id || event.active.id === event.over.id) {
      return;
    }

    const activeId = Number.parseInt(String(event.active.id).replace("step:", ""), 10);
    const overId = Number.parseInt(String(event.over.id).replace("step:", ""), 10);
    const nextSteps = reorderByIds(stepItems, activeId, overId).map((step, index) => ({
      ...step,
      orderIndex: index + 1,
    }));
    void persistStepOrder(nextSteps);
  };

  const handleCreateUnit = async () => {
    setUnitFeedback(null);
    if (!unitTitle.trim()) {
      setUnitFeedback("Unit title is required.");
      return;
    }

    try {
      const created = await createUnit.mutateAsync({
        title: unitTitle.trim(),
        description: unitDescription.trim() || null,
      });
      setBoardUnits((current) => sortUnitsForBoard([...current, { ...created, lessons: [] }]));
      setSelectedUnitId(created.id);
      setUnitMode("edit");
      setUnitFeedback("Unit created.");
    } catch (error) {
      setUnitFeedback(error instanceof Error ? error.message : "Could not create unit.");
    }
  };

  const handleSaveUnit = async () => {
    if (!selectedUnit) {
      return;
    }

    setUnitFeedback(null);
    if (!unitTitle.trim()) {
      setUnitFeedback("Unit title is required.");
      return;
    }

    try {
      const updated = await updateUnit.mutateAsync({
        unitId: selectedUnit.id,
        body: {
          title: unitTitle.trim(),
          description: unitDescription.trim() || null,
        },
      });
      setBoardUnits((current) =>
        sortUnitsForBoard(
          current.map((unit) =>
            unit.id === selectedUnit.id
              ? {
                  ...unit,
                  title: updated.title,
                  slug: updated.slug,
                  description: updated.description,
                }
              : unit,
          ),
        ),
      );
      setUnitFeedback("Unit updated.");
    } catch (error) {
      setUnitFeedback(error instanceof Error ? error.message : "Could not update unit.");
    }
  };

  const handleDeleteUnit = async () => {
    if (!selectedUnit) {
      return;
    }
    if (!window.confirm(`Delete "${selectedUnit.title}"?`)) {
      return;
    }

    setUnitFeedback(null);
    try {
      await deleteUnit.mutateAsync(selectedUnit.id);
      const remaining = sortedUnits.filter((unit) => unit.id !== selectedUnit.id);
      setBoardUnits(remaining);
      setSelectedUnitId(null);
      setSelectedLessonId(null);
      setSelectedStepId(null);
      setUnitFeedback("Unit deleted.");
    } catch (error) {
      setUnitFeedback(error instanceof Error ? error.message : "Could not delete unit.");
    }
  };

  const handleCreateLesson = async () => {
    if (!selectedUnit) {
      setLessonFeedback("Choose a unit first.");
      return;
    }

    setLessonFeedback(null);
    if (!lessonForm.title.trim() || !lessonForm.description.trim()) {
      setLessonFeedback("Lesson title and description are required.");
      return;
    }

    const createBody: CreateLessonInput = {
      unitId: selectedUnit.id,
      title: lessonForm.title.trim(),
      description: lessonForm.description.trim(),
      learningObjective: lessonForm.learningObjective.trim() || null,
      estimatedMinutes: lessonForm.estimatedMinutes.trim()
        ? Number.parseInt(lessonForm.estimatedMinutes, 10)
        : null,
      orderIndex: approvedLessons.length + 1,
    };

    try {
      const created = await createLesson.mutateAsync(createBody);
      await patchLesson.mutateAsync({
        lessonId: created.id,
        body: { status: "PENDING_REVIEW" },
      });
      const approved = await patchLesson.mutateAsync({
        lessonId: created.id,
        body: { status: "APPROVED" },
      });

      const newLessonSummary = getLessonSummaryFallback(approved);
      const currentUnit = boardUnits.find((unit) => unit.id === selectedUnit.id) ?? selectedUnit;
      const nextLessons = normalizeApprovedLessonCollection(currentUnit.lessons, [
        ...getApprovedLessons(currentUnit).map((lesson) => lesson.id),
        newLessonSummary.id,
      ]).map((lesson) =>
        lesson.id === newLessonSummary.id
          ? { ...newLessonSummary, orderIndex: lesson.orderIndex }
          : lesson,
      );

      await persistLessonOrder(selectedUnit.id, nextLessons);
      setSelectedLessonId(newLessonSummary.id);
      setLessonMode("edit");
      setLessonForm(createLessonFormFromSummary({ ...newLessonSummary, status: "APPROVED" }));
      setLessonFeedback("Lesson created and published.");
    } catch (error) {
      setLessonFeedback(error instanceof Error ? error.message : "Could not create lesson.");
    }
  };

  const handleSaveLesson = async () => {
    if (!selectedLesson) {
      return;
    }

    setLessonFeedback(null);
    if (!lessonForm.title.trim() || !lessonForm.description.trim()) {
      setLessonFeedback("Lesson title and description are required.");
      return;
    }

    const estimatedMinutes = lessonForm.estimatedMinutes.trim()
      ? Number.parseInt(lessonForm.estimatedMinutes, 10)
      : null;

    try {
      const updated = await patchLesson.mutateAsync({
        lessonId: selectedLesson.id,
        body: {
          title: lessonForm.title.trim(),
          description: lessonForm.description.trim(),
          learningObjective: lessonForm.learningObjective.trim() || null,
          estimatedMinutes,
        },
      });
      setBoardUnits((current) =>
        current.map((unit) =>
          unit.id !== selectedUnit?.id
            ? unit
            : {
                ...unit,
                lessons: unit.lessons.map((lesson) =>
                  lesson.id === selectedLesson.id
                    ? { ...lesson, ...getLessonSummaryFallback(updated, lesson) }
                    : lesson,
                ),
              },
        ),
      );
      setLessonFeedback("Lesson updated.");
    } catch (error) {
      setLessonFeedback(error instanceof Error ? error.message : "Could not update lesson.");
    }
  };

  const handleDeleteLesson = async () => {
    if (!selectedLesson || !selectedUnit) {
      return;
    }
    if (!window.confirm(`Delete "${selectedLesson.title}"? This cannot be undone.`)) {
      return;
    }

    setLessonFeedback(null);
    try {
      await deleteLesson.mutateAsync(selectedLesson.id);
      const nextUnits = boardUnits.map((unit) =>
        unit.id === selectedUnit.id
          ? { ...unit, lessons: unit.lessons.filter((lesson) => lesson.id !== selectedLesson.id) }
          : unit,
      );
      setBoardUnits(nextUnits);
      setSelectedLessonId(null);
      setSelectedStepId(null);
      setLessonFeedback("Lesson deleted.");
    } catch (error) {
      setLessonFeedback(error instanceof Error ? error.message : "Could not delete lesson.");
    }
  };

  const handleCreateStep = async () => {
    if (!selectedLesson) {
      setStepFeedback("Choose a lesson first.");
      return;
    }

    setStepFeedback(null);
    try {
      const body = await buildStepWriteInput(stepForm, undefined, stepItems.length + 1);
      const created = await createStep.mutateAsync({ lessonId: selectedLesson.id, body });
      const nextSteps = [...stepItems, created].sort(
        (left, right) => left.orderIndex - right.orderIndex,
      );
      setStepItems(nextSteps);
      setSelectedStepId(created.id);
      setStepMode("edit");
      setStepFeedback("Step added.");
    } catch (error) {
      setStepFeedback(error instanceof Error ? error.message : "Could not add step.");
    }
  };

  const handleSaveStep = async () => {
    if (!selectedLesson || !selectedStep) {
      return;
    }

    setStepFeedback(null);
    try {
      const body = await buildStepWriteInput(stepForm, selectedStep, selectedStep.orderIndex);
      const updated = await patchStep.mutateAsync({
        lessonId: selectedLesson.id,
        stepId: selectedStep.id,
        body,
      });
      const nextSteps = stepItems.map((step) => (step.id === updated.id ? updated : step));
      setStepItems(nextSteps);
      setStepFeedback("Step updated.");
    } catch (error) {
      setStepFeedback(error instanceof Error ? error.message : "Could not update step.");
    }
  };

  const handleDeleteStep = async () => {
    if (!selectedLesson || !selectedStep || !selectedUnit) {
      return;
    }
    if (!window.confirm("Delete this step? This cannot be undone.")) {
      return;
    }

    setStepFeedback(null);
    try {
      await deleteStep.mutateAsync({ lessonId: selectedLesson.id, stepId: selectedStep.id });

      if (stepItems.length === 1) {
        const nextUnits = boardUnits.map((unit) =>
          unit.id === selectedUnit.id
            ? { ...unit, lessons: unit.lessons.filter((lesson) => lesson.id !== selectedLesson.id) }
            : unit,
        );
        setBoardUnits(nextUnits);
        setSelectedLessonId(null);
        setSelectedStepId(null);
        setStepMode("create");
        setStepForm(createEmptyStepState());
        setStepFeedback("Step deleted. The empty lesson was removed as well.");
        return;
      }

      const nextSteps = stepItems.filter((step) => step.id !== selectedStep.id);
      setStepItems(nextSteps);
      setSelectedStepId(null);
      setStepFeedback("Step deleted.");
    } catch (error) {
      setStepFeedback(error instanceof Error ? error.message : "Could not delete step.");
    }
  };

  const createNewUnit = () => {
    setUnitMode("create");
    setUnitFeedback(null);
    setUnitTitle("");
    setUnitDescription("");
  };

  const createNewLesson = () => {
    setLessonMode("create");
    setLessonFeedback(null);
    setLessonForm(createEmptyLessonForm());
  };

  const createNewStep = () => {
    setStepMode("create");
    setStepFeedback(null);
    setStepForm(createEmptyStepState());
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            curriculum board
          </p>
          <h1 className="mt-1 text-2xl font-bold">Manage approved learning content</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Reorder units, approved lessons, and lesson steps directly from one board.
          </p>
        </div>
        <Badge variant="outline" className="w-fit bg-background/80 px-3 py-1">
          drag to reorder
        </Badge>
      </div>

      <div className="grid gap-4 lg:h-[calc(100dvh-12.5rem)] lg:grid-cols-[18rem_22rem_minmax(0,1fr)]">
        <BoardColumn
          title="Units"
          description="Create or reorder curriculum containers."
          icon={<Layers3 className="size-4" />}
          footerRef={unitFooterRef}
          action={
            <Button type="button" size="sm" onClick={createNewUnit}>
              <Plus className="size-4" />
              Unit
            </Button>
          }
          footer={
            unitMode === "create" || selectedUnit ? (
              <div className="space-y-3">
                <div>
                  <Label htmlFor="board-unit-title">Unit title</Label>
                  <Input
                    id="board-unit-title"
                    value={unitTitle}
                    onChange={(event) => setUnitTitle(event.target.value)}
                    className={fieldClass}
                    placeholder="Status, Tone, and Internet Gravity"
                  />
                </div>
                <div>
                  <Label htmlFor="board-unit-description">Description</Label>
                  <textarea
                    id="board-unit-description"
                    rows={3}
                    value={unitDescription}
                    onChange={(event) => setUnitDescription(event.target.value)}
                    className={fieldClass}
                    placeholder="What this unit covers."
                  />
                </div>
                {unitFeedback ? (
                  <p className="rounded-md bg-secondary px-3 py-2 text-sm text-foreground">
                    {unitFeedback}
                  </p>
                ) : null}
                <div className="flex items-center gap-2">
                  {unitMode === "edit" ? (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={
                          !selectedUnit ||
                          deleteUnit.isPending ||
                          (selectedUnit?.lessons.length ?? 0) > 0
                        }
                        onClick={() => void handleDeleteUnit()}
                      >
                        <Trash2 className="size-4" />
                        Delete
                      </Button>
                      <Button
                        type="button"
                        disabled={!selectedUnit || updateUnit.isPending}
                        onClick={() => void handleSaveUnit()}
                      >
                        <Save className="size-4" />
                        Save
                      </Button>
                    </>
                  ) : (
                    <Button
                      type="button"
                      disabled={createUnit.isPending}
                      onClick={() => void handleCreateUnit()}
                    >
                      <Plus className="size-4" />
                      Create
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Select a unit to edit it, or create a new one.
              </p>
            )
          }
        >
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleUnitDragEnd}
          >
            <div className="h-full overflow-y-auto">
              {sortedUnits.length === 0 ? (
                <div className="px-4 py-6 text-sm text-muted-foreground">
                  No units yet. Create the first unit to start building the curriculum.
                </div>
              ) : null}
              {sortedUnits.map((unit) => (
                <ReorderableListItem
                  key={unit.id}
                  id={`unit:${unit.id}`}
                  selected={selectedUnit?.id === unit.id}
                  onSelect={() => {
                    if (selectedUnit?.id === unit.id) {
                      setSelectedUnitId(null);
                      setSelectedLessonId(null);
                      setSelectedStepId(null);
                    } else {
                      setSelectedUnitId(unit.id);
                      setUnitMode("edit");
                    }
                    setUnitFeedback(null);
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{unit.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {getApprovedLessons(unit).length} approved lesson
                        {getApprovedLessons(unit).length === 1 ? "" : "s"}
                      </p>
                    </div>
                    <Badge variant="secondary">#{unit.orderIndex}</Badge>
                  </div>
                </ReorderableListItem>
              ))}
            </div>
          </DndContext>
        </BoardColumn>

        <BoardColumn
          title="Lessons"
          description={
            selectedUnit
              ? `Approved lessons inside ${selectedUnit.title}.`
              : "Select a unit to manage its lessons."
          }
          icon={<BookOpenText className="size-4" />}
          footerRef={lessonFooterRef}
          action={
            <Button type="button" size="sm" onClick={createNewLesson} disabled={!selectedUnit}>
              <Plus className="size-4" />
              Lesson
            </Button>
          }
          footer={
            lessonMode === "create" || selectedLesson ? (
              <div className="space-y-3">
                <div>
                  <Label htmlFor="board-lesson-title">Lesson title</Label>
                  <Input
                    id="board-lesson-title"
                    value={lessonForm.title}
                    onChange={(event) =>
                      setLessonForm((current) => ({ ...current, title: event.target.value }))
                    }
                    className={fieldClass}
                    placeholder="Why “mid” became a drag"
                  />
                </div>
                <div>
                  <Label htmlFor="board-lesson-description">Description</Label>
                  <textarea
                    id="board-lesson-description"
                    rows={3}
                    value={lessonForm.description}
                    onChange={(event) =>
                      setLessonForm((current) => ({ ...current, description: event.target.value }))
                    }
                    className={fieldClass}
                    placeholder="Describe what this lesson teaches."
                  />
                </div>
                <div>
                  <Label htmlFor="board-lesson-objective">Learning objective</Label>
                  <Input
                    id="board-lesson-objective"
                    value={lessonForm.learningObjective}
                    onChange={(event) =>
                      setLessonForm((current) => ({
                        ...current,
                        learningObjective: event.target.value,
                      }))
                    }
                    className={fieldClass}
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <Label htmlFor="board-lesson-minutes">Estimated minutes</Label>
                  <Input
                    id="board-lesson-minutes"
                    type="number"
                    min="1"
                    value={lessonForm.estimatedMinutes}
                    onChange={(event) =>
                      setLessonForm((current) => ({
                        ...current,
                        estimatedMinutes: event.target.value,
                      }))
                    }
                    className={fieldClass}
                    placeholder="Optional"
                  />
                </div>
                {lessonFeedback ? (
                  <p className="rounded-md bg-secondary px-3 py-2 text-sm text-foreground">
                    {lessonFeedback}
                  </p>
                ) : null}
                <div className="flex items-center gap-2">
                  {lessonMode === "edit" ? (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={!selectedLesson || deleteLesson.isPending}
                        onClick={() => void handleDeleteLesson()}
                      >
                        <Trash2 className="size-4" />
                        Delete
                      </Button>
                      <Button
                        type="button"
                        disabled={!selectedLesson || patchLesson.isPending}
                        onClick={() => void handleSaveLesson()}
                      >
                        <Save className="size-4" />
                        Save
                      </Button>
                    </>
                  ) : (
                    <Button
                      type="button"
                      disabled={!selectedUnit || createLesson.isPending || patchLesson.isPending}
                      onClick={() => void handleCreateLesson()}
                    >
                      <Plus className="size-4" />
                      Create
                    </Button>
                  )}
                </div>
              </div>
            ) : selectedUnit ? (
              <p className="text-sm text-muted-foreground">
                Select a lesson to edit it, or create a new one.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Pick a unit to edit lessons.</p>
            )
          }
        >
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleLessonDragEnd}
          >
            <div className="h-full overflow-y-auto">
              {!selectedUnit ? (
                <div className="px-4 py-6 text-sm text-muted-foreground">
                  Select a unit to browse or create approved lessons.
                </div>
              ) : approvedLessons.length === 0 ? (
                <div className="px-4 py-6 text-sm text-muted-foreground">
                  No approved lessons in this unit yet.
                </div>
              ) : null}
              {approvedLessons.map((lesson) => (
                <ReorderableListItem
                  key={lesson.id}
                  id={`lesson:${lesson.id}`}
                  selected={selectedLesson?.id === lesson.id}
                  onSelect={() => {
                    if (selectedLesson?.id === lesson.id) {
                      setSelectedLessonId(null);
                      setSelectedStepId(null);
                    } else {
                      setSelectedLessonId(lesson.id);
                      setLessonMode("edit");
                    }
                    setLessonFeedback(null);
                  }}
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{lesson.title}</p>
                        <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                          {lesson.description}
                        </p>
                      </div>
                      <Badge variant="secondary">#{lesson.orderIndex}</Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className={statusBadgeTone(lesson.status)}>
                        {lesson.status}
                      </Badge>
                      {lesson.estimatedMinutes ? (
                        <Badge variant="outline">{lesson.estimatedMinutes} min</Badge>
                      ) : null}
                      {lesson.learningObjective ? (
                        <span className="text-xs text-muted-foreground">
                          {lesson.learningObjective}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </ReorderableListItem>
              ))}
            </div>
          </DndContext>
        </BoardColumn>

        <BoardColumn
          title="Lesson Steps"
          description={
            selectedLesson
              ? `Edit or reorder the steps inside ${selectedLesson.title}.`
              : "Select an approved lesson to edit its steps."
          }
          icon={<ListOrdered className="size-4" />}
          footerRef={stepFooterRef}
          action={
            <Button type="button" size="sm" onClick={createNewStep} disabled={!selectedLesson}>
              <Plus className="size-4" />
              Step
            </Button>
          }
          footer={
            stepMode === "create" || selectedStep ? (
              <div className="space-y-3">
                <div>
                  <Label>Step type</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(["TEACH", "QUESTION", "DIALOGUE", "RECAP"] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        className={cn(
                          "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                          stepForm.stepType === type
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background text-foreground hover:bg-accent",
                        )}
                        onClick={() => setStepForm((current) => ({ ...current, stepType: type }))}
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
                </div>

                {stepForm.stepType === "TEACH" ? (
                  <>
                    <div>
                      <Label htmlFor="board-step-teach-title">Step title</Label>
                      <Input
                        id="board-step-teach-title"
                        value={stepForm.teachTitle}
                        onChange={(event) =>
                          setStepForm((current) => ({ ...current, teachTitle: event.target.value }))
                        }
                        className={fieldClass}
                      />
                    </div>
                    <div>
                      <Label htmlFor="board-step-teach-body">Teaching copy</Label>
                      <textarea
                        id="board-step-teach-body"
                        rows={4}
                        value={stepForm.teachBody}
                        onChange={(event) =>
                          setStepForm((current) => ({ ...current, teachBody: event.target.value }))
                        }
                        className={fieldClass}
                      />
                    </div>
                    <div>
                      <Label htmlFor="board-step-teach-example">Example</Label>
                      <Input
                        id="board-step-teach-example"
                        value={stepForm.teachExample}
                        onChange={(event) =>
                          setStepForm((current) => ({
                            ...current,
                            teachExample: event.target.value,
                          }))
                        }
                        className={fieldClass}
                      />
                    </div>
                  </>
                ) : null}

                {stepForm.stepType === "DIALOGUE" ? (
                  <div>
                    <Label htmlFor="board-step-dialogue">Dialogue</Label>
                    <textarea
                      id="board-step-dialogue"
                      rows={5}
                      value={stepForm.dialogueText}
                      onChange={(event) =>
                        setStepForm((current) => ({ ...current, dialogueText: event.target.value }))
                      }
                      className={fieldClass}
                    />
                  </div>
                ) : null}

                {stepForm.stepType === "QUESTION" ? (
                  <>
                    <div>
                      <Label>Question type</Label>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(["SHORT_ANSWER", "MCQ", "MATCH"] as const).map((type) => (
                          <button
                            key={type}
                            type="button"
                            className={cn(
                              "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                              stepForm.questionType === type
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border bg-background text-foreground hover:bg-accent",
                            )}
                            onClick={() =>
                              setStepForm((current) => ({ ...current, questionType: type }))
                            }
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
                      <Label htmlFor="board-step-question-prompt">Prompt</Label>
                      <textarea
                        id="board-step-question-prompt"
                        rows={3}
                        value={stepForm.questionPrompt}
                        onChange={(event) =>
                          setStepForm((current) => ({
                            ...current,
                            questionPrompt: event.target.value,
                          }))
                        }
                        className={fieldClass}
                      />
                    </div>

                    {stepForm.questionType === "SHORT_ANSWER" ? (
                      <div>
                        <Label htmlFor="board-step-short-answer">Accepted answers</Label>
                        <Input
                          id="board-step-short-answer"
                          value={stepForm.questionAcceptedAnswers}
                          onChange={(event) =>
                            setStepForm((current) => ({
                              ...current,
                              questionAcceptedAnswers: event.target.value,
                            }))
                          }
                          className={fieldClass}
                          placeholder="Separate answers with commas"
                        />
                      </div>
                    ) : null}

                    {stepForm.questionType === "MCQ" ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <Label>Choices</Label>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              setStepForm((current) => ({
                                ...current,
                                questionChoices: [...current.questionChoices, createChoice()],
                              }))
                            }
                          >
                            <Plus className="size-4" />
                            Add
                          </Button>
                        </div>
                        {stepForm.questionChoices.map((choice, index) => (
                          <div key={choice.id} className="flex items-center gap-3">
                            <input
                              type="radio"
                              checked={choice.isCorrect}
                              name="board-mcq-correct"
                              onChange={() =>
                                setStepForm((current) => ({
                                  ...current,
                                  questionChoices: current.questionChoices.map((item) => ({
                                    ...item,
                                    isCorrect: item.id === choice.id,
                                  })),
                                }))
                              }
                            />
                            <Input
                              value={choice.text}
                              onChange={(event) =>
                                setStepForm((current) => ({
                                  ...current,
                                  questionChoices: current.questionChoices.map((item) =>
                                    item.id === choice.id
                                      ? { ...item, text: event.target.value }
                                      : item,
                                  ),
                                }))
                              }
                              className="border-border bg-background"
                              placeholder={`Choice ${index + 1}`}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              disabled={stepForm.questionChoices.length <= 2}
                              onClick={() =>
                                setStepForm((current) => ({
                                  ...current,
                                  questionChoices: current.questionChoices.filter(
                                    (item) => item.id !== choice.id,
                                  ),
                                }))
                              }
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {stepForm.questionType === "MATCH" ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <Label>Pairs</Label>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              setStepForm((current) => ({
                                ...current,
                                questionMatchPairs: [...current.questionMatchPairs, createPair()],
                              }))
                            }
                          >
                            <Plus className="size-4" />
                            Add
                          </Button>
                        </div>
                        {stepForm.questionMatchPairs.map((pair, index) => (
                          <div
                            key={pair.id}
                            className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
                          >
                            <Input
                              value={pair.left}
                              onChange={(event) =>
                                setStepForm((current) => ({
                                  ...current,
                                  questionMatchPairs: current.questionMatchPairs.map((item) =>
                                    item.id === pair.id
                                      ? { ...item, left: event.target.value }
                                      : item,
                                  ),
                                }))
                              }
                              className="border-border bg-background"
                              placeholder={`Left item ${index + 1}`}
                            />
                            <Input
                              value={pair.right}
                              onChange={(event) =>
                                setStepForm((current) => ({
                                  ...current,
                                  questionMatchPairs: current.questionMatchPairs.map((item) =>
                                    item.id === pair.id
                                      ? { ...item, right: event.target.value }
                                      : item,
                                  ),
                                }))
                              }
                              className="border-border bg-background"
                              placeholder={`Right item ${index + 1}`}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              disabled={stepForm.questionMatchPairs.length <= 2}
                              onClick={() =>
                                setStepForm((current) => ({
                                  ...current,
                                  questionMatchPairs: current.questionMatchPairs.filter(
                                    (item) => item.id !== pair.id,
                                  ),
                                }))
                              }
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </>
                ) : null}

                {stepForm.stepType === "RECAP" ? (
                  <>
                    <div>
                      <Label htmlFor="board-step-recap-headline">Headline</Label>
                      <Input
                        id="board-step-recap-headline"
                        value={stepForm.recapHeadline}
                        onChange={(event) =>
                          setStepForm((current) => ({
                            ...current,
                            recapHeadline: event.target.value,
                          }))
                        }
                        className={fieldClass}
                      />
                    </div>
                    <div>
                      <Label htmlFor="board-step-recap-summary">Summary</Label>
                      <textarea
                        id="board-step-recap-summary"
                        rows={4}
                        value={stepForm.recapSummary}
                        onChange={(event) =>
                          setStepForm((current) => ({
                            ...current,
                            recapSummary: event.target.value,
                          }))
                        }
                        className={fieldClass}
                      />
                    </div>
                    <div>
                      <Label htmlFor="board-step-recap-takeaways">Takeaways</Label>
                      <textarea
                        id="board-step-recap-takeaways"
                        rows={4}
                        value={stepForm.recapTakeaways}
                        onChange={(event) =>
                          setStepForm((current) => ({
                            ...current,
                            recapTakeaways: event.target.value,
                          }))
                        }
                        className={fieldClass}
                        placeholder="One takeaway per line"
                      />
                    </div>
                  </>
                ) : null}

                {stepFeedback ? (
                  <p className="rounded-md bg-secondary px-3 py-2 text-sm text-foreground">
                    {stepFeedback}
                  </p>
                ) : null}
                <div className="flex items-center gap-2">
                  {stepMode === "edit" ? (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={!selectedStep || deleteStep.isPending}
                        onClick={() => void handleDeleteStep()}
                      >
                        <Trash2 className="size-4" />
                        Delete
                      </Button>
                      <Button
                        type="button"
                        disabled={!selectedStep || patchStep.isPending}
                        onClick={() => void handleSaveStep()}
                      >
                        <Save className="size-4" />
                        Save
                      </Button>
                    </>
                  ) : (
                    <Button
                      type="button"
                      disabled={!selectedLesson || createStep.isPending}
                      onClick={() => void handleCreateStep()}
                    >
                      <Plus className="size-4" />
                      Create
                    </Button>
                  )}
                </div>
              </div>
            ) : selectedLesson ? (
              <p className="text-sm text-muted-foreground">
                Select a step to edit it, or create a new one.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Pick a lesson to edit steps.</p>
            )
          }
        >
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleStepDragEnd}
          >
            <div className="h-full overflow-y-auto">
              {!selectedLesson ? (
                <div className="px-4 py-6 text-sm text-muted-foreground">
                  Select a lesson to edit or reorder its steps.
                </div>
              ) : lessonDetailQuery.isLoading ? (
                <div className="px-4 py-6 text-sm text-muted-foreground">
                  Loading lesson steps...
                </div>
              ) : lessonDetailQuery.error ? (
                <div className="px-4 py-6 text-sm text-destructive">
                  Could not load lesson steps.
                </div>
              ) : stepItems.length === 0 ? (
                <div className="px-4 py-6 text-sm text-muted-foreground">
                  This lesson has no steps yet. Add the first one from the editor below.
                </div>
              ) : null}
              {stepItems.map((step) => {
                const summary = summarizeStep(step);
                return (
                  <ReorderableListItem
                    key={step.id}
                    id={`step:${step.id}`}
                    selected={selectedStep?.id === step.id}
                    onSelect={() => {
                      if (selectedStep?.id === step.id) {
                        setSelectedStepId(null);
                      } else {
                        setSelectedStepId(step.id);
                        setStepMode("edit");
                      }
                      setStepFeedback(null);
                    }}
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{summary.title}</p>
                          <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                            {summary.detail}
                          </p>
                        </div>
                        <Badge variant="secondary">#{step.orderIndex}</Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{step.stepType}</Badge>
                        {step.stepType === "QUESTION" && step.question?.questionType ? (
                          <Badge variant="outline">{step.question.questionType}</Badge>
                        ) : null}
                      </div>
                    </div>
                  </ReorderableListItem>
                );
              })}
            </div>
          </DndContext>
        </BoardColumn>
      </div>
    </div>
  );
}
