import { createFileRoute, Link } from "@tanstack/react-router";
import type { User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

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

/** Mirrors the Spring User entity fields we care about */
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

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

const COLORS = [
  "bg-violet-500",
  "bg-pink-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-sky-500",
  "bg-rose-500",
];
function avatarColor(name: string) {
  const n = (name ?? "?").charCodeAt(0);
  return COLORS[n % COLORS.length];
}

/**
 * Returns the best label to display and store as author.
 * Prefers displayName; falls back to the email prefix if onboarding isn't done.
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
function Avatar({ name, imageUrl }: { name: string; imageUrl?: string | null }) {
  return (
    <span className="inline-flex w-7 h-7 shrink-0 items-center justify-center overflow-hidden rounded-full">
      {imageUrl ? (
        <img src={imageUrl} alt={`${name} avatar`} className="h-full w-full object-cover" />
      ) : (
        <span
          className={`inline-flex h-full w-full items-center justify-center text-xs font-bold text-white ${avatarColor(name)}`}
        >
          {initials(name)}
        </span>
      )}
    </span>
  );
}

function Badge({ count }: { count: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium bg-violet-100 text-violet-700 rounded-full px-2 py-0.5">
      <svg
        className="w-3 h-3"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-4 4z"
        />
      </svg>
      {count} {count === 1 ? "answer" : "answers"}
    </span>
  );
}

/* ── Main Component ───────────────────────────────────────────────────────── */
function ForumPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Full profile from the Spring backend
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [currentUserAvatarUrl, setCurrentUserAvatarUrl] = useState<string | null>(null);

  // Ask form
  const [showAskForm, setShowAskForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [posting, setPosting] = useState(false);

  // Answer inputs
  const [answerDraft, setAnswerDraft] = useState<Record<number, string>>({});
  const [postingAnswer, setPostingAnswer] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  /* ── Load current user's Spring profile ─────────────────────────────────── */
  /* ── Load current user's Spring profile ── */
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

  /* ── Fetch questions (answers are embedded — no N+1) ─────────────────── */
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

  /* ── Derived state ──────────────────────────────────────────────────────── */
  // The name that gets written into `author` on every post
  const authorName = displayLabel(profile);
  // isOnboardingCompleted() logic mirrors the backend: displayName must be non-blank
  const onboardingDone = Boolean(profile?.displayName?.trim());
  // User can only post if they're logged in AND have a display name set
  const canPost = Boolean(profile) && onboardingDone;

  /* ── Post question ──────────────────────────────────────────────────────── */
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
          author: authorName, // ← display name, not email
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

  /* ── Post answer ────────────────────────────────────────────────────────── */
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
          author: authorName, // ← display name, not email
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

  /* ── Deletes ─────────────────────────────────────────────────────────────  */
  const handleDeleteQuestion = async (qId: number) => {
    if (!confirm("Delete this question and all its answers?")) return;
    await fetch(`${API}/questions/${qId}`, { method: "DELETE" });
    await fetchQuestions();
  };

  const handleDeleteAnswer = async (aId: number) => {
    await fetch(`${API}/answers/${aId}`, { method: "DELETE" });
    await fetchQuestions();
  };

  /* ── Render ─────────────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-violet-950 to-slate-900 text-slate-100">
      {/* ── Header ── */}
      <header className="sticky top-0 z-20 backdrop-blur-md bg-slate-950/70 border-b border-white/10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-extrabold tracking-tight">
              <span className="text-violet-400">Alpha</span> Lingo
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">Beat the Unc Allegations 💀</p>
          </div>

          <div className="flex items-center gap-3">
            {profileLoading ? (
              <div className="h-7 w-28 bg-slate-800 rounded-full animate-pulse" />
            ) : profile ? (
              <span className="hidden sm:flex items-center gap-2 text-sm">
                <Avatar name={authorName} imageUrl={currentUserAvatarUrl} />
                <span className="max-w-[140px] truncate font-medium text-slate-300">
                  {authorName}
                </span>
                <span className="text-xs bg-slate-800 border border-white/10 text-slate-400 rounded-full px-2 py-0.5 capitalize">
                  {profile.role.toLowerCase()}
                </span>
              </span>
            ) : null}

            <button
              onClick={() => setShowAskForm((v) => !v)}
              className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-500 active:scale-95 transition-all text-white text-sm font-semibold px-4 py-2 rounded-full shadow-lg shadow-violet-900/50"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Ask
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        {/* ── Onboarding nudge ── */}
        {profile && !onboardingDone && (
          <div className="bg-amber-900/30 border border-amber-500/40 text-amber-300 text-sm px-4 py-3 rounded-xl flex items-center justify-between gap-3">
            <span>
              👋 You need a <strong>display name</strong> before you can post.
            </span>
            <a
              href="/profile"
              className="shrink-0 text-xs font-semibold bg-amber-500/20 hover:bg-amber-500/40 border border-amber-500/40 text-amber-200 rounded-lg px-3 py-1.5 transition"
            >
              Complete profile →
            </a>
          </div>
        )}

        {/* ── Error banner ── */}
        {error && (
          <div className="bg-rose-900/50 border border-rose-500/40 text-rose-300 text-sm px-4 py-3 rounded-xl flex items-center justify-between">
            <span>⚠️ {error}</span>
            <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-200">
              ✕
            </button>
          </div>
        )}

        {/* ── Ask form ── */}
        {showAskForm && (
          <div className="bg-slate-900/80 border border-violet-500/30 rounded-2xl p-5 shadow-xl shadow-violet-950/50 space-y-3">
            <h2 className="font-bold text-violet-300">New Question</h2>

            {!profile && (
              <p className="text-sm text-amber-400 bg-amber-900/20 border border-amber-500/30 rounded-lg px-3 py-2">
                You must be{" "}
                <Link to="/login" className="underline hover:text-amber-300 font-medium">
                  logged in
                </Link>{" "}
                to post.
              </p>
            )}

            {profile && !onboardingDone && (
              <p className="text-sm text-amber-400 bg-amber-900/20 border border-amber-500/30 rounded-lg px-3 py-2">
                Please{" "}
                <a href="/profile" className="underline">
                  set a display name
                </a>{" "}
                before posting.
              </p>
            )}

            <input
              className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-2.5 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 transition disabled:opacity-40"
              placeholder="What's your question?"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              maxLength={160}
              disabled={!canPost}
            />
            <textarea
              className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-2.5 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 transition resize-none disabled:opacity-40"
              placeholder="Provide details or context about your question"
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              rows={3}
              disabled={!canPost}
            />

            {canPost && (
              <p className="text-xs text-slate-500">
                Posting as <span className="text-slate-300 font-semibold">{authorName}</span>
              </p>
            )}

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowAskForm(false);
                  setNewTitle("");
                  setNewContent("");
                }}
                className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition"
              >
                Cancel
              </button>
              <button
                onClick={handlePostQuestion}
                disabled={posting || !newTitle.trim() || !newContent.trim() || !canPost}
                className="px-5 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl active:scale-95 transition-all"
              >
                {posting ? "Posting…" : "Post Question"}
              </button>
            </div>
          </div>
        )}

        {/* ── Loading skeleton ── */}
        {loading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-slate-900/50 border border-white/5 rounded-2xl p-5 animate-pulse space-y-3"
              >
                <div className="h-4 bg-slate-700 rounded w-3/4" />
                <div className="h-3 bg-slate-700 rounded w-full" />
                <div className="h-3 bg-slate-700 rounded w-1/2" />
              </div>
            ))}
          </div>
        )}

        {/* ── Empty state ── */}
        {!loading && questions.length === 0 && (
          <div className="text-center py-20 text-slate-500">
            <p className="text-5xl mb-4">🤔</p>
            <p className="text-lg font-semibold text-slate-300">No questions yet</p>
            <p className="text-sm mt-1">Be the first to ask something bussin!</p>
          </div>
        )}

        {/* ── Question cards ── */}
        {!loading &&
          questions.map((q) => {
            const isExpanded = expandedId === q.id;
            // Ownership: stored author string must match the current user's display name
            const isOwner = canPost && q.author === authorName;

            return (
              <article
                key={q.id}
                className="bg-slate-900/70 border border-white/10 rounded-2xl overflow-hidden shadow-lg hover:border-violet-500/30 transition-colors"
              >
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-slate-100 text-base leading-snug">{q.title}</h3>
                      <p className="text-slate-400 text-sm mt-1.5 leading-relaxed">{q.content}</p>
                    </div>
                    {isOwner && (
                      <button
                        onClick={() => handleDeleteQuestion(q.id)}
                        className="text-slate-600 hover:text-rose-400 transition shrink-0 mt-0.5"
                        title="Delete question"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-3 mt-3 flex-wrap">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Avatar
                        name={q.author}
                        imageUrl={q.author === authorName ? currentUserAvatarUrl : null}
                      />
                      <span className="font-medium text-slate-400">{q.author}</span>
                    </div>
                    <span className="text-slate-600 text-xs">{timeAgo(q.createdAt)}</span>
                    <Badge count={q.answers?.length ?? 0} />
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : q.id)}
                      className="ml-auto text-xs text-violet-400 hover:text-violet-300 font-medium flex items-center gap-1 transition"
                    >
                      {isExpanded ? "Hide answers ▲" : "View answers ▼"}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-white/5 bg-slate-950/40 px-5 py-4 space-y-4">
                    {(q.answers?.length ?? 0) === 0 ? (
                      <p className="text-sm text-slate-500 italic">
                        This thread needs a lore drop immediately
                      </p>
                    ) : (
                      <ul className="space-y-3">
                        {q.answers.map((a) => (
                          <li key={a.id} className="flex gap-3 group">
                            <Avatar
                              name={a.author}
                              imageUrl={a.author === authorName ? currentUserAvatarUrl : null}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-slate-300">
                                  {a.author}
                                </span>
                                <span className="text-xs text-slate-600">
                                  {timeAgo(a.createdAt)}
                                </span>
                                {canPost && a.author === authorName && (
                                  <button
                                    onClick={() => handleDeleteAnswer(a.id)}
                                    className="hidden group-hover:block text-slate-600 hover:text-rose-400 transition ml-auto"
                                    title="Delete answer"
                                  >
                                    <svg
                                      className="w-3.5 h-3.5"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth={2}
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M6 18L18 6M6 6l12 12"
                                      />
                                    </svg>
                                  </button>
                                )}
                              </div>
                              <p className="text-sm text-slate-300 mt-0.5 leading-relaxed">
                                {a.content}
                              </p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}

                    {canPost ? (
                      <div className="space-y-1.5 pt-1">
                        <div className="flex gap-2">
                          <input
                            className="flex-1 bg-slate-800 border border-white/10 rounded-xl px-4 py-2 text-sm placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500 transition"
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
                          />
                          <button
                            onClick={() => handlePostAnswer(q.id)}
                            disabled={postingAnswer === q.id || !answerDraft[q.id]?.trim()}
                            className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl active:scale-95 transition-all whitespace-nowrap"
                          >
                            {postingAnswer === q.id ? "…" : "Post"}
                          </button>
                        </div>
                      </div>
                    ) : profile && !onboardingDone ? (
                      <p className="text-xs text-amber-500/80 italic">
                        <a href="/profile" className="underline">
                          Set a display name
                        </a>{" "}
                        to post answers.
                      </p>
                    ) : (
                      <p className="text-xs text-slate-500 italic">Log in to post an answer.</p>
                    )}
                  </div>
                )}
              </article>
            );
          })}
      </main>
    </div>
  );
}
