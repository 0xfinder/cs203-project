import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { Search, BookOpen, Quote, Sparkles, ThumbsDown, ThumbsUp, Trash, Plus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  useApprovedContentsWithVotes,
  useCastContentVote,
  useClearContentVote,
  useDeleteContent,
  type ContentVoteType,
  type ContentWithVotesResponse,
} from "@/features/content/useContentData";
import { requireOnboardingCompleted } from "@/lib/auth";
import { getMe } from "@/lib/me";
import { api } from "@/lib/api";
import Dialog, { DialogTrigger, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dictionary")({
  beforeLoad: requireOnboardingCompleted,
  component: DictionaryPage,
});

/* ── helpers ── */
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ#".split("");

interface TermGroup {
  term: string;
  entries: ContentWithVotesResponse[];
}

function letterKey(term: string): string {
  const first = term.trim().charAt(0).toUpperCase();
  return /[A-Z]/.test(first) ? first : "#";
}

function normalizeTerm(term: string): string {
  return term.trim().toLowerCase();
}

function buildTermGroups(items: ContentWithVotesResponse[]): TermGroup[] {
  const groups = new Map<string, TermGroup>();

  for (const item of items) {
    const key = normalizeTerm(item.content.term);
    const existing = groups.get(key);
    if (existing) {
      existing.entries.push(item);
    } else {
      groups.set(key, { term: item.content.term.trim(), entries: [item] });
    }
  }

  // exclude any unwanted terms (e.g. 'test') from the public dictionary
  return Array.from(groups.values())
    .filter((g) => normalizeTerm(g.term) !== "test")
    .sort((a, b) => a.term.localeCompare(b.term));
}

function groupByLetter(groups: TermGroup[]): Record<string, TermGroup[]> {
  const grouped: Record<string, TermGroup[]> = {};
  for (const group of groups) {
    const key = letterKey(group.term);
    (grouped[key] ??= []).push(group);
  }
  for (const key of Object.keys(grouped)) {
    grouped[key].sort((a, b) => a.term.localeCompare(b.term));
  }
  return grouped;
}

