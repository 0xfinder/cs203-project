import type { LessonSummary, ProgressItem, UnitData } from "@/features/lessons/useLessonsApi";

export type LessonRoadmapItem = {
  lesson: LessonSummary;
  completed: boolean;
  unlocked: boolean;
  current: boolean;
};

export function sortUnits(units: UnitData[]) {
  return [...units].sort((left, right) => left.orderIndex - right.orderIndex);
}

export function sortLessons(lessons: LessonSummary[]) {
  return [...lessons].sort((left, right) => left.orderIndex - right.orderIndex);
}

export function progressMap(progressItems?: ProgressItem[]) {
  return new Map(progressItems?.map((item) => [item.lessonId, item]) ?? []);
}

export function getUnitRoadmap(
  unit: UnitData,
  progressByLessonId: Map<number, ProgressItem>,
  currentLessonId?: number,
  allowAllUnlocked = false,
) {
  const orderedLessons = Array.isArray(unit.lessons) ? sortLessons(unit.lessons) : [];
  let previousCompleted = true;

  const items: LessonRoadmapItem[] = orderedLessons.map((lesson) => {
    const completed = progressByLessonId.get(lesson.id)?.completedAt != null;
    const unlocked = previousCompleted || allowAllUnlocked;
    const current = currentLessonId === lesson.id;
    previousCompleted = previousCompleted && completed;
    return {
      lesson,
      completed,
      unlocked,
      current,
    };
  });

  const completedCount = items.filter((item) => item.completed).length;
  const nextLesson =
    items.find((item) => item.unlocked && !item.completed)?.lesson ??
    items[items.length - 1]?.lesson ??
    null;

  return {
    orderedLessons,
    items,
    completedCount,
    totalLessons: orderedLessons.length,
    percentComplete:
      orderedLessons.length === 0 ? 0 : Math.round((completedCount / orderedLessons.length) * 100),
    nextLesson,
  };
}

export function getVisibleUnits(units: UnitData[]) {
  // Only consider approved lessons as part of the visible roadmap so that
  // newly-submitted (PENDING_REVIEW) lessons do not immediately appear
  // in the Learn view. Return shallow-copies of units with their lessons
  // filtered to approved status.
  return sortUnits(units)
    .map((unit) => ({
      ...unit,
      lessons: (Array.isArray(unit.lessons) ? unit.lessons : []).filter(
        (l: any) => l.status === "APPROVED",
      ),
    }))
    .filter((unit) => Array.isArray(unit.lessons) && unit.lessons.length > 0);
}

export function findUnitByLessonId(units: UnitData[], lessonId: number) {
  return (
    getVisibleUnits(units).find((unit) => unit.lessons.some((lesson) => lesson.id === lessonId)) ??
    null
  );
}
