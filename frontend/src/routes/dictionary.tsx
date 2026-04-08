import { createFileRoute, Link } from "@tanstack/react-router";
import { memo, useCallback, useDeferredValue, useMemo, useState } from "react";
import { Search, BookOpen, Quote, Sparkles, ThumbsDown, ThumbsUp, Trash } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  useApprovedContentsWithVotes,
  useCastContentVote,
  useClearContentVote,
  useDeleteContent,
  type ContentVoteType,
  type ContentWithVotesResponse,
} from "@/features/content/useContentData";
import { cn } from "@/lib/utils";
import { AppPageShell } from "@/components/app-page-shell";
import { optionalCurrentUserViewQueryOptions } from "@/lib/current-user-view";

export const Route = createFileRoute("/dictionary")({
  component: DictionaryPage,
});

/* ── helpers ── */
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ#".split("");

interface TermGroup {
  term: string;
  letter: string;
  searchText: string;
  entries: ContentWithVotesResponse[];
}

interface LetterSection {
  letter: string;
  groups: TermGroup[];
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
    const trimmedTerm = item.content.term.trim();
    const normalizedTerm = normalizeTerm(trimmedTerm);
    const key = normalizedTerm;
    const existing = groups.get(key);
    if (existing) {
      existing.entries.push(item);
      existing.searchText += `\n${item.content.definition.toLowerCase()}\n${item.content.example?.toLowerCase() ?? ""}`;
    } else {
      groups.set(key, {
        term: trimmedTerm,
        letter: letterKey(trimmedTerm),
        searchText: `${normalizedTerm}\n${item.content.definition.toLowerCase()}\n${item.content.example?.toLowerCase() ?? ""}`,
        entries: [item],
      });
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
    (grouped[group.letter] ??= []).push(group);
  }
  for (const key of Object.keys(grouped)) {
    grouped[key].sort((a, b) => a.term.localeCompare(b.term));
  }
  return grouped;
}

const AlphabetRail = memo(function AlphabetRail({
  activeLetter,
  availableLetterSet,
  onLetterSelect,
}: {
  activeLetter: string | null;
  availableLetterSet: Set<string>;
  onLetterSelect: (letter: string) => void;
}) {
  return (
    <div className="mb-6 flex flex-wrap gap-1">
      {ALPHABET.map((letter) => {
        const hasContent = availableLetterSet.has(letter);
        return (
          <button
            key={letter}
            onClick={() => hasContent && onLetterSelect(letter)}
            disabled={!hasContent}
            className={cn(
              "flex size-8 items-center justify-center rounded-lg text-xs font-bold transition-colors",
              hasContent && activeLetter === letter
                ? "bg-primary text-primary-foreground"
                : hasContent
                  ? "bg-secondary text-secondary-foreground hover:bg-accent"
                  : "cursor-default text-muted-foreground/30",
            )}
          >
            {letter}
          </button>
        );
      })}
    </div>
  );
});

