import { createFileRoute, Link } from "@tanstack/react-router";
import type { User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import {
  MessageCircle,
  Plus,
  Trash2,
  X,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RoleBadge } from "@/components/role-badge";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/forum")({
  component: ForumPage,
});

/* ── Types ────────────────────────────────────────────────────────────────── */
type Answer = {
  id: number;
  content: string;
  author: string;
  createdAt: string;
};

type Question = {
  id: number;
  title: string;
  content: string;
  author: string;
  createdAt: string;
  answers: Answer[];
};

/** mirrors the spring user entity fields we care about */
type UserProfile = {
  id: string;
  email: string;
  displayName: string | null;
  role: "LEARNER" | "CONTRIBUTOR" | "MODERATOR" | "ADMIN";
};

const API = "http://localhost:8080/api/forum";
const USER_API = "http://localhost:8080/api/users";
const AVATAR_BUCKET = import.meta.env.VITE_SUPABASE_AVATAR_BUCKET?.trim() || "avatars";

type UserMetadata = {
  full_name?: string;
  name?: string;
  avatar_url?: string;
  avatar_path?: string;
};

/* ── Helpers ──────────────────────────────────────────────────────────────── */
function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function getInitials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "U"
  );
}

// deterministic palette of hex colors to match profile styling
const AVATAR_HEX = [
  "#60A5FA",
  "#34D399",
  "#F472B6",
  "#F59E0B",
  "#A78BFA",
  "#475569",
];
function avatarHex(name: string) {
  const s = (name ?? "?").trim();
  if (!s) return AVATAR_HEX[0];
  const code = s.charCodeAt(0);
  return AVATAR_HEX[code % AVATAR_HEX.length];
}

/**
 * returns the best label to display and store as author.
 * prefers displayName; falls back to the email prefix if onboarding isn't done.
 */
function displayLabel(profile: UserProfile | null): string {
  if (!profile) return "Guest";
  return profile.displayName?.trim() || profile.email.split("@")[0];
}

function readMetadata(user: User | null): UserMetadata {
  if (!user || typeof user.user_metadata !== "object" || user.user_metadata === null) {
    return {};
  }
  return user.user_metadata as UserMetadata;
}

/* ── Sub-components ───────────────────────────────────────────────────────── */
function Avatar({
  name,
  imageUrl,
  color,
}: {
  name: string;
  imageUrl?: string | null;
  color?: string | null;
}) {
  const initials = getInitials(name);
  const bg = color ?? avatarHex(name);
  const wrapperStyle = imageUrl ? undefined : { backgroundColor: bg };
  return (
    <span
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full"
      style={wrapperStyle}
    >
      {imageUrl ? (
        <img src={imageUrl} alt={`${name} avatar`} className="h-full w-full object-cover" />
      ) : (
        <span className="inline-flex h-full w-full items-center justify-center text-xs font-bold text-white">
          {initials}
        </span>
      )}
    </span>
  );
}

function AnswerBadge({ count }: { count: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
      <MessageCircle className="size-3" />
      {count} {count === 1 ? "answer" : "answers"}
    </span>
  );
}

