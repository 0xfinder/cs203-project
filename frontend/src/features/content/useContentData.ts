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

export interface PaginatedResponse<T> {
    content: T[];
    totalElements: number;
    totalPages: number;
    currentPage: number;
    pageSize: number;
}

const CONTENTS_KEY = ["contents"] as const;

export function useContents() {
    return useQuery({
        queryKey: CONTENTS_KEY,
        queryFn: () => api.get("contents/approved").json<ContentItem[]>(),
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
            api.get("contents/pending/paginated", {
                searchParams: { page, size },
            }).json<any>(),
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
            api.post("contents/submit", { json: content }).json<ContentItem>(),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: CONTENTS_KEY });
        },
    });
}

export function useApproveContent() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, reviewer, reviewComment }: { id: number; reviewer: string; reviewComment?: string }) =>
            api.put(`contents/approve/${id}`, {
                searchParams: { reviewer, ...(reviewComment ? { reviewComment } : {}) },
            }).json<ContentItem>(),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: [...CONTENTS_KEY, "pending"] });
            void queryClient.invalidateQueries({ queryKey: [...CONTENTS_KEY, "pending", "paginated"] });
            void queryClient.invalidateQueries({ queryKey: CONTENTS_KEY });
        },
    });
}

export function useRejectContent() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, reviewer, reviewComment }: { id: number; reviewer: string; reviewComment: string }) =>
            api.put(`contents/reject/${id}`, {
                searchParams: { reviewer, reviewComment },
            }).json<ContentItem>(),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: [...CONTENTS_KEY, "pending"] });
            void queryClient.invalidateQueries({ queryKey: [...CONTENTS_KEY, "pending", "paginated"] });
            void queryClient.invalidateQueries({ queryKey: CONTENTS_KEY });
        },
    });
}
