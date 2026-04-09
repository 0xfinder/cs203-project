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
  publishedAt?: string | null;
  submittedBy?: string | null;
}

export interface UnitData {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  orderIndex: number;
  lessons: LessonSummary[];
  tempKey?: string | null;
}

export interface UnitWriteInput {
  title: string;
  description?: string | null;
  orderIndex?: number;
}

export interface CreateLessonInput {
  unitId: number;
  title: string;
  description: string;
  learningObjective?: string | null;
  estimatedMinutes?: number | null;
  orderIndex?: number;
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
  questionType: "MCQ" | "MATCH" | "SHORT_ANSWER";
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

export interface LessonDetail {
  id: number;
  unitId: number;
  title: string;
  description: string;
  learningObjective: string | null;
  estimatedMinutes: number | null;
  orderIndex: number;
  status: "DRAFT" | "PENDING_REVIEW" | "APPROVED" | "REJECTED";
  reviewComment: string | null;
  publishedAt?: string | null;
  steps: LessonStepPayload[];
}

export interface LessonPatchInput {
  unitId?: number;
  title?: string;
  description?: string;
  learningObjective?: string | null;
  estimatedMinutes?: number | null;
  orderIndex?: number;
  status?: "DRAFT" | "PENDING_REVIEW" | "APPROVED" | "REJECTED";
  reviewComment?: string;
}

export interface StepWriteInput {
  orderIndex: number;
  stepType: "TEACH" | "QUESTION" | "DIALOGUE" | "RECAP";
  vocabItemId?: number | null;
  questionId?: number | null;
  questionType?: "MCQ" | "MATCH" | "SHORT_ANSWER";
  prompt?: string;
  explanation?: string | null;
  options?: string[] | null;
  correctOptionIndex?: number | null;
  acceptedAnswers?: string[] | null;
  matchPairs?: Array<{ left: string; right: string }> | null;
  dialogueText?: string | null;
  payload?: Record<string, unknown> | null;
}

export type LessonAnswer = string | Record<string, string>;

export interface AttemptResultItem {
  stepId: number;
  correct: boolean;
  submittedAnswer: LessonAnswer | null;
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

export function getLifetimeXp(progressItems: ProgressItem[] | null | undefined) {
  return (progressItems ?? []).reduce((sum, item) => sum + item.bestScore, 0);
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

export function useCreateUnit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: UnitWriteInput) => api.post("units", { json: body }).json<UnitData>(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: UNITS_KEY });
    },
  });
}

export function useUpdateUnit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ unitId, body }: { unitId: number; body: UnitWriteInput }) =>
      api.patch(`units/${unitId}`, { json: body }).json<UnitData>(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: UNITS_KEY });
    },
  });
}

