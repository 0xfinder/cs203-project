import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { BookPlus, GraduationCap, NotebookPen, Sparkles } from "lucide-react";
import { requireOnboardingCompleted } from "@/lib/auth";
import { api } from "@/lib/api";
import { getMe } from "@/lib/me";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { LessonForm } from "@/components/lesson-quiz-forms";

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
    <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Add Content</h1>
          <p className="text-sm text-muted-foreground">
            Draft a new dictionary term or lesson for AlphaLingo’s learning library.
          </p>
        </div>

        <Card className="overflow-hidden border-border/70 bg-card/95 shadow-sm">
          <CardContent className="grid gap-5 p-5 sm:grid-cols-[minmax(0,1fr)_220px] sm:items-center">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <BookPlus className="size-5" />
                </div>
                <div>
                  <p className="text-base font-semibold">Build thoughtful content</p>
                  <p className="text-sm text-muted-foreground">
                    Keep entries crisp, specific, and useful for learners discovering Gen-Alpha
                    culture.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <div className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1.5 text-sm text-muted-foreground">
                  <Sparkles className="size-4 text-primary" />
                  Reviewed before publishing
                </div>
                <div className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1.5 text-sm text-muted-foreground">
                  <NotebookPen className="size-4 text-primary" />
                  Add lingo with examples
                </div>
                <div className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1.5 text-sm text-muted-foreground">
                  <GraduationCap className="size-4 text-primary" />
                  Build lesson drafts
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border/60 bg-muted/40 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Quality Bar
              </p>
              <div className="mt-3 space-y-3 text-sm">
                <div>
                  <p className="font-medium">Clear explanation</p>
                  <p className="text-muted-foreground">
                    Define the term or lesson in direct language, not references alone.
                  </p>
                </div>
                <div>
                  <p className="font-medium">Good context</p>
                  <p className="text-muted-foreground">
                    Include examples that show how the slang or concept is actually used.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

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

        <Card className="border-border/70 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle>Submission Workspace</CardTitle>
            <CardDescription>
              Switch between quick lingo submissions and longer-form lesson drafting.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
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
                            className="mt-1.5"
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
                            className="mt-1.5 w-full rounded-md border bg-card px-3 py-2 text-sm"
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
                            className="mt-1.5"
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
                          Good examples read like something a learner might genuinely encounter
                          online.
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
                <Card className="border-border/60">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-lg">Lesson Draft</CardTitle>
                    <CardDescription>
                      Create a new lesson step-by-step and send it into the review flow.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <LessonForm />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
