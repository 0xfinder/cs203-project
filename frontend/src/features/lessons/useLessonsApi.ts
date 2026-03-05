import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface LessonSummary {
  id: number;
  unitId: number;
  title: string;
  description: string;
  orderIndex: number;
  status: "DRAFT" | "PENDING_REVIEW" | "APPROVED" | "REJECTED";
}

export interface UnitData {
  id: number;
  title: string;
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
  stepType: "TEACH" | "QUESTION" | "DIALOGUE";
  vocab: VocabPayload | null;
  question: QuestionPayload | null;
  dialogueText: string | null;
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
}

export interface VocabMemoryItem {
  vocabItemId: number;
  term: string;
  definition: string;
  strength: number;
  correctStreak: number;
  nextDueAt: string;
}

const LESSONS_KEY = ["lessons"] as const;
const UNITS_KEY = ["units"] as const;
const PROGRESS_KEY = ["user-lesson-progress"] as const;
const VOCAB_MEMORY_KEY = ["vocab-memory"] as const;

export function useUnits() {
  return useQuery({
    queryKey: UNITS_KEY,
    queryFn: () => api.get("units").json<UnitData[]>(),
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
    enabled: Number.isFinite(lessonId),
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
    },
  });
}

export function useLessonProgress() {
  return useQuery({
    queryKey: PROGRESS_KEY,
    queryFn: () => api.get("user-lesson-progress").json<ProgressItem[]>(),
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
