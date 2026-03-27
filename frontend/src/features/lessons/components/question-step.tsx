import { useState } from "react";
import {
  type DragEndEvent,
  type DragStartEvent,
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { MoveDown, MoveRight, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type {
  LessonAnswer,
  LessonStepPayload,
  QuestionPayload,
} from "@/features/lessons/useLessonsApi";

type QuestionStepProps = {
  step: LessonStepPayload;
  value: LessonAnswer;
  onChange: (value: LessonAnswer) => void;
};

export function QuestionStep({ step, value, onChange }: QuestionStepProps) {
  const question = step.question;
  if (!question) {
    return (
      <div>
        <p>Question payload missing.</p>
      </div>
    );
  }

  if (question.questionType === "MCQ") {
    return <McqQuestion question={question} value={asTextAnswer(value)} onChange={onChange} />;
  }

  if (question.questionType === "MATCH") {
    return <MatchQuestion question={question} value={asMatchAnswer(value)} onChange={onChange} />;
  }

  return <TextQuestion question={question} value={asTextAnswer(value)} onChange={onChange} />;
}

function McqQuestion({
  question,
  value,
  onChange,
}: {
  question: QuestionPayload;
  value: string;
  onChange: (value: LessonAnswer) => void;
}) {
  return (
    <div>
      <h2 className="mb-8 text-2xl font-bold sm:text-3xl">{question.prompt}</h2>
      <div className="space-y-3">
        {question.choices.map((choice) => {
          const selected = value === choice.text;
          return (
            <button
              key={choice.id}
              type="button"
              onClick={() => onChange(choice.text)}
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

function TextQuestion({
  question,
  value,
  onChange,
}: {
  question: QuestionPayload;
  value: string;
  onChange: (value: LessonAnswer) => void;
}) {
  return (
    <div>
      <h2 className="mb-4 text-2xl font-bold sm:text-3xl">{question.prompt}</h2>
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Type your answer"
      />
    </div>
  );
}

function MatchQuestion({
  question,
  value,
  onChange,
}: {
  question: QuestionPayload;
  value: Record<string, string>;
  onChange: (value: LessonAnswer) => void;
}) {
  const currentMap = value;
  const prompt =
    question.prompt === "Match each term to the correct meaning."
      ? "Match each term to the correct meaning"
      : question.prompt;
  const [activeOption, setActiveOption] = useState<string | null>(null);
  const [draggingOption, setDraggingOption] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
  );
  const usedOptions = new Set(Object.values(currentMap));
  const availableOptions = question.shuffledRights.filter((option) => !usedOptions.has(option));
  const selectedOption =
    activeOption && availableOptions.includes(activeOption) ? activeOption : null;
  const matchedCount = question.matchPairs.filter((pair) => {
    const selected = currentMap[pair.left];
    return typeof selected === "string" && selected.trim().length > 0;
  }).length;
  const totalPairs = question.matchPairs.length;
  const solved = totalPairs > 0 && matchedCount === totalPairs;

  const setPair = (left: string, right: string) => {
    const next = { ...currentMap };
    for (const key of Object.keys(next)) {
      if (key !== left && next[key] === right) {
        delete next[key];
      }
    }
    next[left] = right;
    onChange(next);
  };

  const clearAll = () => {
    onChange({});
    setActiveOption(null);
  };

  const clearPairByOption = (option: string) => {
    const next = { ...currentMap };
    const left = Object.entries(next).find(([, selected]) => selected === option)?.[0];
    if (!left) {
      return;
    }
    delete next[left];
    onChange(next);
  };

  const assignSelectedOption = (left: string) => {
    if (!selectedOption) {
      return;
    }
    setPair(left, selectedOption);
    setActiveOption(null);
  };

  const onDragStart = (event: DragStartEvent) => {
    setDraggingOption(readOptionId(event.active.id));
  };

  const onDragEnd = (event: DragEndEvent) => {
    const option = readOptionId(event.active.id);
    const overId = event.over?.id;
    const left = overId ? readSlotId(overId) : null;
    setDraggingOption(null);
    if (!option) {
      return;
    }
    if (overId === getBankId()) {
      clearPairByOption(option);
      setActiveOption(null);
      return;
    }
    if (!left) {
      return;
    }
    setPair(left, option);
    setActiveOption(null);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDraggingOption(null)}
    >
      <div className="relative">
        <div className="relative">
          <div className="mb-6 space-y-3">
            <div className="space-y-2">
              <h2 className="text-2xl font-bold sm:text-3xl">{prompt}</h2>
            </div>

            <div className="flex items-center justify-between gap-2">
              <p className="min-w-0 text-sm text-muted-foreground">Tap or drag to match.</p>
              <div className="flex shrink-0 items-center gap-2">
                <Badge
                  variant="outline"
                  className="border-chart-1/20 bg-chart-1/8 px-3 py-1 text-xs font-semibold text-chart-1"
                >
                  {matchedCount} / {totalPairs} matched
                </Badge>
                {matchedCount > 0 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 rounded-full px-2.5 text-xs font-semibold text-muted-foreground"
                    onClick={clearAll}
                  >
                    <RotateCcw className="size-3.5" />
                    Clear all
                  </Button>
                ) : null}
                {solved ? (
                  <Badge className="bg-success/90 px-3 py-1 text-xs font-semibold text-success-foreground hover:bg-success/90">
                    Ready
                  </Badge>
                ) : null}
              </div>
            </div>
          </div>

          <div className="grid gap-3 xl:grid-cols-[minmax(18rem,0.95fr)_auto_minmax(0,1.35fr)] xl:items-center xl:gap-4">
            <MatchAnswerBank
              availableOptions={availableOptions}
              selectedOption={selectedOption}
              onSelectOption={(option) =>
                setActiveOption((current) => (current === option ? null : option))
              }
            />

            <div className="flex justify-center xl:hidden">
              <div className="flex size-8 items-center justify-center rounded-full border border-border/70 bg-background/80 text-muted-foreground">
                <MoveDown className="size-4" />
              </div>
            </div>

            <div className="hidden justify-center xl:flex">
              <div className="flex size-10 items-center justify-center rounded-full border border-border/70 bg-background/80 text-muted-foreground">
                <MoveRight className="size-5" />
              </div>
            </div>

            <div className="space-y-3">
              {question.matchPairs.map((pair) => {
                const selected = currentMap[pair.left] ?? null;
                return (
                  <MatchPairCard
                    key={pair.id}
                    left={pair.left}
                    selected={selected}
                    activeOption={selectedOption}
                    onAssign={() => assignSelectedOption(pair.left)}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <DragOverlay>
        {draggingOption ? <MatchOptionCard option={draggingOption} selected overlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function MatchPairCard({
  left,
  selected,
  activeOption,
  onAssign,
}: {
  left: string;
  selected: string | null;
  activeOption: string | null;
  onAssign: () => void;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: getSlotId(left),
  });

  return (
    <div
      className={cn(
        "rounded-[1.5rem] border bg-background/80 p-3 shadow-xs transition-all sm:p-4",
        selected
          ? "border-chart-1/20 bg-background shadow-sm"
          : "border-border/70 hover:border-chart-1/20 hover:bg-accent/30",
      )}
    >
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="min-w-0 max-w-[5.5rem] shrink-0 sm:max-w-[7rem] lg:max-w-[8rem]">
          <p className="text-sm font-semibold text-foreground sm:text-base">{left}</p>
        </div>

        <div
          ref={setNodeRef}
          className={cn(
            "group flex min-w-0 flex-1 items-center text-left transition-all",
            selected
              ? "rounded-[1.25rem] px-0 py-0"
              : "min-h-14 rounded-[1.5rem] border border-dashed bg-card/80 px-2.5 py-2 sm:min-h-16 sm:px-3",
            selected && !isOver && !activeOption && "border-0 bg-transparent",
            !selected &&
              (isOver
                ? "border-chart-1/45 bg-chart-1/10 ring-2 ring-chart-1/15"
                : "border-border/80"),
            activeOption &&
              (selected
                ? "cursor-pointer rounded-[1.25rem] border border-chart-2/35 bg-chart-2/8 px-1 py-1"
                : "cursor-pointer border-chart-2/35 bg-chart-2/8"),
            !activeOption && !selected && "hover:border-chart-1/20 hover:bg-accent/25",
          )}
        >
          {selected ? (
            <MatchOptionCard
              option={selected}
              selected
              inSlot
              onClick={() => {
                if (activeOption) {
                  onAssign();
                }
              }}
            />
          ) : (
            <button
              type="button"
              onClick={onAssign}
              className="flex w-full items-center text-left"
            >
              <div className="min-w-0 flex-1 overflow-hidden">
                <p className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:text-[11px]">
                  Drag & drop here
                </p>
              </div>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function MatchAnswerBank({
  availableOptions,
  selectedOption,
  onSelectOption,
}: {
  availableOptions: string[];
  selectedOption: string | null;
  onSelectOption: (option: string) => void;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: getBankId(),
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-[1.5rem] border border-border/70 bg-background/70 p-4 shadow-xs transition-all",
        isOver && "border-chart-2/35 bg-chart-2/8 ring-2 ring-chart-2/12",
      )}
    >
      <div className="grid gap-2">
        {availableOptions.map((option) => (
          <MatchOptionCard
            key={option}
            option={option}
            selected={selectedOption === option}
            onClick={() => onSelectOption(option)}
          />
        ))}

        {availableOptions.length === 0 ? (
          <div
            className={cn(
              "rounded-2xl border border-dashed px-4 py-5 text-center transition-all",
              isOver ? "border-chart-2/35 bg-chart-2/8" : "border-success/35 bg-success/8",
            )}
          >
            <p className="text-sm font-semibold text-foreground">
              {isOver ? "Release to unmatch" : "Board complete"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {isOver
                ? "Drop this card here to send it back into the answer bank."
                : "Every term has a match. You can continue whenever you're ready."}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function MatchOptionCard({
  option,
  selected,
  onClick,
  overlay = false,
  inSlot = false,
}: {
  option: string;
  selected: boolean;
  onClick?: () => void;
  overlay?: boolean;
  inSlot?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: getOptionId(option),
    disabled: overlay,
  });

  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={onClick}
      style={
        transform
          ? {
              transform: CSS.Translate.toString(transform),
            }
          : undefined
      }
      className={cn(
        "group flex w-full items-start rounded-[1.25rem] border px-4 py-3 text-left shadow-xs transition-all",
        selected && !inSlot
          ? "border-chart-1/35 bg-chart-1/10 shadow-sm"
          : "border-border/70 bg-card hover:border-chart-1/25 hover:bg-accent/30",
        inSlot && "items-center border-0 bg-transparent px-0 py-0 shadow-none",
        isDragging && "opacity-40",
        overlay && "rotate-1 shadow-lg",
      )}
      {...attributes}
      {...listeners}
    >
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Meaning
        </p>
        <p className="mt-1 text-sm font-semibold text-foreground sm:text-[15px]">{option}</p>
      </div>
    </button>
  );
}

function getOptionId(option: string) {
  return `option:${option}`;
}

function readOptionId(id: string | number) {
  return typeof id === "string" && id.startsWith("option:") ? id.slice(7) : null;
}

function getSlotId(left: string) {
  return `slot:${left}`;
}

function readSlotId(id: string | number) {
  return typeof id === "string" && id.startsWith("slot:") ? id.slice(5) : null;
}

function getBankId() {
  return "match-bank";
}

function asTextAnswer(value: LessonAnswer): string {
  return typeof value === "string" ? value : "";
}

function asMatchAnswer(value: LessonAnswer): Record<string, string> {
  return typeof value === "string" ? {} : value;
}
