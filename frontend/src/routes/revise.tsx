import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireOnboardingCompleted } from "@/lib/auth";
import { useSubmitVocabMemoryAttempt, useVocabMemoryDue } from "@/features/lessons/useLessonsApi";

function RevisePage() {
  const { data: dueItems, isLoading, error } = useVocabMemoryDue(20);
  const submitMutation = useSubmitVocabMemoryAttempt();
  const [answers, setAnswers] = useState<Record<number, boolean>>({});

  if (isLoading) {
    return <div className="p-8 text-center">Loading review queue...</div>;
  }

  if (error) {
    return <div className="p-8 text-center text-destructive">Failed to load review queue.</div>;
  }

  const items = dueItems ?? [];

  const onSubmit = () => {
    const payload = Object.entries(answers).map(([vocabItemId, correct]) => ({
      vocabItemId: Number(vocabItemId),
      correct,
    }));

    if (payload.length === 0) {
      return;
    }

    submitMutation.mutate(payload);
    setAnswers({});
  };

  return (
    <div className="flex-1 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Revise</h1>
        <p className="mb-6 text-muted-foreground">
          Mark each item as remembered or needs practice to update your spaced-review schedule.
        </p>

        {items.length === 0 ? (
          <Card className="p-6">
            <p className="text-center text-muted-foreground">No items are due right now.</p>
          </Card>
        ) : (
          <div className="grid gap-4">
            {items.map((item) => (
              <Card key={item.vocabItemId} className="p-6">
                <h2 className="text-xl font-semibold">{item.term}</h2>
                <p className="mt-2 text-muted-foreground">{item.definition}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Strength {item.strength} • Streak {item.correctStreak}
                </p>
                <div className="mt-4 flex gap-3">
                  <Button
                    variant={answers[item.vocabItemId] === true ? "default" : "outline"}
                    onClick={() =>
                      setAnswers((prev) => ({
                        ...prev,
                        [item.vocabItemId]: true,
                      }))
                    }
                  >
                    I remembered this
                  </Button>
                  <Button
                    variant={answers[item.vocabItemId] === false ? "destructive" : "outline"}
                    onClick={() =>
                      setAnswers((prev) => ({
                        ...prev,
                        [item.vocabItemId]: false,
                      }))
                    }
                  >
                    Need more practice
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}

        <div className="mt-6">
          <Button
            onClick={onSubmit}
            disabled={submitMutation.isPending || Object.keys(answers).length === 0}
          >
            {submitMutation.isPending ? "Submitting..." : "Submit Review"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/revise")({
  beforeLoad: requireOnboardingCompleted,
  component: RevisePage,
});
