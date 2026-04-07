import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { CSSProperties } from "react";
import { Trophy, Flame, Star, Lock, ChevronRight, Lightbulb, Trash } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireContributorOrOnboarded } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { getUnitRoadmap, getVisibleUnits, progressMap } from "@/features/lessons/lesson-roadmap";
import { useQuery } from "@tanstack/react-query";
import { optionalCurrentUserViewQueryOptions } from "@/lib/current-user-view";
import { useLessonProgress, useUnits } from "@/features/lessons/useLessonsApi";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { UnitData } from "@/features/lessons/useLessonsApi";
import Dialog, { DialogTrigger, DialogContent, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/lessons")({
  beforeLoad: async () => {
    await requireContributorOrOnboarded();
  },
  component: LearnPage,
});

const PATH_OFFSETS = [0, -56, 0, 56] as const;
const MOBILE_PATH_OFFSET_SCALE = 0.28;

function LearnPage() {
  const { data: units, isLoading: unitsLoading, error: unitsError } = useUnits();
  const {
    data: progressItems,
    isLoading: progressLoading,
    error: progressError,
  } = useLessonProgress();

  // Keep user query hook at the top level so hooks order is stable across renders
  const currentUserViewQuery = useQuery(optionalCurrentUserViewQueryOptions());
  const profile = currentUserViewQuery.data?.profile ?? null;
  const role = profile?.role;
  const isContributor = role === "CONTRIBUTOR" || role === "ADMIN" || role === "MODERATOR";
  const isAdmin = role === "ADMIN" || role === "MODERATOR";
  const [appendedUnits, setAppendedUnits] = useState<UnitData[]>([]);
  const [newUnitTitle, setNewUnitTitle] = useState("");
  const [newUnitDesc, setNewUnitDesc] = useState("");
  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      const items: Array<UnitData & { tempKey?: string }> = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;
        if (!key.startsWith("tempUnit:")) continue;
        try {
          const raw = localStorage.getItem(key);
          if (!raw) continue;
          const parsed = JSON.parse(raw);
          const tempKey = key.replace(/^tempUnit:/, "");
          items.push({
            id: parsed.id ?? -Date.now(),
            title: parsed.title ?? "New Section",
            slug: parsed.slug ?? `temp-${tempKey}`,
            description: parsed.description ?? "Coming soon",
            orderIndex: parsed.orderIndex ?? 0,
            lessons: parsed.lessons ?? [],
            tempKey,
          } as any);
        } catch (e) {
          console.error("failed to parse appended unit from local storage:", e);
          // ignore parse error for this key
        }
      }

      if (items.length > 0) {
        setAppendedUnits(items as UnitData[]);
      }
    } catch (e) {
      console.error("failed to process operation:", e);
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      localStorage.setItem("appendedUnits", JSON.stringify(appendedUnits));
    } catch (e) {
      console.error("failed to process operation:", e);
      // ignore
    }
  }, [appendedUnits]);

  if (unitsLoading || progressLoading) {
    return (
      <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6">Loading units...</div>
    );
  }

  if (unitsError || progressError || !units) {
    return (
      <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 text-destructive sm:px-6">
        Failed to load units.
      </div>
    );
  }

  const visibleUnits = getVisibleUnits(units);
  const progressByLessonId = progressMap(progressItems);
  const completedCount = visibleUnits.filter((unit) => {
    const roadmap = getUnitRoadmap(unit, progressByLessonId, undefined, isContributor);
    return roadmap.totalLessons > 0 && roadmap.completedCount === roadmap.totalLessons;
  }).length;

  const streak = 0;
  const totalXP = (progressItems ?? []).reduce((sum, item) => sum + item.bestScore, 0);

  const isUnlocked = (index: number) => {
    if (isContributor) return true;
    if (index === 0) return true;
    const previousUnit = visibleUnits[index - 1];
    const previousRoadmap = getUnitRoadmap(previousUnit, progressByLessonId, undefined, false);
    return (
      previousRoadmap.totalLessons > 0 &&
      previousRoadmap.completedCount === previousRoadmap.totalLessons
    );
  };

  const currentUnitId = visibleUnits.find((unit, index) => {
    const unlocked = isUnlocked(index);
    const roadmap = getUnitRoadmap(unit, progressByLessonId, undefined, isContributor);
    const completed = roadmap.totalLessons > 0 && roadmap.completedCount === roadmap.totalLessons;
    return unlocked && !completed;
  })?.id;

  const queryClient = useQueryClient();

  const deleteUnit = async (id: number) => {
    // eslint-disable-next-line no-restricted-globals
    if (!window.confirm("Delete this unit? This will remove it for everyone.")) return;
    try {
      await api.delete(`units/${id}`);
      await queryClient.invalidateQueries({ queryKey: ["units"] });
    } catch (e) {
      console.error("failed to delete unit:", e);
      // eslint-disable-next-line no-restricted-globals
      alert("Failed to delete unit. Ensure you have permission and try again.");
    }
  };
  const deleteAppendedUnitById = (id: number) => {
    if (!appendedUnits || appendedUnits.length === 0) return;
    // eslint-disable-next-line no-restricted-globals
    if (!window.confirm("Remove this added section?")) return;
    setAppendedUnits((s) => {
      const toRemove = s.find((u) => u.id === id);
      try {
        const key = (toRemove as any)?.tempKey;
        if (key) localStorage.removeItem(`tempUnit:${key}`);
      } catch (e) {
        console.error("failed to remove temp unit from local storage:", e);
        // ignore
      }
      return s.filter((u) => u.id !== id);
    });
  };

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-center gap-3">
        <div className="flex items-center gap-2 rounded-full bg-orange-500/10 px-4 py-2 text-sm font-bold text-orange-600 dark:bg-orange-500/20 dark:text-orange-400">
          <Flame className="size-5" />
          <span>{streak}</span>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-yellow-500/10 px-4 py-2 text-sm font-bold text-yellow-600 dark:bg-yellow-500/20 dark:text-yellow-400">
          <Star className="size-5" />
          <span>{totalXP} XP</span>
        </div>
      </div>

      <Card className="mb-10">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Trophy className="size-5 text-chart-1" />
              <CardTitle className="text-lg">Your Progress</CardTitle>
            </div>
            <span className="text-sm font-semibold text-muted-foreground">
              {completedCount} / {visibleUnits.length} Units
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-3 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-gradient-to-r from-chart-1 to-chart-5 transition-all duration-700"
              style={{
                width: `${visibleUnits.length === 0 ? 0 : (completedCount / visibleUnits.length) * 100}%`,
              }}
            />
          </div>

          {visibleUnits.length > 0 && completedCount === visibleUnits.length && (
            <div className="mt-4 rounded-xl border-2 border-success bg-success/10 p-4 text-center">
              <p className="text-base font-bold">You completed every current unit.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <h2 className="mb-6 text-center text-2xl font-bold">Learn</h2>

      {/* Global Add Content removed — use per-unit Add Content inside each unit page */}

      <div className="relative flex flex-col items-center pb-4">
        {visibleUnits.map((unit, i) => {
          const unlocked = isUnlocked(i);
          const roadmap = getUnitRoadmap(unit, progressByLessonId, undefined, isContributor);
          const completed =
            roadmap.totalLessons > 0 && roadmap.completedCount === roadmap.totalLessons;
          const isCurrent = unit.id === currentUnitId;
          const launchLesson = roadmap.nextLesson ?? null;
          const offset = PATH_OFFSETS[i % PATH_OFFSETS.length];
          const offsetStyle = {
            "--lesson-offset-mobile": `${Math.round(offset * MOBILE_PATH_OFFSET_SCALE)}px`,
            "--lesson-offset-desktop": `${offset}px`,
          } as CSSProperties;

          const numericLessonId =
            launchLesson?.id ?? roadmap.orderedLessons[0]?.id ?? unit.lessons[0]?.id ?? null;
          const lessonIdParam = numericLessonId ? String(numericLessonId) : null;

          const wrapperClass = cn(
            "group flex w-full max-w-[19rem] items-center gap-3 rounded-2xl p-2 transition-transform duration-200 translate-x-[var(--lesson-offset-mobile)] sm:max-w-none sm:gap-5 sm:translate-x-[var(--lesson-offset-desktop)]",
            !unlocked && "pointer-events-none",
            unlocked && "hover:scale-[1.03]",
          );

          const innerContent = (
            <>
              <div
                className={cn(
                  "relative flex size-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-green-400 to-emerald-500 text-2xl shadow-lg transition-shadow duration-200 sm:size-20",
                  !unlocked && "opacity-40 saturate-0",
                  unlocked && "group-hover:shadow-xl",
                  isCurrent && "ring-4 ring-ring/50",
                )}
              >
                {unlocked ? (
                  <span className="drop-shadow">📘</span>
                ) : (
                  <Lock className="size-6 text-white/80 sm:size-8" />
                )}

                {completed && (
                  <span className="absolute -right-1 -top-1 flex size-6 items-center justify-center rounded-full bg-success text-xs font-bold text-success-foreground shadow sm:size-7 sm:text-sm">
                    ✓
                  </span>
                )}

                {isAdmin && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      void deleteUnit(unit.id);
                    }}
                    aria-label={`Delete unit ${unit.title}`}
                    title="Delete unit"
                    className="absolute -right-2 -bottom-2 flex h-7 w-7 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow hover:scale-105 transition-transform"
                  >
                    <Trash className="size-4" />
                  </button>
                )}
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3
                    className={cn(
                      "text-sm font-bold leading-tight sm:text-base",
                      !unlocked && "text-muted-foreground",
                    )}
                  >
                    {unit.title}
                  </h3>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                    #{unit.orderIndex}
                  </span>
                </div>
                <p className="mt-0.5 text-xs leading-5 text-muted-foreground sm:text-sm">
                  {unit.description}
                </p>
                <p className="mt-1 text-[11px] leading-4 text-muted-foreground/70 sm:text-xs">
                  {roadmap.completedCount}/{roadmap.totalLessons} lessons
                  {roadmap.nextLesson ? ` · Next: ${roadmap.nextLesson.title}` : ""}
                </p>
              </div>

              {unlocked && lessonIdParam && (
                <ChevronRight className="hidden size-5 shrink-0 text-muted-foreground/50 sm:block" />
              )}
            </>
          );

          return (
            <div key={unit.id} className="flex flex-col items-center">
              {i > 0 && (
                <div className="flex flex-col items-center gap-1.5 py-1">
                  <span className="block h-1.5 w-1.5 rounded-full bg-border" />
                  <span className="block h-1.5 w-1.5 rounded-full bg-border" />
                  <span className="block h-1.5 w-1.5 rounded-full bg-border" />
                </div>
              )}

              {lessonIdParam ? (
                <Link
                  to="/lesson/$lessonId"
                  params={{ lessonId: lessonIdParam }}
                  preload={false}
                  className={wrapperClass}
                  style={offsetStyle}
                >
                  {innerContent}
                </Link>
              ) : (
                <div className={wrapperClass} style={offsetStyle}>
                  {innerContent}
                </div>
              )}
            </div>
          );
        })}

        {/* appended client-side units (new sections) */}
        {appendedUnits?.map((unit, idx) => {
          const combinedIndex = (visibleUnits.length + idx) % PATH_OFFSETS.length;
          const offset = PATH_OFFSETS[combinedIndex];
          const offsetStyle = {
            "--lesson-offset-mobile": `${Math.round(offset * MOBILE_PATH_OFFSET_SCALE)}px`,
            "--lesson-offset-desktop": `${offset}px`,
          } as CSSProperties;

          const filteredLessons = (Array.isArray(unit.lessons) ? unit.lessons : []).filter(
            (l: any) => {
              const t = String(l?.title ?? "");
              const s = String(l?.slug ?? "");
              // Exclude: placeholders, "coming soon", PENDING_REVIEW lessons, and lessons being added to hardcoded subunits
              return !(
                (
                  t.startsWith("Placeholder Lesson") ||
                  s.startsWith("placeholder-") ||
                  t === "Coming soon" ||
                  l?.status === "PENDING_REVIEW" || // Hide pending review lessons
                  l?.subunitId
                ) // Hide lessons that are being added to hardcoded subunits
              );
            },
          );

          // Skip appended units with no valid lessons
          if (filteredLessons.length === 0) {
            return null;
          }

          const unitForRoadmap = { ...unit, lessons: filteredLessons } as typeof unit;
          const roadmap = getUnitRoadmap(
            unitForRoadmap,
            progressByLessonId,
            undefined,
            isContributor,
          );
          const launchLesson = roadmap.nextLesson ?? null;
          // Only use launchLesson.id if it's a positive integer (server-backed lesson), otherwise use temp- format
          const lessonParam =
            launchLesson?.id && launchLesson.id > 0
              ? String(launchLesson.id)
              : `temp-${(unit as any).tempKey}`;

          return (
            <div
              key={`app-${unit.id}`}
              data-appended-last={idx === appendedUnits.length - 1 ? "true" : undefined}
              className="flex flex-col items-center"
            >
              {/* add content buttons removed from Learn list; use unit page Add Content */}
              <div className="flex flex-col items-center gap-1.5 py-1">
                <span className="block h-1.5 w-1.5 rounded-full bg-border" />
                <span className="block h-1.5 w-1.5 rounded-full bg-border" />
                <span className="block h-1.5 w-1.5 rounded-full bg-border" />
              </div>

              <Link
                to="/lesson/$lessonId"
                params={{ lessonId: lessonParam }}
                preload={false}
                className={cn(
                  "group flex w-full max-w-[19rem] items-center gap-3 rounded-2xl p-2 transition-transform duration-200 translate-x-[var(--lesson-offset-mobile)] sm:max-w-none sm:gap-5 sm:translate-x-[var(--lesson-offset-desktop)]",
                  "hover:scale-[1.03]",
                )}
                style={offsetStyle}
              >
                <div
                  className={cn(
                    "relative flex size-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-green-400 to-emerald-500 text-2xl shadow-lg transition-shadow duration-200 sm:size-20",
                    "group-hover:shadow-xl",
                  )}
                >
                  <span className="drop-shadow">📘</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      deleteAppendedUnitById(unit.id);
                    }}
                    aria-label={`Delete added section ${unit.title}`}
                    title="Delete section"
                    className="absolute -right-2 -bottom-2 flex h-7 w-7 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow hover:scale-105 transition-transform"
                  >
                    <Trash className="size-4" />
                  </button>
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold leading-tight sm:text-base">{unit.title}</h3>
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                      #{unit.orderIndex}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs leading-5 text-muted-foreground sm:text-sm">
                    {unit.description}
                  </p>
                  <p className="mt-1 text-[11px] leading-4 text-muted-foreground/70 sm:text-xs">
                    {roadmap.completedCount}/{roadmap.totalLessons} lessons
                    {roadmap.nextLesson ? ` · Next: ${roadmap.nextLesson.title}` : " · Coming soon"}
                  </p>
                </div>

                <ChevronRight className="hidden size-5 shrink-0 text-muted-foreground/50 sm:block" />
              </Link>
            </div>
          );
        })}

        {/* single add button at end of units */}
        {isAdmin && (
          <div className="mt-6 mb-6 flex items-center justify-center">
            <div>
              <Dialog>
                <DialogTrigger asChild>
                  <button
                    type="button"
                    className="flex size-20 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:scale-105 transition-transform"
                    aria-label="Add section"
                    title="Add section"
                  >
                    <Plus className="size-5" />
                  </button>
                </DialogTrigger>

                <DialogContent
                  title="Add Section"
                  description="Create a new section (no lessons added yet)"
                >
                  <form
                    className="space-y-4"
                    onSubmit={(e) => {
                      e.preventDefault();
                    }}
                  >
                    <div>
                      <Label htmlFor="unit-title">Section title</Label>
                      <Input
                        id="unit-title"
                        name="title"
                        placeholder="e.g. Getting Started"
                        value={newUnitTitle}
                        onChange={(e) => setNewUnitTitle(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="unit-desc">Description</Label>
                      <textarea
                        id="unit-desc"
                        name="description"
                        className="w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs"
                        placeholder="Short description shown in the unit list"
                        rows={3}
                        value={newUnitDesc}
                        onChange={(e) => setNewUnitDesc(e.target.value)}
                      />
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <DialogClose asChild>
                        <Button variant="outline">Cancel</Button>
                      </DialogClose>
                      <DialogClose asChild>
                        <Button
                          onClick={() => {
                            const maxIndex = Math.max(
                              0,
                              ...visibleUnits.map((u) => u.orderIndex),
                              ...appendedUnits.map((u) => u.orderIndex),
                            );
                            const nextIndex = maxIndex + 1;
                            const tempKey = String(Date.now());
                            const newUnit: UnitData & { tempKey?: string } = {
                              id: -Date.now(),
                              title: newUnitTitle || `New Section`,
                              slug: `new-section-${nextIndex}`,
                              description: newUnitDesc || `Coming soon`,
                              orderIndex: nextIndex,
                              lessons: [],
                              tempKey,
                            } as any;

                            // store a minimal representation for the temp lesson route
                            try {
                              const payload = {
                                id: newUnit.id,
                                title: newUnit.title,
                                description: newUnit.description,
                                orderIndex: newUnit.orderIndex,
                                lessons: [],
                                steps: [],
                              };
                              localStorage.setItem(`tempUnit:${tempKey}`, JSON.stringify(payload));
                            } catch (e) {
                              console.error("failed to save new unit to local storage:", e);
                              // ignore localStorage failures
                            }

                            setAppendedUnits((s) => [...s, newUnit]);
                            // reset form
                            setNewUnitTitle("");
                            setNewUnitDesc("");
                            // scroll to the newly added unit
                            setTimeout(() => {
                              const el = document.querySelector("[data-appended-last]");
                              if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
                            }, 120);
                          }}
                        >
                          Save
                        </Button>
                      </DialogClose>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        )}
      </div>

      <Card className="mt-10 border-chart-1/20 bg-chart-1/5">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lightbulb className="size-5 text-chart-4" />
            <CardTitle className="text-base">Pro Tips</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="-mt-2 space-y-1.5 text-sm text-muted-foreground">
          <p>• Complete units in order to unlock new ones</p>
          <p>• Each unit launches the next lesson in that sequence</p>
          <p>• Your best scores and attempts still sync to your account</p>
        </CardContent>
      </Card>
    </div>
  );
}
