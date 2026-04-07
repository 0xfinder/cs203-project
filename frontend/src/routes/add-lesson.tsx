import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { requireContributorOrOnboarded } from "@/lib/auth";
import { api } from "@/lib/api";
import { getMe } from "@/lib/me";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useUnits } from "@/features/lessons/useLessonsApi";

export const Route = createFileRoute("/add-lesson")({
  beforeLoad: requireContributorOrOnboarded,
  component: AddLessonPage,
});

function AddLessonPage() {
  const [activeTab, setActiveTab] = useState<string>("lesson");
  const { data: units } = useUnits();

  // Lesson fields
  const [unitId, setUnitId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [learningObjective, setLearningObjective] = useState("");
  const [estimatedMinutes, setEstimatedMinutes] = useState<number | undefined>(undefined);
  const [steps, setSteps] = useState<Array<{ type: string; content: string }>>([
    { type: "TEXT", content: "" },
  ]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (units && units.length > 0 && unitId === null) {
      setUnitId(units[0].id);
    }
  }, [units, unitId]);

  const addStep = () => setSteps((s) => [...s, { type: "TEXT", content: "" }]);
  const removeStep = (idx: number) => setSteps((s) => s.filter((_, i) => i !== idx));
  const updateStep = (idx: number, patch: Partial<{ type: string; content: string }>) =>
    setSteps((s) => s.map((st, i) => (i === idx ? { ...st, ...patch } : st)));

  const handleSubmitLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const me = await getMe();
      // Ensure backend-required fields are present. If the user left title/description
      // blank, derive them from the first step so validation (@NotBlank) succeeds.
      const firstStepContent = steps && steps.length > 0 ? steps[0].content || "" : "";
      const derivedTitle =
        title.trim() || firstStepContent.trim().split("\n")[0] || "Untitled Lesson";
      const derivedDescription =
        description.trim() ||
        firstStepContent.trim().split("\n").slice(0, 2).join(" ") ||
        derivedTitle;

      const payload = {
        unitId,
        title: derivedTitle,
        slug: slug.trim() || undefined,
        description: derivedDescription,
        learningObjective: learningObjective.trim() || undefined,
        estimatedMinutes: estimatedMinutes ?? null,
        steps: steps.map((s, i) => ({ orderIndex: i, stepType: s.type, content: s.content })),
        submittedBy: me.email ?? null,
      };

      await api.post("lessons", { json: payload }).json();
      setSuccess("Lesson submitted — it will appear after review.");
      setTitle("");
      setSlug("");
      setDescription("");
      setLearningObjective("");
      setSteps([{ type: "TEXT", content: "" }]);
    } catch (err) {
      console.error(err);
      setError("Failed to submit lesson. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Add New Lesson or Quiz</CardTitle>
          <CardDescription>
            Create a lesson or quiz for the Learn tab. Submitted items are reviewed before
            publishing.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="lesson">Add Lesson</TabsTrigger>
            </TabsList>

            <TabsContent value="lesson">
              <form onSubmit={handleSubmitLesson} className="space-y-4">
                <div>
                  <Label>Unit</Label>
                  <select
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
                  <Label>Learning Objective</Label>
                  <Input
                    value={learningObjective}
                    onChange={(e) => setLearningObjective(e.target.value)}
                  />
                </div>

                <div>
                  <Label>Estimated Minutes</Label>
                  <Input
                    type="number"
                    value={estimatedMinutes ?? ""}
                    onChange={(e) =>
                      setEstimatedMinutes(e.target.value ? Number(e.target.value) : undefined)
                    }
                  />
                </div>

                <div>
                  <Label>Steps</Label>
                  <div className="space-y-2 mt-2">
                    {steps.map((s, idx) => (
                      <div key={idx} className="flex gap-2">
                        <select
                          value={s.type}
                          onChange={(e) => updateStep(idx, { type: e.target.value })}
                          className="rounded-md border bg-card px-2"
                        >
                          <option value="TEXT">Text</option>
                          <option value="QUESTION">Question</option>
                        </select>
                        <input
                          className="flex-1 rounded-md border bg-card px-3 py-2"
                          value={s.content}
                          onChange={(e) => updateStep(idx, { content: e.target.value })}
                          placeholder={
                            s.type === "QUESTION" ? "Question prompt or payload" : "Step content"
                          }
                        />
                        <Button type="button" variant="destructive" onClick={() => removeStep(idx)}>
                          Remove
                        </Button>
                      </div>
                    ))}
                    <Button type="button" onClick={addStep}>
                      Add Step
                    </Button>
                  </div>
                </div>

                {error ? <p className="text-destructive">{error}</p> : null}
                {success ? <p className="text-success">{success}</p> : null}

                <div className="flex justify-end">
                  <Button type="submit" disabled={loading}>
                    {loading ? "Submitting…" : "Submit Lesson"}
                  </Button>
                </div>
              </form>
            </TabsContent>

            {/* quiz tab removed */}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
