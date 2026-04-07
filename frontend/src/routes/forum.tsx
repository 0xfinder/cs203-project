import { createFileRoute, Link } from "@tanstack/react-router";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  MessageCircle,
  MessageCircleMore,
  Plus,
  Trash2,
  X,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  ThumbsUp,
  ThumbsDown,
  Bold,
  Italic,
  Strikethrough,
  Link as LinkIcon,
  List,
  ListOrdered,
  ImagePlus,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RoleBadge } from "@/components/role-badge";
import { UserAvatar } from "@/components/user-avatar";
import { optionalCurrentUserViewQueryOptions } from "@/lib/current-user-view";
import { type MeResponse } from "@/lib/me";
import { queryClient } from "@/lib/query-client";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { AppPageShell } from "@/components/app-page-shell";
import {
  type AnswerResp,
  type AuthorInfo,
  FORUM_QUERY_KEY,
  forumAnswersQueryOptions,
  forumQuestionsQueryOptions,
  type ForumQuestionPageResp,
  type QuestionListItemResp,
  type VoteSummary,
} from "@/features/forum/useForumData";

const FORUM_PAGE_SIZE = 10;

export const Route = createFileRoute("/forum")({
  loader: async () => {
    await Promise.all([
      queryClient.ensureQueryData(optionalCurrentUserViewQueryOptions()),
      queryClient.ensureQueryData(forumQuestionsQueryOptions(0, FORUM_PAGE_SIZE)),
    ]);
  },
  component: ForumPage,
});

type UserProfile = MeResponse;

const FORUM_MEDIA_BUCKET = import.meta.env.VITE_SUPABASE_FORUM_BUCKET?.trim() || "forum-media";
const MAX_IMAGE_MB = 5;

/* -- Error extraction ------------------------------------------------------ */
async function extractErrorMessage(e: unknown, fallback: string): Promise<string> {
  if (e && typeof e === "object" && "response" in e) {
    try {
      const body = await (e as { response: Response }).response.json();
      if (body?.message) return body.message;
    } catch (e) {
      console.error("failed to parse error response:", e);
      /* ignore parse errors */
    }
  }
  if (e instanceof Error) return e.message;
  return fallback;
}

/* -- Helpers ---------------------------------------------------------------- */
function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function displayLabel(profile: UserProfile | null): string {
  if (!profile) return "Guest";
  return profile.displayName?.trim() || profile.email.split("@")[0];
}

function forumQuestionsKey(page: number, size: number) {
  return [...FORUM_QUERY_KEY, "questions", page, size] as const;
}

function forumAnswersKey(questionId: number) {
  return [...FORUM_QUERY_KEY, "answers", questionId] as const;
}

/* -- Sub-components -------------------------------------------------------- */
function AnswerBadge({ count, onClick }: { count: number; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary transition-colors hover:bg-primary/15"
    >
      <MessageCircle className="size-3" />
      {count} {count === 1 ? "answer" : "answers"}
    </button>
  );
}

/* -- Vote buttons ---------------------------------------------------------- */
function VoteButtons({
  votes,
  onVote,
  onClear,
  disabled,
}: {
  votes: VoteSummary;
  onVote: (type: "THUMBS_UP" | "THUMBS_DOWN") => void;
  onClear: () => void;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <button
        disabled={disabled}
        onClick={() => (votes.userVote === "THUMBS_UP" ? onClear() : onVote("THUMBS_UP"))}
        className={cn(
          "flex items-center gap-1 rounded-md px-1.5 py-1 text-xs transition-colors",
          votes.userVote === "THUMBS_UP"
            ? "bg-green-500/15 text-green-600 dark:text-green-400 font-semibold"
            : "text-muted-foreground hover:text-green-600 hover:bg-green-500/10",
          disabled && "opacity-50 cursor-not-allowed",
        )}
        title="Upvote"
      >
        <ThumbsUp className="size-3.5" />
        {votes.thumbsUp > 0 && <span>{votes.thumbsUp}</span>}
      </button>
      <button
        disabled={disabled}
        onClick={() => (votes.userVote === "THUMBS_DOWN" ? onClear() : onVote("THUMBS_DOWN"))}
        className={cn(
          "flex items-center gap-1 rounded-md px-1.5 py-1 text-xs transition-colors",
          votes.userVote === "THUMBS_DOWN"
            ? "bg-destructive/15 text-destructive font-semibold"
            : "text-muted-foreground hover:text-destructive hover:bg-destructive/10",
          disabled && "opacity-50 cursor-not-allowed",
        )}
        title="Downvote"
      >
        <ThumbsDown className="size-3.5" />
        {votes.thumbsDown > 0 && <span>{votes.thumbsDown}</span>}
      </button>
    </div>
  );
}

