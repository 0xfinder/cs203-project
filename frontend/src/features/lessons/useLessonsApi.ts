import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface LessonSummary {
  id: number;
  unitId: number;
  title: string;
  slug: string;
  description: string;
  learningObjective: string | null;
  estimatedMinutes: number | null;
  orderIndex: number;
  status: "DRAFT" | "PENDING_REVIEW" | "APPROVED" | "REJECTED";
  targetSubunitId?: number | null;
}

export interface UnitData {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  orderIndex: number;
  lessons: LessonSummary[];
}

export interface ChoicePayload {
  id: number;
  text: string;
  isCorrect: boolean | null;
  orderIndex: number;
}

export interface MatchPairPayload {
  id: number;
  left: string;
  right: string | null;
  orderIndex: number;
}

export interface QuestionPayload {
  id: number;
  questionType: "MCQ" | "CLOZE" | "MATCH" | "SHORT_ANSWER";
  prompt: string;
  explanation: string | null;
  choices: ChoicePayload[];
  matchPairs: MatchPairPayload[];
  acceptedAnswers: string[];
  shuffledRights: string[];
}

export interface VocabPayload {
  id: number;
  term: string;
  definition: string;
  exampleSentence: string | null;
  partOfSpeech: string | null;
}

export interface LessonStepPayload {
  id: number;
  orderIndex: number;
  stepType: "TEACH" | "QUESTION" | "DIALOGUE" | "RECAP";
  vocab: VocabPayload | null;
  question: QuestionPayload | null;
  dialogueText: string | null;
  payload: Record<string, unknown> | null;
}

export interface LessonPlayResponse {
  lesson: LessonSummary;
  steps: LessonStepPayload[];
}

export type LessonAnswer = string | Record<string, string>;

export interface AttemptResultItem {
  stepId: number;
  correct: boolean;
  correctAnswer: string | null;
  explanation: string | null;
}

export interface AttemptResult {
  attemptId: number;
  score: number;
  totalQuestions: number;
  correctCount: number;
  passed: boolean;
  results: AttemptResultItem[];
}

export interface ProgressItem {
  lessonId: number;
  lessonTitle: string;
  bestScore: number;
  attempts: number;
  completedAt: string | null;
  lastStepId: number | null;
}

export interface VocabMemoryItem {
  vocabItemId: number;
  term: string;
  definition: string;
  strength: number;
  correctStreak: number;
  nextDueAt: string;
}

export interface ReviseQueueItem {
  stepId: number;
  lessonId: number;
  lessonTitle: string;
  priorityReason: "recent_mistake" | "due" | "weak" | "review" | "fallback";
  question: QuestionPayload;
  payload: Record<string, unknown> | null;
}

export interface ReviseQueueResponse {
  items: ReviseQueueItem[];
  dueCount: number;
}

export interface ReviseAttemptResult {
  score: number;
  totalQuestions: number;
  correctCount: number;
  dueCount: number;
  results: AttemptResultItem[];
}

const LESSONS_KEY = ["lessons"] as const;
const UNITS_KEY = ["units"] as const;
const PROGRESS_KEY = ["user-lesson-progress"] as const;
const VOCAB_MEMORY_KEY = ["vocab-memory"] as const;
const REVISE_KEY = ["revise-queue"] as const;

export function useUnits() {
  return useQuery({
    queryKey: UNITS_KEY,
    queryFn: () => api.get("units").json<UnitData[]>(),
  });
}

export function usePendingLessons() {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: [...LESSONS_KEY, "pending"],
    queryFn: () => api.get("lessons", { searchParams: { status: "PENDING_REVIEW" } }).json<LessonSummary[]>(),
    select: (data: LessonSummary[]) => {
      try {
        const cached = queryClient.getQueryData<any>([...LESSONS_KEY, "pending"]) as any[] | undefined;
        const raw = (() => {
          try { return localStorage.getItem("pendingLessonMeta"); } catch (e) { return null; }
        })();
        const storedMap = raw ? JSON.parse(raw) : {};

        return data.map((item) => {
          // prefer live client cache (recent submissions), then localStorage persisted metadata
          const match = cached && Array.isArray(cached) ? cached.find((c) => c && c.id === item.id) : undefined;
          if (match) {
            return { ...item, ...(match.subunitTitle ? { subunitTitle: match.subunitTitle } : {}), ...(match.subunitId ? { subunitId: match.subunitId } : {}), ...(match.firstStepType ? { firstStepType: match.firstStepType } : {}), ...(match.firstQuestionType ? { firstQuestionType: match.firstQuestionType } : {}), ...(match.firstStepPrompt ? { firstStepPrompt: match.firstStepPrompt } : {}) };
          }
          const stored = storedMap ? storedMap[item.id] : undefined;
          if (stored) {
            return { ...item, ...(stored.subunitTitle ? { subunitTitle: stored.subunitTitle } : {}), ...(stored.subunitId ? { subunitId: stored.subunitId } : {}), ...(stored.firstStepType ? { firstStepType: stored.firstStepType } : {}), ...(stored.firstQuestionType ? { firstQuestionType: stored.firstQuestionType } : {}), ...(stored.firstStepPrompt ? { firstStepPrompt: stored.firstStepPrompt } : {}) };
          }
          return item;
        });
      } catch (e) {
        return data;
      }
    },
  });
}