const DictionaryEntryCard = memo(function DictionaryEntryCard({
  entry,
  canVote,
  isAdmin,
  votePendingContentId,
  deletePendingId,
  onVote,
  onDelete,
}: {
  entry: ContentWithVotesResponse;
  canVote: boolean;
  isAdmin: boolean;
  votePendingContentId: number | null;
  deletePendingId: number | null;
  onVote: (entry: ContentWithVotesResponse, voteType: ContentVoteType) => void;
  onDelete: (entry: ContentWithVotesResponse) => Promise<void>;
}) {
  const userVote = entry.userVote;
  const voteBusy = !canVote || votePendingContentId === entry.content.id;
  const deleteBusy = deletePendingId === entry.content.id;

  return (
    <div className="space-y-2 rounded-lg border border-border/60 bg-background/60 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Badge variant="secondary" className="shrink-0 capitalize">
          {entry.submittedByDisplayName}
        </Badge>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant={userVote === "THUMBS_UP" ? "secondary" : "ghost"}
            size="xs"
            onClick={() => onVote(entry, "THUMBS_UP")}
            disabled={voteBusy}
            className="gap-1"
            title={canVote ? "Vote helpful" : "Log in to vote"}
          >
            <ThumbsUp className="size-3" />
            <span>{entry.thumbsUp}</span>
          </Button>
          <Button
            type="button"
            variant={userVote === "THUMBS_DOWN" ? "secondary" : "ghost"}
            size="xs"
            onClick={() => onVote(entry, "THUMBS_DOWN")}
            disabled={voteBusy}
            className="gap-1"
            title={canVote ? "Vote unhelpful" : "Log in to vote"}
          >
            <ThumbsDown className="size-3" />
            <span>{entry.thumbsDown}</span>
          </Button>
          {isAdmin ? (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => void onDelete(entry)}
              disabled={deleteBusy}
              className="ml-2"
              aria-label={`Delete ${entry.content.term}`}
              title="Delete"
            >
              <Trash className="size-3" />
            </Button>
          ) : null}
        </div>
      </div>

      <p className="text-sm leading-relaxed text-muted-foreground">{entry.content.definition}</p>

      {entry.content.example ? (
        <div className="flex gap-2 rounded-lg bg-muted/50 px-3 py-2">
          <Quote className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/60" />
          <p className="text-sm italic text-muted-foreground">{entry.content.example}</p>
        </div>
      ) : null}
    </div>
  );
});

