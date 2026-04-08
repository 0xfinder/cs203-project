import type { UnitData } from "@/features/lessons/useLessonsApi";
import { CurriculumBoard } from "@/features/lessons/components/curriculum-board";

export function AdminUnitsPanel({ units }: { units: UnitData[] }) {
  return <CurriculumBoard units={units} />;
}
