import { useEffect, useState } from "react";

export interface LessonProgress {
  completed: boolean;
  score: number;
  attempts: number;
}

export type ProgressMap = Record<string, LessonProgress>;

const STORAGE_KEYS = {
  progress: "alphaLingoProgress",
  streak: "alphaLingoStreak",
  xp: "alphaLingoTotalXP",
} as const;

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function loadInt(key: string, fallback: number): number {
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  const parsed = parseInt(raw, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

export function useLessonProgress() {
  const [progress, setProgress] = useState<ProgressMap>(() =>
    loadJson<ProgressMap>(STORAGE_KEYS.progress, {}),
  );
  const [streak, setStreak] = useState(() => loadInt(STORAGE_KEYS.streak, 0));
  const [totalXP, setTotalXP] = useState(() => loadInt(STORAGE_KEYS.xp, 0));

  // persist changes to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.progress, JSON.stringify(progress));
  }, [progress]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.streak, String(streak));
  }, [streak]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.xp, String(totalXP));
  }, [totalXP]);

  return { progress, setProgress, streak, setStreak, totalXP, setTotalXP };
}
