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
  const options = question.shuffledRights;

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

  const clearPair = (left: string) => {
    const next = { ...currentMap };
    delete next[left];
    onChange(next);
  };

  const isUsedByAnother = (left: string, option: string) =>
    Object.entries(currentMap).some(([key, selected]) => key !== left && selected === option);

  return (
    <div>
      <h2 className="mb-2 text-2xl font-bold sm:text-3xl">{question.prompt}</h2>
      <p className="mb-6 text-sm text-muted-foreground">Tap the correct meaning for each term.</p>

      <div className="space-y-4">
        {question.matchPairs.map((pair) => {
          const selected = currentMap[pair.left] ?? null;
          return (
            <div key={pair.id} className="rounded-xl border p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="text-sm font-semibold sm:text-base">{pair.left}</div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => clearPair(pair.left)}
                  disabled={!selected}
                >
                  Clear
                </Button>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {options.map((option, idx) => {
                  const isSelected = selected === option;
                  const isDisabled = isUsedByAnother(pair.left, option);
                  return (
                    <Button
                      key={`${pair.id}-${idx}`}
                      type="button"
                      variant={isSelected ? "default" : "outline"}
                      className="h-auto justify-start whitespace-normal px-3 py-2 text-left"
                      onClick={() => setPair(pair.left, option)}
                      disabled={isDisabled}
                    >
                      {option}
                    </Button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function asTextAnswer(value: LessonAnswer): string {
  return typeof value === "string" ? value : "";
}

function asMatchAnswer(value: LessonAnswer): Record<string, string> {
  return typeof value === "string" ? {} : value;
}