export function useLessons(unitId?: number) {
  return useQuery({
    queryKey: [...LESSONS_KEY, unitId ?? "all"],
    queryFn: () =>
      api
        .get("lessons", {
          searchParams: unitId ? { unitId } : undefined,
        })
        .json<LessonSummary[]>(),
  });
}

export function useLessonPlay(lessonId: number) {
  return useQuery({
    queryKey: [...LESSONS_KEY, "play", lessonId],
    queryFn: () => api.get(`lessons/${lessonId}/content`).json<LessonPlayResponse>(),
    // Only fetch for positive, server-backed lesson IDs. Client-only temp lessons use negative ids
    // or `temp-` routes and should be loaded from localStorage by the route component.
    enabled: Number.isInteger(lessonId) && lessonId > 0,
    // avoid long loading states on not-found/unauthorized responses
    retry: false,
  });
}

export function useSubmitLessonAttempt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      lessonId,
      answers,
    }: {
      lessonId: number;
      answers: Array<{ stepId: number; answer: LessonAnswer }>;
    }) =>
      api
        .post("lesson-attempts", {
          json: {
            lessonId,
            answers,
          },
        })
        .json<AttemptResult>(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PROGRESS_KEY });
      void queryClient.invalidateQueries({ queryKey: VOCAB_MEMORY_KEY });
      void queryClient.invalidateQueries({ queryKey: REVISE_KEY });
    },
  });
}

export function useLessonProgress() {
  return useQuery({
    queryKey: PROGRESS_KEY,
    queryFn: () => api.get("user-lesson-progress").json<ProgressItem[]>(),
  });
}

export function useUpdateLessonProgress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ lessonId, lastStepId }: { lessonId: number; lastStepId: number }) =>
      api
        .patch(`user-lesson-progress/${lessonId}`, {
          json: { lastStepId },
        })
        .json<ProgressItem>(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PROGRESS_KEY });
    },
  });
}

export function useVocabMemoryDue(limit: number = 20) {
  return useQuery({
    queryKey: [...VOCAB_MEMORY_KEY, "due", limit],
    queryFn: () =>
      api
        .get("vocab-memory", {
          searchParams: { due: true, limit },
        })
        .json<VocabMemoryItem[]>(),
  });
}

export function useSubmitVocabMemoryAttempt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (answers: Array<{ vocabItemId: number; correct: boolean }>) =>
      api
        .post("vocab-memory-attempts", {
          json: { answers },
        })
        .json<VocabMemoryItem[]>(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: VOCAB_MEMORY_KEY });
    },
  });
}

export function useDeleteStep() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ lessonId, stepId }: { lessonId: number; stepId: number }) =>
      api.delete(`lessons/${lessonId}/steps/${stepId}`).then(() => null),
    onSuccess: (_data, vars) => {
      // invalidate the lesson play and lesson list so UI refreshes
      void queryClient.invalidateQueries({ queryKey: [...LESSONS_KEY, "play", vars.lessonId] });
      void queryClient.invalidateQueries({ queryKey: [...LESSONS_KEY] });
    },
  });
}

export function usePatchStep() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ lessonId, stepId, body }: { lessonId: number; stepId: number; body: any }) =>
      api
        .patch(`lessons/${lessonId}/steps/${stepId}`, {
          json: body,
        })
        .json(),
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({ queryKey: [...LESSONS_KEY, "play", vars.lessonId] });
      void queryClient.invalidateQueries({ queryKey: [...LESSONS_KEY] });
    },
  });
}

export function useDeleteLesson() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (lessonId: number) => api.delete(`lessons/${lessonId}`).then(() => null),
    onSuccess: () => {
      // Invalidate units and lessons queries so UI refreshes
      void queryClient.invalidateQueries({ queryKey: UNITS_KEY });
      void queryClient.invalidateQueries({ queryKey: LESSONS_KEY });
    },
  });
}

export function useReviseQueue(limit: number = 10) {
  return useQuery({
    queryKey: [...REVISE_KEY, limit],
    queryFn: () =>
      api
        .get("revise-queue", {
          searchParams: { limit },
        })
        .json<ReviseQueueResponse>(),
  });
}

export function useSubmitReviseAttempt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (answers: Array<{ stepId: number; answer: LessonAnswer }>) =>
      api
        .post("revise-attempts", {
          json: { answers },
        })
        .json<ReviseAttemptResult>(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: REVISE_KEY });
    },
  });
}

export function useApproveLesson() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reviewComment }: { id: number; reviewComment?: string }) =>
      api
        .patch(`lessons/${id}`, {
          json: { status: "APPROVED", ...(reviewComment ? { reviewComment } : {}) },
        })
        .json<LessonSummary>(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...LESSONS_KEY, "pending"] });
      void queryClient.invalidateQueries({ queryKey: [...LESSONS_KEY] });
      void queryClient.invalidateQueries({ queryKey: UNITS_KEY });
    },
  });
}

export function useRejectLesson() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reviewComment }: { id: number; reviewComment: string }) =>
      api
        .patch(`lessons/${id}`, {
          json: { status: "REJECTED", reviewComment },
        })
        .json<LessonSummary>(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...LESSONS_KEY, "pending"] });
      void queryClient.invalidateQueries({ queryKey: [...LESSONS_KEY] });
      void queryClient.invalidateQueries({ queryKey: UNITS_KEY });
    },
  });
}