/* -- Markdown renderer ----------------------------------------------------- */
const MarkdownContent = memo(function MarkdownContent({ content }: { content: string }) {
  return (
    <Markdown
      remarkPlugins={[remarkGfm]}
      components={{
        img: ({ node: _node, ...props }: any) => (
          <img
            {...props}
            className="my-2 max-h-96 max-w-full rounded-lg border object-contain"
            loading="lazy"
          />
        ),
        p: ({ node: _node, ...props }: any) => (
          <p className="mt-0.5 text-sm leading-relaxed" {...props} />
        ),
        strong: ({ node: _node, ...props }: any) => <strong className="font-bold" {...props} />,
        em: ({ node: _node, ...props }: any) => <em className="italic" {...props} />,
        a: ({ node: _node, ...props }: any) => (
          <a
            className="text-primary underline hover:opacity-80"
            target="_blank"
            rel="noopener noreferrer"
            {...props}
          />
        ),
        ul: ({ node: _node, ...props }: any) => (
          <ul className="ml-4 list-disc text-sm" {...props} />
        ),
        ol: ({ node: _node, ...props }: any) => (
          <ol className="ml-4 list-decimal text-sm" {...props} />
        ),
        code: ({ node: _node, ...props }: any) => (
          <code className="rounded bg-muted px-1 py-0.5 text-xs font-mono" {...props} />
        ),
      }}
    >
      {content}
    </Markdown>
  );
});

/* -- Markdown toolbar ------------------------------------------------------ */
type MdAction = {
  icon: React.ElementType;
  label: string;
  wrap: [string, string];
};

const MD_ACTIONS: MdAction[] = [
  { icon: Bold, label: "Bold", wrap: ["**", "**"] },
  { icon: Italic, label: "Italic", wrap: ["*", "*"] },
  { icon: Strikethrough, label: "Strikethrough", wrap: ["~~", "~~"] },
  { icon: LinkIcon, label: "Link", wrap: ["[", "](url)"] },
  { icon: List, label: "Bullet list", wrap: ["- ", ""] },
  { icon: ListOrdered, label: "Numbered list", wrap: ["1. ", ""] },
];

function applyMarkdown(
  textarea: HTMLTextAreaElement,
  wrap: [string, string],
  setValue: (v: string) => void,
) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const text = textarea.value;
  const selected = text.slice(start, end);
  const replacement = `${wrap[0]}${selected || "text"}${wrap[1]}`;
  const newText = text.slice(0, start) + replacement + text.slice(end);
  setValue(newText);
  requestAnimationFrame(() => {
    textarea.focus();
    const cursorPos = start + wrap[0].length;
    const cursorEnd = cursorPos + (selected || "text").length;
    textarea.setSelectionRange(cursorPos, cursorEnd);
  });
}

function MarkdownToolbar({
  textareaRef,
  onImageUpload,
  setValue,
  uploading,
}: {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  onImageUpload: () => void;
  setValue: (v: string) => void;
  uploading: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-0.5 rounded-t-md border border-b-0 bg-muted/40 px-1.5 py-1">
      {MD_ACTIONS.map((action) => (
        <button
          key={action.label}
          type="button"
          title={action.label}
          className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          onMouseDown={(e) => {
            e.preventDefault();
            if (textareaRef.current) {
              applyMarkdown(textareaRef.current, action.wrap, setValue);
            }
          }}
        >
          <action.icon className="size-3.5" />
        </button>
      ))}
      <div className="mx-1 h-4 w-px bg-border" />
      <button
        type="button"
        title="Upload image"
        disabled={uploading}
        className={cn(
          "rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
          uploading && "opacity-50 cursor-not-allowed",
        )}
        onClick={onImageUpload}
      >
        <ImagePlus className="size-3.5" />
      </button>
      {uploading && <span className="ml-1 text-xs text-muted-foreground">uploading...</span>}
    </div>
  );
}