function DictionaryPage() {
  const queryClient = useQueryClient();
  const { data: contents, isLoading, error } = useApprovedContentsWithVotes();
  const castVote = useCastContentVote();
  const clearVote = useClearContentVote();
  const [search, setSearch] = useState("");
  const [activeLetter, setActiveLetter] = useState<string | null>(null);

  const termGroups = useMemo(() => (contents ? buildTermGroups(contents) : []), [contents]);
  const deleteMutation = useDeleteContent();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isContributor, setIsContributor] = useState(false);

  useEffect(() => {
    let mounted = true;
    import("@/lib/me").then(({ getMe }) => {
      void getMe()
        .then((me) => {
          if (!mounted) return;
          setIsAdmin(me.role === "ADMIN" || me.role === "MODERATOR");
          setIsContributor(
            me.role === "CONTRIBUTOR" || me.role === "ADMIN" || me.role === "MODERATOR",
          );
        })
        .catch(() => {
          /* ignore */
        });
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Add lingo form state (contributors only)
  const [termInput, setTermInput] = useState("");
  const [defInput, setDefInput] = useState("");
  const [exampleInput, setExampleInput] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleLingoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(null);
    setSubmitLoading(true);
    try {
      const me = await getMe();
      const payload = {
        term: termInput.trim(),
        definition: defInput.trim(),
        example: exampleInput.trim() || null,
        submittedBy: me.email ?? "",
      };
      await api.post("contents", { json: payload }).json();
      await queryClient.invalidateQueries({ queryKey: ["contents", "approved-with-votes"] });
      await queryClient.invalidateQueries({ queryKey: ["contents"] });
      setSubmitSuccess(
        me.role === "ADMIN" || me.role === "MODERATOR"
          ? "Added and live."
          : "Submitted — pending review.",
      );
      setTermInput("");
      setDefInput("");
      setExampleInput("");
    } catch (err) {
      console.error(err);
      setSubmitError("Failed to submit term.");
    } finally {
      setSubmitLoading(false);
    }
  };

  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return termGroups;
    return termGroups.filter((group) => {
      if (group.term.toLowerCase().includes(q)) return true;
      return group.entries.some((entry) => {
        const definitionMatch = entry.content.definition.toLowerCase().includes(q);
        const exampleMatch = entry.content.example?.toLowerCase().includes(q);
        return definitionMatch || exampleMatch;
      });
    });
  }, [termGroups, search]);

  const grouped = useMemo(() => groupByLetter(filteredGroups), [filteredGroups]);

  // letters that actually have content
  const availableLetters = useMemo(() => {
    const set = new Set(Object.keys(grouped));
    return ALPHABET.filter((l) => set.has(l));
  }, [grouped]);

  const scrollToLetter = (letter: string) => {
    setActiveLetter(letter);
    const el = document.getElementById(`letter-${letter}`);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
      {/* page header */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
            <BookOpen className="size-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Dictionary</h1>
            <p className="text-sm text-muted-foreground">
              Every approved Gen Alpha term in one place
            </p>
          </div>
        </div>
      </div>

      {/* search bar + stats */}
      <div className="mb-6 space-y-3">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search terms, definitions, or examples…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {isContributor && (
            <Dialog>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full px-3 shadow-sm flex items-center gap-2 text-primary border-primary/20"
                >
                  <Plus className="size-3" />
                  Add Lingo
                </Button>
              </DialogTrigger>
              <DialogContent
                title="Add Lingo"
                description="Submit a new dictionary term for review"
              >
                <form onSubmit={handleLingoSubmit} className="space-y-3">
                  <div>
                    <Label htmlFor="dict-term">Term</Label>
                    <Input
                      id="dict-term"
                      name="term"
                      value={termInput}
                      onChange={(e) => setTermInput(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="dict-definition">Definition</Label>
                    <Input
                      id="dict-definition"
                      name="definition"
                      value={defInput}
                      onChange={(e) => setDefInput(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="dict-example">Example (optional)</Label>
                    <Input
                      id="dict-example"
                      name="example"
                      value={exampleInput}
                      onChange={(e) => setExampleInput(e.target.value)}
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      disabled={submitLoading || !termInput.trim() || !defInput.trim()}
                    >
                      {submitLoading ? "Submitting…" : "Submit"}
                    </Button>
                  </div>
                  {submitSuccess && <p className="text-sm text-green-600">{submitSuccess}</p>}
                  {submitError && <p className="text-sm text-destructive">{submitError}</p>}
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {!isLoading && contents && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="size-3.5" />
            <span>
              {filteredGroups.length} {filteredGroups.length === 1 ? "term" : "terms"}
              {search && ` matching "${search}"`}
            </span>
          </div>
        )}
      </div>

      {/* (Add Lingo is available in the search bar for contributors) */}

      {/* alphabet rail */}
      {!isLoading && availableLetters.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-1">
          {ALPHABET.map((letter) => {
            const hasContent = availableLetters.includes(letter);
            return (
              <button
                key={letter}
                onClick={() => hasContent && scrollToLetter(letter)}
                disabled={!hasContent}
                className={cn(
                  "flex size-8 items-center justify-center rounded-lg text-xs font-bold transition-colors",
                  hasContent && activeLetter === letter
                    ? "bg-primary text-primary-foreground"
                    : hasContent
                      ? "bg-secondary text-secondary-foreground hover:bg-accent"
                      : "text-muted-foreground/30 cursor-default",
                )}
              >
                {letter}
              </button>
            );
          })}
        </div>
      )}

      {/* loading skeleton */}
      {isLoading && (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="space-y-3">
                <div className="h-5 w-1/3 rounded bg-muted" />
                <div className="h-3 w-full rounded bg-muted" />
                <div className="h-3 w-2/3 rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* error state */}
      {error && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="text-sm text-destructive">
            Failed to load dictionary: {error.message}
          </CardContent>
        </Card>
      )}

      {/* empty state */}
      {!isLoading && !error && filteredGroups.length === 0 && (
        <div className="py-20 text-center">
          <p className="mb-3 text-4xl">📖</p>
          {search ? (
            <>
              <p className="text-lg font-semibold">No matches found</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Try a different search or clear the filter
              </p>
            </>
          ) : (
            <>
              <p className="text-lg font-semibold">Dictionary is empty</p>
              <p className="mt-1 text-sm text-muted-foreground">
                No approved terms yet — submit some lingo!
              </p>
            </>
          )}
        </div>
      )}

      {/* grouped term cards */}
      {!isLoading &&
        !error &&
        ALPHABET.filter((l) => grouped[l]).map((letter) => (
          <section key={letter} id={`letter-${letter}`} className="mb-8">
            <div className="sticky top-0 z-10 mb-3 flex items-center gap-2 bg-background/95 py-2 backdrop-blur-sm">
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
                {letter}
              </span>
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">
                {grouped[letter].length} {grouped[letter].length === 1 ? "term" : "terms"}
              </span>
            </div>

            <div className="space-y-3">
              {grouped[letter].map((group) => (
                <Card key={group.term} className="transition-colors hover:border-primary/20">
                  <CardContent className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-lg font-bold leading-tight">{group.term}</h3>
                      <Badge variant="secondary" className="shrink-0">
                        {group.entries.length}{" "}
                        {group.entries.length === 1 ? "definition" : "definitions"}
                      </Badge>
                    </div>

                    <div className="space-y-3">
                      {group.entries.map((entry) => {
                        const userVote = entry.userVote;
                        const voteBusy = castVote.isPending || clearVote.isPending;

                        const handleVote = (voteType: ContentVoteType) => {
                          if (userVote === voteType) {
                            clearVote.mutate({ contentId: entry.content.id });
                          } else {
                            castVote.mutate({ contentId: entry.content.id, voteType });
                          }
                        };

                        return (
                          <div
                            key={entry.content.id}
                            className="space-y-2 rounded-lg border border-border/60 bg-background/60 p-3"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <Badge variant="secondary" className="shrink-0 capitalize">
                                {entry.submittedByDisplayName}
                              </Badge>
                              <div className="flex items-center gap-1">
                                <Button
                                  type="button"
                                  variant={userVote === "THUMBS_UP" ? "secondary" : "ghost"}
                                  size="xs"
                                  onClick={() => handleVote("THUMBS_UP")}
                                  disabled={voteBusy}
                                  className="gap-1"
                                >
                                  <ThumbsUp className="size-3" />
                                  <span>{entry.thumbsUp}</span>
                                </Button>
                                <Button
                                  type="button"
                                  variant={userVote === "THUMBS_DOWN" ? "secondary" : "ghost"}
                                  size="xs"
                                  onClick={() => handleVote("THUMBS_DOWN")}
                                  disabled={voteBusy}
                                  className="gap-1"
                                >
                                  <ThumbsDown className="size-3" />
                                  <span>{entry.thumbsDown}</span>
                                </Button>
                                {isAdmin && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="xs"
                                    onClick={async () => {
                                      if (
                                        !confirm(
                                          `Delete "${entry.content.term}" definition by ${entry.submittedByDisplayName}?`,
                                        )
                                      )
                                        return;
                                      try {
                                        await deleteMutation.mutateAsync({ id: entry.content.id });
                                      } catch (err) {
                                        const msg =
                                          err instanceof Error ? err.message : String(err);
                                        alert(`Failed to delete: ${msg}`);
                                      }
                                    }}
                                    className="ml-2"
                                    aria-label={`Delete ${entry.content.term}`}
                                    title="Delete"
                                  >
                                    <Trash className="size-3" />
                                  </Button>
                                )}
                              </div>
                            </div>

                            <p className="text-sm leading-relaxed text-muted-foreground">
                              {entry.content.definition}
                            </p>

                            {entry.content.example && (
                              <div className="flex gap-2 rounded-lg bg-muted/50 px-3 py-2">
                                <Quote className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/60" />
                                <p className="text-sm italic text-muted-foreground">
                                  {entry.content.example}
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        ))}
    </div>
  );
}
