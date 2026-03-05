import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  MessageCircle,
  Plus,
  Trash2,
  X,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Paperclip,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RoleBadge } from "@/components/role-badge";
import { getMe, type MeResponse } from "@/lib/me";
import { supabase } from "@/lib/supabase";
import { api } from "@/lib/api";
import { getValidAccessToken } from "@/lib/session";
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

type UserProfile = MeResponse;

const API = "forum";
const AVATAR_BUCKET = import.meta.env.VITE_SUPABASE_AVATAR_BUCKET?.trim() || "avatars";
const FORUM_MEDIA_BUCKET = import.meta.env.VITE_SUPABASE_FORUM_BUCKET?.trim() || "forum-media";

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

// Render content: convert markdown image/video links and plain URLs into <img> or <video>
function renderContent(content: string) {
  if (!content) return null;

  type Part = { type: "text" | "img" | "video"; value: string };
  const parts: Part[] = [];
  const mdLink = /!\[\]\(([^)]+)\)/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = mdLink.exec(content)) !== null) {
    if (m.index > lastIndex) {
      parts.push({ type: "text", value: content.slice(lastIndex, m.index) });
    }
    const url = m[1];
    const isVideo = /\.(mp4|webm|ogg|mov)(?:\?|$)/i.test(url);
    parts.push({ type: isVideo ? "video" : "img", value: url });
    lastIndex = mdLink.lastIndex;
  }
  if (lastIndex < content.length) {
    parts.push({ type: "text", value: content.slice(lastIndex) });
  }

  // Split text parts further into text + URL parts so plain links render as media
  const urlRegex = /(https?:\/\/[\w\-./?=%&+#:,]+(?:\.(?:png|jpg|jpeg|gif|svg|mp4|webm|ogg|mov))(?:\?[^\s]*)?)/gi;
  const rendered: JSX.Element[] = [];
  parts.forEach((p, idx) => {
    if (p.type === "img") {
      rendered.push(
        <div key={`img-${idx}`} className="my-2">
          <img src={p.value} alt="attachment" className="max-h-48 w-auto rounded-md" />
        </div>
      );
      return;
    }
    if (p.type === "video") {
      rendered.push(
        <div key={`vid-${idx}`} className="my-2">
          <video src={p.value} controls className="max-h-56 w-auto rounded-md" />
        </div>
      );
      return;
    }

    // for text parts, detect inline URLs that point to images/videos and split
    const text = p.value;
    let last = 0;
    let um: RegExpExecArray | null;
    while ((um = urlRegex.exec(text)) !== null) {
      if (um.index > last) {
        rendered.push(
          <p key={`t-${idx}-${last}`} className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
            {text.slice(last, um.index)}
          </p>
        );
      }
      const url = um[1];
      const isVideo = /\.(mp4|webm|ogg|mov)(?:\?|$)/i.test(url);
      if (isVideo) {
        rendered.push(
          <div key={`vt-${idx}-${um.index}`} className="my-2">
            <video src={url} controls className="max-h-56 w-auto rounded-md" />
          </div>
        );
      } else {
        rendered.push(
          <div key={`it-${idx}-${um.index}`} className="my-2">
            <img src={url} alt="attachment" className="max-h-48 w-auto rounded-md" />
          </div>
        );
      }
      last = urlRegex.lastIndex;
    }
    if (last < text.length) {
      rendered.push(
        <p key={`t-${idx}-end`} className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
          {text.slice(last)}
        </p>
      );
    }
  });

  return <div>{rendered}</div>;
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
  const [selectedMediaFile, setSelectedMediaFile] = useState<File | null>(null);
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  

  const [answerDraft, setAnswerDraft] = useState<Record<number, string>>({});
  const [postingAnswer, setPostingAnswer] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [debugMessage, setDebugMessage] = useState<string | null>(null);
  const debugTimeoutRef = useRef<number | null>(null);

  function showDebug(msg: string) {
    console.log(msg);
    setDebugMessage(msg);
    if (debugTimeoutRef.current) window.clearTimeout(debugTimeoutRef.current);
    debugTimeoutRef.current = window.setTimeout(() => setDebugMessage(null), 3500);
  }

  useEffect(() => {
    return () => {
      if (debugTimeoutRef.current) window.clearTimeout(debugTimeoutRef.current);
    };
  }, []);

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

        const userProfile = await getMe();
        setProfile(userProfile);

        if (userProfile.avatarPath) {
          const { data: signedData, error: signedError } = await supabase.storage
            .from(AVATAR_BUCKET)
            .createSignedUrl(userProfile.avatarPath, 60 * 60);
          if (!signedError && signedData?.signedUrl) {
            setCurrentUserAvatarUrl(signedData.signedUrl);
          } else {
            setCurrentUserAvatarUrl(null);
          }
        } else {
          setCurrentUserAvatarUrl(null);
        }

        // capture user-selected avatar color from the API response if present
        setCurrentUserAvatarColor(userProfile.avatarColor ?? null);
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
      const data: Question[] = await api.get(`${API}/questions`).json();
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
      let contentToSend = newContent.trim();

      // if a media file is selected, upload it to Supabase Storage and append
      // a markdown link to the content so backend can store it as part of the question
      if (selectedMediaFile) {
        // sanitize filename to avoid characters that can cause storage 400 errors
        const safeName = (selectedMediaFile.name || "file").replace(/\s+/g, "_").replace(/[^A-Za-z0-9._-]/g, "");
        const mediaPath = `uploads/forum/${Date.now()}_${safeName}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from(FORUM_MEDIA_BUCKET)
          .upload(mediaPath, selectedMediaFile, { upsert: true });

        if (uploadError) {
          console.error("Supabase upload error:", uploadError, uploadData);
          throw new Error(uploadError.message || "Failed to upload media");
        }

        const { data: signedData, error: signedError } = await supabase.storage
          .from(FORUM_MEDIA_BUCKET)
          .createSignedUrl(mediaPath, 60 * 60);

        const mediaUrl = !signedError && signedData?.signedUrl ? signedData.signedUrl : null;
        if (mediaUrl) {
          // append as markdown image by default; users can paste other content too
          contentToSend += `\n\n![](${mediaUrl})`;
        }
      }

      // use explicit fetch with a valid bearer token to ensure the server
      // receives a plain JSON object (avoids any double-encoding issues)
      const token = await getValidAccessToken();
      // ensure DB varchar(255) limits are respected (title/author)
      const safeTitle = newTitle.trim().slice(0, 255);
      const safeAuthor = authorName.slice(0, 255);
      if (safeTitle.length < newTitle.trim().length) {
        console.warn("Title truncated to 255 chars to fit DB column");
      }
      if (safeAuthor.length < authorName.length) {
        console.warn("Author truncated to 255 chars to fit DB column");
      }

      const payload = {
        title: safeTitle,
        content: contentToSend,
        author: safeAuthor,
      };

      // debug: log payload (will not include file binary)
      console.debug("Posting question payload:", payload);

      const res = await fetch("http://localhost:8080/api/forum/questions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "<no body>");
        console.error("POST /api/forum/questions failed:", res.status, text);
        throw new Error(`Failed to post question: ${res.status} ${text}`);
      }
      setNewTitle("");
      setNewContent("");
      setSelectedMediaFile(null);
      setMediaPreviewUrl(null);
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
    let content = answerDraft[qId]?.trim();
    if (!content || !canPost) return;
    setPostingAnswer(qId);
    try {
      await api.post(`${API}/questions/${qId}/answers`, {
        json: {
          content,
          author: authorName,
        },
      }).json();
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
    await api.delete(`${API}/questions/${qId}`);
    await fetchQuestions();
  };

  const handleDeleteAnswer = async (aId: number) => {
    await api.delete(`${API}/answers/${aId}`);
    await fetchQuestions();
  };

  /* ── render ── */
  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
      {debugMessage && (
        <div className="mb-4 rounded-md border bg-yellow-50 px-3 py-2 text-sm text-yellow-900">Debug: {debugMessage}</div>
      )}
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

            {/* media input + preview */}
            <div className="flex items-center gap-3">
              <input
                id="forum-file-input"
                ref={(el) => (fileInputRef.current = el)}
                type="file"
                accept="image/*,video/*"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  const url = f ? URL.createObjectURL(f) : null;
                  setSelectedMediaFile(f);
                  setMediaPreviewUrl(url);
                }}
                disabled={!canPost}
              />

              <Button size="sm" variant="outline" asChild disabled={!canPost}>
                <label htmlFor="forum-file-input" className="inline-flex items-center gap-2 cursor-pointer">
                  Attach file
                </label>
              </Button>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm text-muted-foreground">
                    {selectedMediaFile ? selectedMediaFile.name : "No file chosen"}
                  </span>
                  {selectedMediaFile && (
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      onClick={() => {
                        setSelectedMediaFile(null);
                        setMediaPreviewUrl(null);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                      title="Remove attachment"
                    >
                      <X className="size-3.5" />
                    </Button>
                  )}
                </div>

                {mediaPreviewUrl && (
                  <div className="mt-2 rounded-md overflow-hidden">
                    {selectedMediaFile?.type.startsWith("video/") ? (
                      <video src={mediaPreviewUrl} controls className="h-24 w-auto rounded-md" />
                    ) : (
                      <img src={mediaPreviewUrl} alt="preview" className="h-16 w-auto object-cover rounded-md" />
                    )}
                  </div>
                )}
              </div>
            </div>

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
                      <div className="mt-1.5">
                        {renderContent(q.content)}
                      </div>
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
                              <div className="mt-0.5">
                                {renderContent(a.content)}
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}

                    {canPost ? (
                      <div className="space-y-2 pt-1">
                        <div className="flex gap-2">
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

                          {/* reply attachments removed by request */}

                          <Button
                            size="sm"
                            onClick={() => handlePostAnswer(q.id)}
                            disabled={postingAnswer === q.id || !answerDraft[q.id]?.trim()}
                          >
                            {postingAnswer === q.id ? "…" : "Post"}
                          </Button>
                        </div>

                        {/* reply attachment preview removed */}
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
