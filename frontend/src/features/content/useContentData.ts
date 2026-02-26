import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface ContentItem {
  id: number;
  term: string;
  definition: string;
  example?: string;
  createdAt: string;
  updatedAt: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  submittedBy: string;
  reviewedBy?: string;
  reviewComment?: string;
}

export type ContentVoteType = "THUMBS_UP" | "THUMBS_DOWN";

export interface ContentVoteSummaryResponse {
  contentId: number;
  thumbsUp: number;
  thumbsDown: number;
  userVote: ContentVoteType | null;
}

export interface ContentWithVotesResponse {
  content: ContentItem;
  thumbsUp: number;
  thumbsDown: number;
  userVote: ContentVoteType | null;
}

export interface PaginatedResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
}

const CONTENTS_KEY = ["contents"] as const;
const CONTENTS_WITH_VOTES_KEY = ["contents", "approved-with-votes"] as const;

export function useContents() {
  return useQuery({
    queryKey: CONTENTS_KEY,
    queryFn: () => api.get("contents/approved").json<ContentItem[]>(),
  });
}

export function useApprovedContentsWithVotes() {
  return useQuery({
    queryKey: CONTENTS_WITH_VOTES_KEY,
    queryFn: () => api.get("contents/approved-with-votes").json<ContentWithVotesResponse[]>(),
  });
}

export function usePendingContents() {
  return useQuery({
    queryKey: [...CONTENTS_KEY, "pending"],
    queryFn: () => api.get("contents/pending").json<ContentItem[]>(),
  });
}

export function usePendingContentsPaginated(page: number = 0, size: number = 10) {
  return useQuery({
    queryKey: [...CONTENTS_KEY, "pending", "paginated", page, size],
    queryFn: () =>
      api
        .get("contents/pending/paginated", {
          searchParams: { page, size },
        })
        .json<any>(),
  });
}

export function useContent(id: number) {
  return useQuery({
    queryKey: [...CONTENTS_KEY, id],
    queryFn: () => api.get(`contents/${id}`).json<ContentItem>(),
    enabled: id > 0,
  });
}

export function useSubmitContent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (content: Omit<ContentItem, "id" | "createdAt" | "updatedAt" | "status">) =>
      api.post("contents", { json: content }).json<ContentItem>(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CONTENTS_KEY });
      void queryClient.invalidateQueries({ queryKey: CONTENTS_WITH_VOTES_KEY });
    },
  });
}

export function useApproveContent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      reviewer,
      reviewComment,
    }: {
      id: number;
      reviewer: string;
      reviewComment?: string;
    }) =>
      api
        .put(`contents/${id}/review`, {
          searchParams: {
            reviewer,
            decision: "APPROVE",
            ...(reviewComment ? { reviewComment } : {}),
          },
        })
        .json<ContentItem>(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...CONTENTS_KEY, "pending"] });
      void queryClient.invalidateQueries({ queryKey: [...CONTENTS_KEY, "pending", "paginated"] });
      void queryClient.invalidateQueries({ queryKey: CONTENTS_KEY });
      void queryClient.invalidateQueries({ queryKey: CONTENTS_WITH_VOTES_KEY });
    },
  });
}

export function useRejectContent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      reviewer,
      reviewComment,
    }: {
      id: number;
      reviewer: string;
      reviewComment: string;
    }) =>
      api
        .put(`contents/${id}/review`, {
          searchParams: { reviewer, decision: "REJECT", reviewComment },
        })
        .json<ContentItem>(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...CONTENTS_KEY, "pending"] });
      void queryClient.invalidateQueries({ queryKey: [...CONTENTS_KEY, "pending", "paginated"] });
      void queryClient.invalidateQueries({ queryKey: CONTENTS_KEY });
      void queryClient.invalidateQueries({ queryKey: CONTENTS_WITH_VOTES_KEY });
    },
  });
}

export function useCastContentVote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ contentId, voteType }: { contentId: number; voteType: ContentVoteType }) =>
      api
        .post(`contents/${contentId}/votes`, { json: { voteType } })
        .json<ContentVoteSummaryResponse>(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CONTENTS_WITH_VOTES_KEY });
    },
  });
}

export function useClearContentVote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ contentId }: { contentId: number }) =>
      api.delete(`contents/${contentId}/votes`).json<ContentVoteSummaryResponse>(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CONTENTS_WITH_VOTES_KEY });
    },
  });
}

export function useSearchExistingTerm(term: string) {
  return useQuery({
    queryKey: [...CONTENTS_KEY, "search", term.toLowerCase()],
    queryFn: async () => {
      const contents = await api.get("contents/approved").json<ContentItem[]>();
      return contents.filter((content) =>
        content.term.toLowerCase() === term.toLowerCase()
      );
    },
    enabled: term.trim().length > 0,
  });
}
