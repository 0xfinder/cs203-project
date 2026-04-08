import { queryOptions } from "@tanstack/react-query";
import { api } from "@/lib/api";

export type AuthorInfo = {
  id: string | null;
  displayName: string | null;
  avatarPath: string | null;
  avatarColor: string | null;
  role: string | null;
};

export type VoteSummary = {
  thumbsUp: number;
  thumbsDown: number;
  userVote: "THUMBS_UP" | "THUMBS_DOWN" | null;
};

export type AnswerResp = {
  id: number;
  content: string;
  author: string;
  authorInfo: AuthorInfo;
  createdAt: string;
  votes: VoteSummary;
};

export type QuestionListItemResp = {
  id: number;
  title: string;
  content: string;
  author: string;
  authorInfo: AuthorInfo;
  createdAt: string;
  answerCount: number;
  votes: VoteSummary;
  resolved: boolean;
};

export type ForumQuestionPageResp = {
  items: QuestionListItemResp[];
  page: number;
  size: number;
  totalItems: number;
  totalPages: number;
  hasNext: boolean;
};

export const FORUM_QUERY_KEY = ["forum"] as const;

export function forumQuestionsQueryOptions(page: number, size: number, search?: string) {
  return queryOptions({
    queryKey: [...FORUM_QUERY_KEY, "questions", page, size, search ?? ""],
    queryFn: () =>
      api
        .get("forum/questions", {
          searchParams: {
            page,
            size,
            ...(search && search.trim() ? { q: search.trim() } : {}),
          },
        })
        .json<ForumQuestionPageResp>(),
    staleTime: 30_000,
  });
}

export function forumAnswersQueryOptions(questionId: number) {
  return queryOptions({
    queryKey: [...FORUM_QUERY_KEY, "answers", questionId],
    queryFn: () => api.get(`forum/questions/${questionId}/answers`).json<AnswerResp[]>(),
    staleTime: 30_000,
  });
}
