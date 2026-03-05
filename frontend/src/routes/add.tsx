import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { requireOnboardingCompleted } from "@/lib/auth";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { getMe } from "@/lib/me";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface ContentPayload {
  term: string;
  definition: string;
  example?: string | null;
  submittedBy: string;
}

export const Route = createFileRoute("/add")({
  beforeLoad: requireOnboardingCompleted,
  component: SubmitContentPage,
});

function SubmitContentPage() {
  const [activeTab, setActiveTab] = useState("term");
  const [term, setTerm] = useState("");
  const [definition, setDefinition] = useState("");
  const [example, setExample] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [existingTerms, setExistingTerms] = useState<any[]>([]);
  const [showConfirmation, setShowConfirmation] = useState(false);

  useEffect(() => {
    const checkRole = async () => {
      try {
        const me = await getMe();
        setHasAccess(me.role === "CONTRIBUTOR" || me.role === "MODERATOR" || me.role === "ADMIN");
      } catch {
        setHasAccess(false);
      }
    };
    checkRole();
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    // Check if term exists and we haven't confirmed yet
    if (!showConfirmation) {
      setLoading(true);
      try {
        const contents = await api.get("contents/approved").json<any[]>();
        const matches = contents.filter((content) =>
          content.term.toLowerCase() === term.trim().toLowerCase()
        );

        if (matches.length > 0) {
          setExistingTerms(matches);
          setShowConfirmation(true);
          setLoading(false);
          return;
        }
      } catch (err) {
        console.error("Error checking for existing terms:", err);
        // Continue with submission if check fails
      }
      setLoading(false);
    }

    setLoading(true);

    try {
      const me = await getMe();
      const submittedBy = me.email ?? "";
      if (!submittedBy) {
        setError("You must be logged in to submit content.");
        setLoading(false);
        return;
      }

      const payload: ContentPayload = {
        term: term.trim(),
        definition: definition.trim(),
        example: example.trim() ? example.trim() : null,
        submittedBy,
      };

      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      if (!token) {
        setError("You must be logged in.");
        return;
      }

      await api
        .post("contents", {
          json: payload,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
        .json();

      setSuccess("Thanks! Your lingo is now pending review.");
      setTerm("");
      setDefinition("");
      setExample("");
      setExistingTerms([]);
      setShowConfirmation(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Submission failed.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  if (hasAccess === null) {
    return <div className="p-8 text-center">Loading...</div>;
  }

  if (hasAccess === false) {
    return (
      <div className="p-8 text-center text-destructive">
        <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
        <p>Only contributors and moderators can submit content.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-10">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="text-2xl">Add New Item</CardTitle>
          <CardDescription>Share a word, phrase, quiz, or lesson for review.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-6 grid w-full grid-cols-3">
              <TabsTrigger value="term">Add Term</TabsTrigger>
              <TabsTrigger value="quiz">Add Quiz</TabsTrigger>
              <TabsTrigger value="lesson">Add Lesson</TabsTrigger>
            </TabsList>

            <TabsContent value="term">
              {error && (
                <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              )}
              {success && (
                <p className="mb-4 rounded-md bg-green-500/10 px-3 py-2 text-sm text-green-700 dark:text-green-400">
                  {success}
                </p>
              )}
              <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="term">Lingo</Label>
              <Input
                id="term"
                value={term}
                onChange={(event) => {
                  setTerm(event.target.value);
                  setShowConfirmation(false);
                  setExistingTerms([]);
                }}
                placeholder="e.g. rizz"
                maxLength={100}
                required
              />
            </div>

            {existingTerms && existingTerms.length > 0 && showConfirmation && (
              <div className="rounded-md bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-4">
                <h3 className="font-semibold text-yellow-900 dark:text-yellow-200 mb-2">
                  ⚠️ This term already exists!
                </h3>
                <p className="text-sm text-yellow-800 dark:text-yellow-300 mb-3">
                  Found {existingTerms.length} existing {existingTerms.length === 1 ? "definition" : "definitions"} for "{term}":
                </p>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {existingTerms.map((existing) => (
                    <div key={existing.id} className="bg-white dark:bg-gray-800 p-3 rounded border">
                      <p className="text-sm font-medium">{existing.definition}</p>
                      {existing.example && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Example: {existing.example}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-sm text-yellow-800 dark:text-yellow-300 mt-3 font-medium">
                  Click "Yes, Submit Anyway" if you still want to add your definition, or "Cancel" to edit further.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="definition">Definition</Label>
              <Input
                id="definition"
                value={definition}
                onChange={(event) => setDefinition(event.target.value)}
                placeholder="What does it mean?"
                maxLength={500}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="example">Example (optional)</Label>
              <Input
                id="example"
                value={example}
                onChange={(event) => setExample(event.target.value)}
                placeholder="Use it in a sentence"
                maxLength={500}
              />
            </div>
            {showConfirmation ? (
              <div className="flex gap-2">
                <Button type="submit" className="flex-1" disabled={loading}>
                  {loading ? "Submitting..." : "Yes, Submit Anyway"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setShowConfirmation(false);
                    setExistingTerms([]);
                  }}
                  disabled={loading}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Checking..." : "Submit"}
              </Button>
            )}
              </form>
            </TabsContent>

            <TabsContent value="quiz" className="space-y-4">
              <div className="p-8 text-center text-muted-foreground">
                <h2 className="text-xl font-semibold mb-2">Add Quiz</h2>
                <p>The quiz submission feature is coming soon.</p>
              </div>
            </TabsContent>

            <TabsContent value="lesson" className="space-y-4">
              <div className="p-8 text-center text-muted-foreground">
                <h2 className="text-xl font-semibold mb-2">Add Lesson</h2>
                <p>The lesson submission feature is coming soon.</p>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
