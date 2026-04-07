import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { requireOnboardingCompleted } from "@/lib/auth";
import { api } from "@/lib/api";
import { getMe } from "@/lib/me";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { LessonForm } from "@/components/lesson-quiz-forms";
import { AppPageShell } from "@/components/app-page-shell";

const addFieldClass =
  "mt-1.5 rounded-xl border-border bg-background focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20";

const addTextareaClass =
  "mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20";

export const Route = createFileRoute("/add")({
  beforeLoad: requireOnboardingCompleted,
  component: SubmitContentPage,
});

function SubmitContentPage() {
  const [term, setTerm] = useState("");
  const [definition, setDefinition] = useState("");
  const [example, setExample] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleLingoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const me = await getMe();
      const payload = {
        term: term.trim(),
        definition: definition.trim(),
        example: example.trim() || null,
        submittedBy: me.email ?? "",
      };
      await api.post("contents", { json: payload }).json();
      setSuccess(
        me.role === "ADMIN" || me.role === "MODERATOR"
          ? "Added and live."
          : "Submitted — pending review.",
      );
      setTerm("");
      setDefinition("");
      setExample("");
    } catch (err) {
      console.error(err);
      setError("Failed to submit term.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppPageShell contentClassName="max-w-4xl">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Add Content</h1>
          <p className="text-sm text-muted-foreground">
            Draft a new dictionary term or lesson for AlphaLingo’s learning library.
          </p>
        </div>

        {(success || error) && (
          <div>
            {success && (
              <p className="rounded-md bg-green-500/10 px-3 py-2 text-sm text-green-700 dark:text-green-400">
                {success}
              </p>
            )}
            {error && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
          </div>
        )}

        <Tabs defaultValue="lingo" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 rounded-xl bg-muted/70 p-1 sm:w-[360px]">
            <TabsTrigger value="lingo" className="rounded-lg">
              Add Lingo
            </TabsTrigger>
            <TabsTrigger value="lesson" className="rounded-lg">
              Add Lesson
            </TabsTrigger>
          </TabsList>

          <TabsContent value="lingo" className="mt-0">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
              <Card className="border-border/60">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg">Dictionary Submission</CardTitle>
                  <CardDescription>
                    Add one term at a time with a concise definition and optional usage example.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleLingoSubmit} className="space-y-5">
                    <div>
                      <Label htmlFor="add-term">Term</Label>
                      <Input
                        id="add-term"
                        name="term"
                        value={term}
                        onChange={(e) => setTerm(e.target.value)}
                        className={addFieldClass}
                        placeholder="e.g. aura farming"
                      />
                    </div>
                    <div>
                      <Label htmlFor="add-definition">Definition</Label>
                      <textarea
                        id="add-definition"
                        name="definition"
                        value={definition}
                        onChange={(e) => setDefinition(e.target.value)}
                        rows={6}
                        className={addTextareaClass}
                        placeholder="Explain what it means and why someone would use it."
                      />
                    </div>
                    <div>
                      <Label htmlFor="add-example">Example (optional)</Label>
                      <Input
                        id="add-example"
                        name="example"
                        value={example}
                        onChange={(e) => setExample(e.target.value)}
                        className={addFieldClass}
                        placeholder="Use it in a sentence or short context."
                      />
                    </div>
                    <div className="flex justify-end">
                      <Button
                        type="submit"
                        disabled={loading || !term.trim() || !definition.trim()}
                      >
                        {loading ? "Submitting…" : "Submit Lingo"}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>

              <Card className="border-border/60 bg-muted/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Before You Submit</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm text-muted-foreground">
                  <div>
                    <p className="font-medium text-foreground">Avoid vague definitions</p>
                    <p className="mt-1">
                      If the meaning depends on tone or context, mention that explicitly.
                    </p>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Prefer real usage</p>
                    <p className="mt-1">
                      Good examples read like something a learner might genuinely encounter online.
                    </p>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Keep it review-ready</p>
                    <p className="mt-1">
                      Clean formatting helps moderators approve strong entries faster.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="lesson" className="mt-0">
            <LessonForm />
          </TabsContent>
        </Tabs>
      </div>
    </AppPageShell>
  );
}