export function useDeleteUnit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (unitId: number) => api.delete(`units/${unitId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: UNITS_KEY });
    },
  });
}

export function useCreateLesson() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateLessonInput) =>
      api.post("lessons", { json: body }).json<LessonDetail>(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: UNITS_KEY });
      void queryClient.invalidateQueries({ queryKey: LESSONS_KEY });
    },
  });
}

export function usePendingLessons() {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: [...LESSONS_KEY, "pending"],
    queryFn: () =>
      api.get("lessons", { searchParams: { status: "PENDING_REVIEW" } }).json<LessonSummary[]>(),
    select: (data: LessonSummary[]) => {
      try {
        const cached = queryClient.getQueryData<any>([...LESSONS_KEY, "pending"]) as
          | any[]
          | undefined;
        const raw = (() => {
          try {
            return localStorage.getItem("pendingLessonMeta");
          } catch {
            return null;
          }
        })();
        const storedMap = raw ? JSON.parse(raw) : {};

        return data.map((item) => {
          // prefer live client cache (recent submissions), then localStorage persisted metadata
          const match =
            cached && Array.isArray(cached) ? cached.find((c) => c && c.id === item.id) : undefined;
          if (match) {
            return {
              ...item,
              ...(match.firstStepType ? { firstStepType: match.firstStepType } : {}),
              ...(match.firstQuestionType ? { firstQuestionType: match.firstQuestionType } : {}),
              ...(match.firstStepPrompt ? { firstStepPrompt: match.firstStepPrompt } : {}),
            };
          }
          const stored = storedMap ? storedMap[item.id] : undefined;
          if (stored) {
            return {
              ...item,
              ...(stored.firstStepType ? { firstStepType: stored.firstStepType } : {}),
              ...(stored.firstQuestionType ? { firstQuestionType: stored.firstQuestionType } : {}),
              ...(stored.firstStepPrompt ? { firstStepPrompt: stored.firstStepPrompt } : {}),
            };
          }
          return item;
        });
      } catch {
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

export function useMyLessons(status?: "DRAFT" | "PENDING_REVIEW" | "APPROVED" | "REJECTED") {
  return useQuery({
    queryKey: [...LESSONS_KEY, "mine", status ?? "all"],
    queryFn: () =>
      api
        .get("lessons", {
          searchParams: {
            mine: true,
            ...(status ? { status } : {}),
          },
        })
        .json<LessonSummary[]>(),
  });
}

export function useLessonPlay(lessonId: number) {
  return useQuery({
    queryKey: [...LESSONS_KEY, "play", lessonId],
    queryFn: () => api.get(`lessons/${lessonId}/content`).json<LessonPlayResponse>(),
    enabled: Number.isInteger(lessonId) && lessonId > 0,
    // avoid long loading states on not-found/unauthorized responses
    retry: false,
  });
}

export function useLessonForEdit(lessonId: number) {
  return useQuery({
    queryKey: [...LESSONS_KEY, "edit", lessonId],
    queryFn: () => api.get(`lessons/${lessonId}`).json<LessonDetail>(),
    enabled: Number.isInteger(lessonId) && lessonId > 0,
    // avoid long loading states on not-found/unauthorized responses
    retry: false,
  });
}

export function usePatchLesson() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ lessonId, body }: { lessonId: number; body: LessonPatchInput }) =>
      api.patch(`lessons/${lessonId}`, { json: body }).json<LessonDetail>(),
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({ queryKey: UNITS_KEY });
      void queryClient.invalidateQueries({ queryKey: LESSONS_KEY });
      void queryClient.invalidateQueries({ queryKey: [...LESSONS_KEY, "edit", vars.lessonId] });
      void queryClient.invalidateQueries({ queryKey: [...LESSONS_KEY, "play", vars.lessonId] });
    },
  });
}

export function useSubmitLessonAttempt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      lessonId,
      startedAt,
      answers,
    }: {
      lessonId: number;
      startedAt?: string;
      answers: Array<{ stepId: number; answer: LessonAnswer }>;
    }) =>
      api
        .post("lesson-attempts", {
          json: {
            lessonId,
            startedAt,
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
      void queryClient.invalidateQueries({ queryKey: [...LESSONS_KEY, "edit", vars.lessonId] });
      void queryClient.invalidateQueries({ queryKey: [...LESSONS_KEY] });
      void queryClient.invalidateQueries({ queryKey: UNITS_KEY });
    },
  });
}

export function useCreateStep() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ lessonId, body }: { lessonId: number; body: StepWriteInput }) =>
      api.post(`lessons/${lessonId}/steps`, { json: body }).json<LessonStepPayload>(),
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({ queryKey: [...LESSONS_KEY, "play", vars.lessonId] });
      void queryClient.invalidateQueries({ queryKey: [...LESSONS_KEY, "edit", vars.lessonId] });
      void queryClient.invalidateQueries({ queryKey: [...LESSONS_KEY] });
      void queryClient.invalidateQueries({ queryKey: UNITS_KEY });
    },
  });
}

export function usePatchStep() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      lessonId,
      stepId,
      body,
    }: {
      lessonId: number;
      stepId: number;
      body: StepWriteInput;
    }) =>
      api
        .patch(`lessons/${lessonId}/steps/${stepId}`, {
          json: body,
        })
        .json<LessonStepPayload>(),
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({ queryKey: [...LESSONS_KEY, "play", vars.lessonId] });
      void queryClient.invalidateQueries({ queryKey: [...LESSONS_KEY, "edit", vars.lessonId] });
      void queryClient.invalidateQueries({ queryKey: [...LESSONS_KEY] });
      void queryClient.invalidateQueries({ queryKey: UNITS_KEY });
    },
  });
}

export function useDeleteLesson() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (lessonId: number) => api.delete(`lessons/${lessonId}`).then(() => null),
    onSuccess: (_data, lessonId) => {
      // Invalidate units and lessons queries so UI refreshes
      void queryClient.invalidateQueries({ queryKey: UNITS_KEY });
      void queryClient.invalidateQueries({ queryKey: LESSONS_KEY });
      void queryClient.invalidateQueries({ queryKey: [...LESSONS_KEY, "edit", lessonId] });
      void queryClient.invalidateQueries({ queryKey: [...LESSONS_KEY, "play", lessonId] });
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
