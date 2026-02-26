import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, BookOpen, Quote, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useContents, type ContentItem } from "@/features/content/useContentData";
import { requireOnboardingCompleted } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/course")({
  beforeLoad: requireOnboardingCompleted,
  component: DictionaryPage,
});

/* ── helpers ── */
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ#".split("");

function letterKey(term: string): string {
  const first = term.trim().charAt(0).toUpperCase();
  return /[A-Z]/.test(first) ? first : "#";
}

function groupByLetter(items: ContentItem[]): Record<string, ContentItem[]> {
  const groups: Record<string, ContentItem[]> = {};
  for (const item of items) {
    const key = letterKey(item.term);
    (groups[key] ??= []).push(item);
  }
  // sort terms within each group
  for (const key of Object.keys(groups)) {
    groups[key].sort((a, b) => a.term.localeCompare(b.term));
  }
  return groups;
}

function DictionaryPage() {
  const { data: contents, isLoading, error } = useContents();
  const [search, setSearch] = useState("");
  const [activeLetter, setActiveLetter] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!contents) return [];
    const q = search.trim().toLowerCase();
    if (!q) return contents;
    return contents.filter(
      (c) =>
        c.term.toLowerCase().includes(q) ||
        c.definition.toLowerCase().includes(q) ||
        c.example?.toLowerCase().includes(q),
    );
  }, [contents, search]);

  const grouped = useMemo(() => groupByLetter(filtered), [filtered]);

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
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search terms, definitions, or examples…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {!isLoading && contents && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="size-3.5" />
            <span>
              {filtered.length} {filtered.length === 1 ? "term" : "terms"}
              {search && ` matching "${search}"`}
            </span>
          </div>
        )}
      </div>

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
      {!isLoading && !error && filtered.length === 0 && (
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
              {grouped[letter].map((item) => (
                <Card key={item.id} className="transition-colors hover:border-primary/20">
                  <CardContent className="space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-lg font-bold leading-tight">{item.term}</h3>
                      <Badge variant="secondary" className="shrink-0 capitalize">
                        {item.submittedBy.split("@")[0]}
                      </Badge>
                    </div>

                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {item.definition}
                    </p>

                    {item.example && (
                      <div className="flex gap-2 rounded-lg bg-muted/50 px-3 py-2">
                        <Quote className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/60" />
                        <p className="text-sm italic text-muted-foreground">{item.example}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        ))}
    </div>
  );
}