/* -- Image upload helper --------------------------------------------------- */
async function uploadForumImage(file: File, userId: string): Promise<string | null> {
  if (!file.type.startsWith("image/")) return null;
  if (file.size > MAX_IMAGE_MB * 1024 * 1024) return null;

  const ext = file.name.split(".").pop() || "png";
  const path = `forum/${userId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error } = await supabase.storage
    .from(FORUM_MEDIA_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });

  if (error) {
    console.error("Upload failed:", error);
    return null;
  }

  // Try to get the public URL first
  try {
    const pubResp = supabase.storage.from(FORUM_MEDIA_BUCKET).getPublicUrl(path as string);
    console.log("forum upload: getPublicUrl response:", pubResp);
    const publicUrl = (pubResp as any)?.data?.publicUrl ?? (pubResp as any)?.publicUrl ?? null;
    if (publicUrl) {
      // Check if the URL is actually accessible (bucket might be private)
      try {
        const head = await fetch(publicUrl, { method: "HEAD" });
        console.log("forum upload: publicUrl HEAD status", head.status);
        if (head.ok) return publicUrl;
      } catch (e) {
        console.error("failed to check public url accessibility:", e);
        // network/fetch errors fallthrough to signed-url fallback
      }
    }

    // Fallback: ask backend to sign the object using the service role (more reliable)
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080"}/api/forum/media/signed-url`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bucket: FORUM_MEDIA_BUCKET, path, expires: 60 * 60 * 24 }),
        },
      );
      if (res.ok) {
        const json = await res.json();
        const signedUrl =
          (json as any)?.signedUrl ?? (json as any)?.signedURL ?? (json as any)?.signed_url ?? null;
        if (signedUrl) return signedUrl;
      } else {
        console.warn("forum upload: backend signed-url failed", res.status);
      }
    } catch (e) {
      console.error("forum upload: backend signed-url error", e);
    }

    // Last resort: return whatever publicUrl we received (may 403)
    return publicUrl || null;
  } catch (e) {
    console.error("Error getting public/signed URL:", e);
    return null;
  }
}

/* -- Markdown textarea component ------------------------------------------- */
function MarkdownTextarea({
  value,
  onChange,
  placeholder,
  rows,
  disabled,
  userId,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
  userId?: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleImageUpload = useCallback(async () => {
    if (!userId) return;
    fileInputRef.current?.click();
  }, [userId]);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !userId) return;
      if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
        alert(`Image must be under ${MAX_IMAGE_MB}MB`);
        return;
      }
      setUploading(true);
      try {
        const url = await uploadForumImage(file, userId);
        if (url && textareaRef.current) {
          const ta = textareaRef.current;
          const pos = ta.selectionStart;
          const text = ta.value;
          const insertion = `![image](${url})`;
          const newText = text.slice(0, pos) + insertion + text.slice(ta.selectionEnd);
          onChange(newText);
          requestAnimationFrame(() => {
            ta.focus();
            const newPos = pos + insertion.length;
            ta.setSelectionRange(newPos, newPos);
          });
        }
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [userId, onChange],
  );

  return (
    <div>
      <MarkdownToolbar
        textareaRef={textareaRef}
        onImageUpload={handleImageUpload}
        setValue={onChange}
        uploading={uploading}
      />
      <textarea
        ref={textareaRef}
        className="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 w-full min-w-0 resize-none rounded-b-md border bg-transparent px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50 dark:bg-input/30"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows ?? 3}
        disabled={disabled || uploading}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}