const DictionaryTermCard = memo(function DictionaryTermCard({
  group,
  canVote,
  isAdmin,
  votePendingContentId,
  deletePendingId,
  onVote,
  onDelete,
}: {
  group: TermGroup;
  canVote: boolean;
  isAdmin: boolean;
  votePendingContentId: number | null;
  deletePendingId: number | null;
  onVote: (entry: ContentWithVotesResponse, voteType: ContentVoteType) => void;
  onDelete: (entry: ContentWithVotesResponse) => Promise<void>;
}) {
  return (
    <Card className="transition-colors hover:border-primary/20">
      <CardContent className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-bold leading-tight">{group.term}</h3>
          <Badge variant="secondary" className="shrink-0">
            {group.entries.length} {group.entries.length === 1 ? "definition" : "definitions"}
          </Badge>
        </div>

        <div className="space-y-3">
          {group.entries.map((entry) => (
            <DictionaryEntryCard
              key={entry.content.id}
              entry={entry}
              canVote={canVote}
              isAdmin={isAdmin}
              votePendingContentId={votePendingContentId}
              deletePendingId={deletePendingId}
              onVote={onVote}
              onDelete={onDelete}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
});

const DictionaryLetterSection = memo(function DictionaryLetterSection({
  section,
  canVote,
  isAdmin,
  votePendingContentId,
  deletePendingId,
  onVote,
  onDelete,
}: {
  section: LetterSection;
  canVote: boolean;
  isAdmin: boolean;
  votePendingContentId: number | null;
  deletePendingId: number | null;
  onVote: (entry: ContentWithVotesResponse, voteType: ContentVoteType) => void;
  onDelete: (entry: ContentWithVotesResponse) => Promise<void>;
}) {
  return (
    <section id={`letter-${section.letter}`} className="mb-8">
      <div className="sticky top-0 z-10 mb-3 flex items-center gap-2 bg-background/95 py-2 backdrop-blur-sm">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
          {section.letter}
        </span>
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">
          {section.groups.length} {section.groups.length === 1 ? "term" : "terms"}
        </span>
      </div>

      <div className="space-y-3">
        {section.groups.map((group) => (
          <DictionaryTermCard
            key={group.term}
            group={group}
            canVote={canVote}
            isAdmin={isAdmin}
            votePendingContentId={votePendingContentId}
            deletePendingId={deletePendingId}
            onVote={onVote}
            onDelete={onDelete}
          />
        ))}
      </div>
    </section>
  );
});

function DictionaryPage() {
  const currentUserViewQuery = useQuery(optionalCurrentUserViewQueryOptions());
  const { data: contents, isLoading, error } = useApprovedContentsWithVotes();
  const castVote = useCastContentVote();
  const clearVote = useClearContentVote();
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [activeLetter, setActiveLetter] = useState<string | null>(null);
  const [votePendingContentId, setVotePendingContentId] = useState<number | null>(null);
  const [deletePendingId, setDeletePendingId] = useState<number | null>(null);

  const termGroups = useMemo(() => (contents ? buildTermGroups(contents) : []), [contents]);
  const deleteMutation = useDeleteContent();
  const profile = currentUserViewQuery.data?.profile ?? null;
  const isAdmin = profile?.role === "ADMIN" || profile?.role === "MODERATOR";
  const canVote = Boolean(profile);

  const filteredGroups = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    if (!q) return termGroups;
    return termGroups.filter((group) => group.searchText.includes(q));
  }, [deferredSearch, termGroups]);

  const grouped = useMemo(() => groupByLetter(filteredGroups), [filteredGroups]);

  const letterSections = useMemo(() => {
    return ALPHABET.flatMap((letter) => {
      const groups = grouped[letter];
      return groups ? [{ letter, groups }] : [];
    });
  }, [grouped]);

  const availableLetterSet = useMemo(
    () => new Set(letterSections.map((section) => section.letter)),
    [letterSections],
  );

  const scrollToLetter = useCallback((letter: string) => {
    setActiveLetter(letter);
    const el = document.getElementById(`letter-${letter}`);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const handleVote = useCallback(
    (entry: ContentWithVotesResponse, voteType: ContentVoteType) => {
      if (!canVote) return;

      setVotePendingContentId(entry.content.id);
      const mutation =
        entry.userVote === voteType
          ? clearVote.mutateAsync({ contentId: entry.content.id })
          : castVote.mutateAsync({ contentId: entry.content.id, voteType });

      void mutation.finally(() => {
        setVotePendingContentId((current) => (current === entry.content.id ? null : current));
      });
    },
    [canVote, castVote, clearVote],
  );

  const handleDelete = useCallback(
    async (entry: ContentWithVotesResponse) => {
      if (
        !confirm(`Delete "${entry.content.term}" definition by ${entry.submittedByDisplayName}?`)
      ) {
        return;
      }

      try {
        setDeletePendingId(entry.content.id);
        await deleteMutation.mutateAsync({ id: entry.content.id });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        alert(`Failed to delete: ${msg}`);
      } finally {
        setDeletePendingId((current) => (current === entry.content.id ? null : current));
      }
    },
    [deleteMutation],
  );

  return (
    <AppPageShell contentClassName="max-w-3xl">
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

      {!profile && (
        <Card className="mb-6 border-primary/20 bg-primary/5">
          <CardContent className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <span className="text-muted-foreground">
              Browse the public dictionary now, then{" "}
              <span className="font-semibold text-foreground">log in to vote or contribute</span>.
            </span>
            <Button asChild size="sm" variant="outline" className="shrink-0">
              <Link to="/login">Log in</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* search bar + stats */}
      <div className="mb-6 space-y-3">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search terms, definitions, or examples…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-11 rounded-xl border-primary/30 bg-card pl-9 shadow-sm focus-visible:border-primary/50"
            />
          </div>
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

      {/* alphabet rail */}
      {!isLoading && availableLetterSet.size > 0 && (
        <AlphabetRail
          activeLetter={activeLetter}
          availableLetterSet={availableLetterSet}
          onLetterSelect={scrollToLetter}
        />
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
        letterSections.map((section) => (
          <DictionaryLetterSection
            key={section.letter}
            section={section}
            canVote={canVote}
            isAdmin={isAdmin}
            votePendingContentId={votePendingContentId}
            deletePendingId={deletePendingId}
            onVote={handleVote}
            onDelete={handleDelete}
          />
        ))}
    </AppPageShell>
  );
}