/* ── Main Component ───────────────────────────────────────────────────────── */
function ForumPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [currentUserAvatarUrl, setCurrentUserAvatarUrl] = useState<string | null>(null);
  const [currentUserAvatarColor, setCurrentUserAvatarColor] = useState<string | null>(null);

  const [showAskForm, setShowAskForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [posting, setPosting] = useState(false);

  const [answerDraft, setAnswerDraft] = useState<Record<number, string>>({});
  const [postingAnswer, setPostingAnswer] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  /* ── load current user's spring profile ── */
  useEffect(() => {
    const loadProfile = async () => {
      setProfileLoading(true);

      try {
        const { data } = await supabase.auth.getSession();
        const session = data.session;

        if (!session) {
          setProfile(null);
          setCurrentUserAvatarUrl(null);
          return;
        }

        const token = session.access_token;
        const metadata = readMetadata(session.user);

        if (metadata.avatar_path) {
          const { data: signedData, error: signedError } = await supabase.storage
            .from(AVATAR_BUCKET)
            .createSignedUrl(metadata.avatar_path, 60 * 60);
          if (!signedError && signedData?.signedUrl) {
            setCurrentUserAvatarUrl(signedData.signedUrl);
          } else {
            setCurrentUserAvatarUrl(metadata.avatar_url ?? null);
          }
        } else {
          setCurrentUserAvatarUrl(metadata.avatar_url ?? null);
        }
        // capture user-selected avatar color from Supabase user metadata if present
        setCurrentUserAvatarColor((metadata as any)?.avatar_color ?? null);

        const res = await fetch(`${USER_API}/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) throw new Error("Could not load user profile");

        const userProfile: UserProfile = await res.json();
        setProfile(userProfile);
      } catch (err) {
        setProfile(null);
        setCurrentUserAvatarUrl(null);
        console.error("Failed to load profile:", err);
      } finally {
        setProfileLoading(false);
      }
    };

    void loadProfile();
  }, []);

  /* ── fetch questions (answers are embedded — no N+1) ── */
  const fetchQuestions = async () => {
    try {
      const res = await fetch(`${API}/questions`);
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data: Question[] = await res.json();
      setQuestions(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load questions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchQuestions();
  }, []);

  /* ── derived state ── */
  const authorName = displayLabel(profile);
  const onboardingDone = Boolean(profile?.displayName?.trim());
  const canPost = Boolean(profile) && onboardingDone;

  /* ── post question ── */
  const handlePostQuestion = async () => {
    if (!newTitle.trim() || !newContent.trim() || !canPost) return;
    setPosting(true);
    try {
      const res = await fetch(`${API}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          content: newContent.trim(),
          author: authorName,
        }),
      });
      if (!res.ok) throw new Error("Failed to post question");
      setNewTitle("");
      setNewContent("");
      setShowAskForm(false);
      await fetchQuestions();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to post");
    } finally {
      setPosting(false);
    }
  };

  /* ── post answer ── */
  const handlePostAnswer = async (qId: number) => {
    const content = answerDraft[qId]?.trim();
    if (!content || !canPost) return;
    setPostingAnswer(qId);
    try {
      const res = await fetch(`${API}/questions/${qId}/answers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          author: authorName,
        }),
      });
      if (!res.ok) throw new Error("Failed to post answer");
      setAnswerDraft((prev) => ({ ...prev, [qId]: "" }));
      await fetchQuestions();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to post answer");
    } finally {
      setPostingAnswer(null);
    }
  };

  /* ── deletes ── */
  const handleDeleteQuestion = async (qId: number) => {
    if (!confirm("Delete this question and all its answers?")) return;
    await fetch(`${API}/questions/${qId}`, { method: "DELETE" });
    await fetchQuestions();
  };

  const handleDeleteAnswer = async (aId: number) => {
    await fetch(`${API}/answers/${aId}`, { method: "DELETE" });
    await fetchQuestions();
  };

  /* ── render ── */
  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
      {/* page header */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Forum</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Beat the Unc Allegations 💀</p>
        </div>

        <div className="flex items-center gap-3">
          {profileLoading ? (
            <div className="h-8 w-20 animate-pulse rounded-md bg-muted" />
          ) : profile ? (
            <span className="hidden items-center gap-2 text-sm sm:flex">
              <Avatar name={authorName} imageUrl={currentUserAvatarUrl} color={currentUserAvatarColor} />
              <span className="max-w-[140px] truncate font-medium">{authorName}</span>
              <RoleBadge role={profile.role} className="text-muted-foreground" />
            </span>
          ) : null}

          <Button size="sm" onClick={() => setShowAskForm((v) => !v)}>
            <Plus className="size-4" />
            Ask
          </Button>
        </div>
      </div>

      {/* onboarding nudge */}
      {profile && !onboardingDone && (
        <Card className="mb-5 border-chart-4/40 bg-chart-4/5">
          <CardContent className="flex items-center justify-between gap-3 text-sm">
            <span>
              👋 You need a <strong>display name</strong> before you can post.
            </span>
            <Button variant="outline" size="sm" asChild>
              <Link to="/profile">Complete profile →</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* error banner */}
      {error && (
        <Card className="mb-5 border-destructive/40 bg-destructive/5">
          <CardContent className="flex items-center justify-between gap-3 text-sm text-destructive">
            <span className="flex items-center gap-2">
              <AlertTriangle className="size-4 shrink-0" />
              {error}
            </span>
            <Button variant="ghost" size="icon-xs" onClick={() => setError(null)}>
              <X className="size-3.5" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ask form */}
      {showAskForm && (
        <Card className="mb-5 border-primary/20">
          <CardContent className="space-y-3">
            <h2 className="font-bold text-primary">New Question</h2>

            {!profile && (
              <p className="rounded-lg border border-chart-4/30 bg-chart-4/10 px-3 py-2 text-sm text-chart-4">
                You must be{" "}
                <Link to="/login" className="font-medium underline hover:opacity-80">
                  logged in
                </Link>{" "}
                to post.
              </p>
            )}

            {profile && !onboardingDone && (
              <p className="rounded-lg border border-chart-4/30 bg-chart-4/10 px-3 py-2 text-sm text-chart-4">
                Please{" "}
                <Link to="/profile" className="underline">
                  set a display name
                </Link>{" "}
                before posting.
              </p>
            )}

            <Input
              placeholder="What's your question?"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              maxLength={160}
              disabled={!canPost}
            />
            <textarea
              className="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 w-full min-w-0 resize-none rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50 dark:bg-input/30"
              placeholder="Provide details or context about your question"
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              rows={3}
              disabled={!canPost}
            />

            {canPost && (
              <p className="text-xs text-muted-foreground">
                Posting as <span className="font-semibold text-foreground">{authorName}</span>
              </p>
            )}

            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowAskForm(false);
                  setNewTitle("");
                  setNewContent("");
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handlePostQuestion}
                disabled={posting || !newTitle.trim() || !newContent.trim() || !canPost}
              >
                {posting ? "Posting…" : "Post Question"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* loading skeleton */}
      {loading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="space-y-3">
                <div className="h-4 w-3/4 rounded bg-muted" />
                <div className="h-3 w-full rounded bg-muted" />
                <div className="h-3 w-1/2 rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* empty state */}
      {!loading && questions.length === 0 && (
        <div className="py-20 text-center">
          <p className="mb-4 text-5xl">🤔</p>
          <p className="text-lg font-semibold">No questions yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Be the first to ask something bussin!
          </p>
        </div>
      )}

      {/* question cards */}
      {!loading && (
        <div className="space-y-4">
          {questions.map((q) => {
            const isExpanded = expandedId === q.id;
            const isOwner = canPost && q.author === authorName;

            return (
              <Card
                key={q.id}
                className="overflow-hidden transition-colors hover:border-primary/30"
              >
                <CardContent className="pb-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-base font-bold leading-snug">{q.title}</h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                        {q.content}
                      </p>
                    </div>
                    {isOwner && (
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => handleDeleteQuestion(q.id)}
                        title="Delete question"
                        className="shrink-0 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-3 pb-4">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Avatar
                        name={q.author}
                        imageUrl={q.author === authorName ? currentUserAvatarUrl : null}
                        color={q.author === authorName ? currentUserAvatarColor : undefined}
                      />
                      <span className="font-medium">{q.author}</span>
                    </div>
                    <span className="text-xs text-muted-foreground/60">{timeAgo(q.createdAt)}</span>
                    <AnswerBadge count={q.answers?.length ?? 0} />
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : q.id)}
                      className="ml-auto flex items-center gap-1 text-xs font-medium text-primary transition-colors hover:text-primary/80"
                    >
                      {isExpanded ? (
                        <>
                          Hide answers <ChevronUp className="size-3.5" />
                        </>
                      ) : (
                        <>
                          View answers <ChevronDown className="size-3.5" />
                        </>
                      )}
                    </button>
                  </div>
                </CardContent>

                {isExpanded && (
                  <div className="border-t bg-muted/30 px-6 py-4 space-y-4">
                    {(q.answers?.length ?? 0) === 0 ? (
                      <p className="text-sm italic text-muted-foreground">
                        This thread needs a lore drop immediately
                      </p>
                    ) : (
                      <ul className="space-y-3">
                        {q.answers.map((a) => (
                          <li key={a.id} className="group flex gap-3">
                            <Avatar
                              name={a.author}
                              imageUrl={a.author === authorName ? currentUserAvatarUrl : null}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold">{a.author}</span>
                                <span className="text-xs text-muted-foreground/60">
                                  {timeAgo(a.createdAt)}
                                </span>
                                {canPost && a.author === authorName && (
                                  <button
                                    onClick={() => handleDeleteAnswer(a.id)}
                                    className="ml-auto hidden text-muted-foreground transition-colors hover:text-destructive group-hover:block"
                                    title="Delete answer"
                                  >
                                    <X className="size-3.5" />
                                  </button>
                                )}
                              </div>
                              <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                                {a.content}
                              </p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}

                    {canPost ? (
                      <div className="flex gap-2 pt-1">
                        <Input
                          placeholder="Go ahead and cook…"
                          value={answerDraft[q.id] ?? ""}
                          onChange={(e) =>
                            setAnswerDraft((prev) => ({ ...prev, [q.id]: e.target.value }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              void handlePostAnswer(q.id);
                            }
                          }}
                          className="flex-1"
                        />
                        <Button
                          size="sm"
                          onClick={() => handlePostAnswer(q.id)}
                          disabled={postingAnswer === q.id || !answerDraft[q.id]?.trim()}
                        >
                          {postingAnswer === q.id ? "…" : "Post"}
                        </Button>
                      </div>
                    ) : profile && !onboardingDone ? (
                      <p className="text-xs italic text-chart-4">
                        <Link to="/profile" className="underline">
                          Set a display name
                        </Link>{" "}
                        to post answers.
                      </p>
                    ) : (
                      <p className="text-xs italic text-muted-foreground">
                        Log in to post an answer.
                      </p>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