function QuestionCard({
  question,
  isExpanded,
  onToggle,
  profile,
  canPost,
  canModerate,
  onboardingDone,
  onError,
  currentPage,
  pageSize,
}: {
  question: QuestionListItemResp;
  isExpanded: boolean;
  onToggle: () => void;
  profile: UserProfile | null;
  canPost: boolean;
  canModerate: boolean;
  onboardingDone: boolean;
  onError: (message: string) => void;
  currentPage: number;
  pageSize: number;
}) {
  const queryClient = useQueryClient();
  const [answerDraft, setAnswerDraft] = useState("");
  const [postingAnswer, setPostingAnswer] = useState(false);
  const answersQuery = useQuery({
    ...forumAnswersQueryOptions(question.id),
    enabled: isExpanded,
  });

  const answers = answersQuery.data ?? [];
  const canDeleteContent = (authorInfo: AuthorInfo) =>
    Boolean(profile) && (authorInfo.id === profile?.id || canModerate);

  const handleDeleteAnswer = async (answerId: number) => {
    try {
      await api.delete(`forum/answers/${answerId}`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: forumAnswersKey(question.id) }),
        queryClient.invalidateQueries({ queryKey: [...FORUM_QUERY_KEY, "questions"] }),
      ]);
    } catch (e) {
      console.error("failed to delete answer:", e);
      onError("Failed to delete answer");
    }
  };

  const handlePostAnswer = async () => {
    const content = answerDraft.trim();
    if (!content || !canPost) return;
    setPostingAnswer(true);
    try {
      await api
        .post(`forum/questions/${question.id}/answers`, {
          json: { content },
        })
        .json();
      setAnswerDraft("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: forumAnswersKey(question.id) }),
        queryClient.invalidateQueries({ queryKey: [...FORUM_QUERY_KEY, "questions"] }),
      ]);
    } catch (e) {
      onError(await extractErrorMessage(e, "Failed to post answer"));
    } finally {
      setPostingAnswer(false);
    }
  };

  const handleAnswerVote = async (answerId: number, type: "THUMBS_UP" | "THUMBS_DOWN") => {
    if (!canPost) return;
    try {
      const updated = await api
        .post(`forum/answers/${answerId}/votes`, {
          json: { voteType: type },
        })
        .json<VoteSummary>();
      queryClient.setQueryData<AnswerResp[]>(forumAnswersKey(question.id), (prev) =>
        (prev ?? []).map((answer) =>
          answer.id === answerId ? { ...answer, votes: updated } : answer,
        ),
      );
    } catch (e) {
      console.error("failed to vote on answer:", e);
      onError("Failed to vote");
    }
  };

  const handleClearAnswerVote = async (answerId: number) => {
    if (!canPost) return;
    try {
      const updated = await api.delete(`forum/answers/${answerId}/votes`).json<VoteSummary>();
      queryClient.setQueryData<AnswerResp[]>(forumAnswersKey(question.id), (prev) =>
        (prev ?? []).map((answer) =>
          answer.id === answerId ? { ...answer, votes: updated } : answer,
        ),
      );
    } catch (e) {
      console.error("failed to clear answer vote:", e);
      onError("Failed to clear vote");
    }
  };

  const handleDeleteQuestion = async () => {
    if (!confirm("Delete this question and all its answers?")) return;
    try {
      await api.delete(`forum/questions/${question.id}`);
      await queryClient.invalidateQueries({ queryKey: [...FORUM_QUERY_KEY, "questions"] });
      queryClient.removeQueries({ queryKey: forumAnswersKey(question.id) });
    } catch (e) {
      console.error("failed to delete question:", e);
      onError("Failed to delete question");
    }
  };

  const handleQuestionVote = async (type: "THUMBS_UP" | "THUMBS_DOWN") => {
    if (!canPost) return;
    try {
      const updated = await api
        .post(`forum/questions/${question.id}/votes`, {
          json: { voteType: type },
        })
        .json<VoteSummary>();
      queryClient.setQueryData<ForumQuestionPageResp>(
        forumQuestionsKey(currentPage, pageSize),
        (prev) =>
          prev
            ? {
                ...prev,
                items: prev.items.map((item) =>
                  item.id === question.id ? { ...item, votes: updated } : item,
                ),
              }
            : prev,
      );
    } catch (e) {
      console.error("failed to vote on question:", e);
      onError("Failed to vote");
    }
  };

  const handleClearQuestionVote = async () => {
    if (!canPost) return;
    try {
      const updated = await api.delete(`forum/questions/${question.id}/votes`).json<VoteSummary>();
      queryClient.setQueryData<ForumQuestionPageResp>(
        forumQuestionsKey(currentPage, pageSize),
        (prev) =>
          prev
            ? {
                ...prev,
                items: prev.items.map((item) =>
                  item.id === question.id ? { ...item, votes: updated } : item,
                ),
              }
            : prev,
      );
    } catch (e) {
      console.error("failed to clear question vote:", e);
      onError("Failed to clear vote");
    }
  };

  return (
    <Card className="overflow-hidden transition-colors hover:border-primary/30">
      <CardContent className="pb-0">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <UserAvatar
            name={question.authorInfo.displayName ?? question.author}
            avatarPath={question.authorInfo.avatarPath}
            avatarColor={question.authorInfo.avatarColor}
          />
          <span className="font-medium text-foreground">
            {question.authorInfo.displayName ?? question.author}
          </span>
          {question.authorInfo.role && (
            <RoleBadge role={question.authorInfo.role as any} className="text-muted-foreground" />
          )}
          <span className="text-muted-foreground/60">{timeAgo(question.createdAt)}</span>
          {canDeleteContent(question.authorInfo) && (
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={handleDeleteQuestion}
              title="Delete question"
              className="ml-auto shrink-0 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="size-3.5" />
            </Button>
          )}
        </div>

        <div className="mt-2 flex gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold leading-snug">{question.title}</h3>
            <div className="mt-1.5 text-muted-foreground">
              <MarkdownContent content={question.content} />
            </div>
          </div>
          <VoteButtons
            votes={question.votes}
            onVote={handleQuestionVote}
            onClear={handleClearQuestionVote}
            disabled={!canPost}
          />
        </div>

        <div className="mt-3 flex items-center gap-3 pb-4">
          <AnswerBadge count={question.answerCount} onClick={onToggle} />
          <button
            onClick={onToggle}
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
        <div className="space-y-4 border-t bg-muted/30 px-6 py-4">
          {answersQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading answers...</p>
          ) : answers.length === 0 ? (
            <p className="text-sm italic text-muted-foreground">
              his thread needs a lore drop immediately
            </p>
          ) : (
            <ul className="space-y-3">
              {answers.map((answer) => (
                <li key={answer.id} className="group flex gap-3">
                  <UserAvatar
                    name={answer.authorInfo.displayName ?? answer.author}
                    avatarPath={answer.authorInfo.avatarPath}
                    avatarColor={answer.authorInfo.avatarColor}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold">
                        {answer.authorInfo.displayName ?? answer.author}
                      </span>
                      {answer.authorInfo.role && (
                        <RoleBadge
                          role={answer.authorInfo.role as any}
                          className="text-muted-foreground"
                        />
                      )}
                      <span className="text-xs text-muted-foreground/60">
                        {timeAgo(answer.createdAt)}
                      </span>
                      {canDeleteContent(answer.authorInfo) && (
                        <button
                          onClick={() => handleDeleteAnswer(answer.id)}
                          className="ml-auto hidden text-muted-foreground transition-colors hover:text-destructive group-hover:block"
                          title="Delete answer"
                        >
                          <X className="size-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="mt-0.5 text-muted-foreground">
                      <MarkdownContent content={answer.content} />
                    </div>
                  </div>
                  <VoteButtons
                    votes={answer.votes}
                    onVote={(type) => handleAnswerVote(answer.id, type)}
                    onClear={() => handleClearAnswerVote(answer.id)}
                    disabled={!canPost}
                  />
                </li>
              ))}
            </ul>
          )}

          {canPost ? (
            <div className="space-y-2 pt-1">
              <MarkdownTextarea
                value={answerDraft}
                onChange={setAnswerDraft}
                placeholder="Go ahead and cook..."
                rows={2}
                userId={profile?.id}
              />
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={handlePostAnswer}
                  disabled={postingAnswer || !answerDraft.trim()}
                >
                  {postingAnswer ? "..." : "Post Reply"}
                </Button>
              </div>
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
              <Link to="/login" className="font-medium underline hover:opacity-80">
                Log in
              </Link>{" "}
              to post an answer.
            </p>
          )}
        </div>
      )}
    </Card>
  );
}

