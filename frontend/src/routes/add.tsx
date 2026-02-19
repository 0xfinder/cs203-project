import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { requireAuth, useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface ContentPayload {
    term: string;
    definition: string;
    example?: string | null;
    submittedBy: string;
}

export const Route = createFileRoute("/add")({
    beforeLoad: requireAuth,
    component: SubmitContentPage,
});

function SubmitContentPage() {
    const { user } = useAuth();
    const [term, setTerm] = useState("");
    const [definition, setDefinition] = useState("");
    const [example, setExample] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError(null);
        setSuccess(null);
        setLoading(true);

        try {
            const submittedBy = user?.email ?? "";
            if (!submittedBy) {
                setError("You must be logged in to submit content.");
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

            await api.post("contents/submit", {
                json: payload,
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            }).json();

            setSuccess("Thanks! Your term is now pending review.");
            setTerm("");
            setDefinition("");
            setExample("");
        } catch (err) {
            const message = err instanceof Error ? err.message : "Submission failed.";
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-1 items-center justify-center px-4 py-10">
            <Card className="w-full max-w-lg">
                <CardHeader>
                    <CardTitle className="text-2xl">Add a new Lingo</CardTitle>
                    <CardDescription>Share a word or phrase for review.</CardDescription>
                </CardHeader>
                <CardContent>
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
                                onChange={(event) => setTerm(event.target.value)}
                                placeholder="e.g. rizz"
                                maxLength={100}
                                required
                            />
                        </div>
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
                        <Button type="submit" className="w-full" disabled={loading}>
                            {loading ? "Submitting…" : "Submit"}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
