import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { requireOnboardingCompleted } from "@/lib/auth";
import { api } from "@/lib/api";
import { getMe } from "@/lib/me";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
      setSuccess(me.role === "ADMIN" || me.role === "MODERATOR" ? "Added and live." : "Submitted — pending review.");
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
    <div className="mx-auto w-full max-w-xl flex-1 px-4 pt-8 pb-8 sm:px-6">
      <Card className="mx-auto w-full rounded-2xl mt-2">
        <CardHeader>
          <CardTitle>Add Content</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="lingo">
            <TabsList className="mb-4">
              <TabsTrigger value="lingo">Add Lingo</TabsTrigger>
              <TabsTrigger value="lesson">Add Lesson</TabsTrigger>
            </TabsList>

            <TabsContent value="lingo">
              <form onSubmit={handleLingoSubmit} className="space-y-6">
                <div>
                  <Label htmlFor="add-term">Term</Label>
                  <Input id="add-term" name="term" value={term} onChange={(e) => setTerm(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="add-definition">Definition</Label>
                  <textarea id="add-definition" name="definition" value={definition} onChange={(e) => setDefinition(e.target.value)} rows={6} className="mt-1 w-full rounded-md border bg-card px-3 py-2" />
                </div>
                <div>
                  <Label htmlFor="add-example">Example (optional)</Label>
                  <Input id="add-example" name="example" value={example} onChange={(e) => setExample(e.target.value)} className="mt-1" />
                </div>
                <div className="flex justify-end">
                  <Button type="submit" variant="default" className="rounded-md" disabled={loading || !term.trim() || !definition.trim()}>{loading ? "Submitting…" : "Submit"}</Button>
                </div>
                {success && <p className="text-sm text-green-600">{success}</p>}
                {error && <p className="text-sm text-destructive">{error}</p>}
              </form>
            </TabsContent>

            <TabsContent value="lesson">
              <LessonForm />
            </TabsContent>

            {/* removed Add Quiz tab */}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