/* -- Main component -------------------------------------------------------- */
function ForumPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const currentUserViewQuery = useQuery(optionalCurrentUserViewQueryOptions());
  const forumQuestionsQuery = useQuery(forumQuestionsQueryOptions(page, FORUM_PAGE_SIZE));
  const profile = (currentUserViewQuery.data && currentUserViewQuery.data.profile) || null;
  const currentUserAvatarUrl = currentUserViewQuery.data?.avatarUrl ?? null;

  const [showAskForm, setShowAskForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [posting, setPosting] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const questions = forumQuestionsQuery.data?.items ?? [];
  const pagination = forumQuestionsQuery.data;

  useEffect(() => {
    if (!pagination?.hasNext) return;
    void queryClient.prefetchQuery(forumQuestionsQueryOptions(page + 1, FORUM_PAGE_SIZE));
  }, [page, pagination?.hasNext, queryClient]);

  useEffect(() => {
    if (!forumQuestionsQuery.isSuccess) return;
    if (questions.length === 0 && page > 0 && pagination && pagination.totalPages <= page) {
      setPage(Math.max(0, pagination.totalPages - 1));
    }
  }, [forumQuestionsQuery.isSuccess, page, pagination, questions.length]);

  /* -- derived state ------------------------------------------------------ */
  const authorName = displayLabel(profile);
  const onboardingDone = Boolean(profile?.displayName?.trim());
  const canPost = Boolean(profile) && onboardingDone;
  const canModerate = profile?.role === "MODERATOR" || profile?.role === "ADMIN";

  /* -- post question ------------------------------------------------------ */
  const handlePostQuestion = async () => {
    if (!newTitle.trim() || !newContent.trim() || !canPost) return;
    setPosting(true);
    try {
      await api
        .post("forum/questions", {
          json: {
            title: newTitle.trim(),
            content: newContent.trim(),
          },
        })
        .json();
      setNewTitle("");
      setNewContent("");
      setShowAskForm(false);
      setPage(0);
      await queryClient.invalidateQueries({ queryKey: [...FORUM_QUERY_KEY, "questions"] });
      setError(null);
    } catch (e) {
      setError(await extractErrorMessage(e, "Failed to post"));
    } finally {
      setPosting(false);
    }
  };

  /* -- render ------------------------------------------------------------- */
  return (
    <AppPageShell contentClassName="max-w-3xl">
      {/* debug banner removed (undefined `debugMessage` caused runtime error) */}
      {/* page header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="min-w-0 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
            <MessageCircleMore className="size-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold">Forum</h1>
            <p className="text-sm text-muted-foreground">Beat the Unc Allegations 💀</p>
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-3">
          {profile ? (
            <span className="hidden items-center gap-2 text-sm sm:flex">
              <UserAvatar
                name={authorName}
                avatarPath={profile.avatarPath}
                avatarColor={profile.avatarColor}
                avatarUrl={currentUserAvatarUrl}
              />
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
              You need a <strong>display name</strong> before you can post.
            </span>
            <Button variant="outline" size="sm" asChild>
              <Link to="/profile">Complete profile</Link>
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

            <MarkdownTextarea
              value={newContent}
              onChange={setNewContent}
              placeholder="Provide details or context about your question"
              rows={4}
              disabled={!canPost}
              userId={profile?.id}
            />

            {/* file attachments removed from the post form; use inline image upload in the editor */}

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
                {posting ? "Posting..." : "Post Question"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* loading skeleton */}
      {forumQuestionsQuery.isLoading && !pagination && (
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
      {forumQuestionsQuery.isSuccess && questions.length === 0 && (
        <div className="py-20 text-center">
          <p className="mb-4 text-5xl">?</p>
          <p className="text-lg font-semibold">No questions yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Be the first to ask something bussin!
          </p>
        </div>
      )}

      {/* question cards */}
      {forumQuestionsQuery.isError && (
        <div className="py-20 text-center text-destructive">
          Error loading forum:{" "}
          {forumQuestionsQuery.error instanceof Error
            ? forumQuestionsQuery.error.message
            : "Unknown error"}
        </div>
      )}

      {forumQuestionsQuery.isSuccess && questions.length > 0 && (
        <div className="space-y-4">
          {questions.map((question) => (
            <QuestionCard
              key={question.id}
              question={question}
              isExpanded={expandedId === question.id}
              onToggle={() => setExpandedId(expandedId === question.id ? null : question.id)}
              profile={profile}
              canPost={canPost}
              canModerate={canModerate}
              onboardingDone={onboardingDone}
              onError={setError}
              currentPage={page}
              pageSize={FORUM_PAGE_SIZE}
            />
          ))}

          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between rounded-xl border bg-card px-4 py-3">
              <p className="text-sm text-muted-foreground">
                Page {pagination.page + 1} of {Math.max(1, pagination.totalPages)}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((value) => Math.max(0, value - 1))}
                  disabled={page === 0}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((value) => value + 1)}
                  disabled={!pagination.hasNext}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </AppPageShell>
  );
}
