import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { HTTPError } from "ky";
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import Dialog, { DialogTrigger, DialogContent, DialogClose } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { UnitRoadmap } from "@/features/lessons/components/unit-roadmap";
import { findUnitByLessonId, getUnitRoadmap, progressMap } from "@/features/lessons/lesson-roadmap";
import { requireOnboardingCompleted, requireContributorOrOnboarded } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { optionalCurrentUserViewQueryOptions } from "@/lib/current-user-view";
import { api } from "@/lib/api";
import { useSubmitContent } from "@/features/content/useContentData";
import {
  type AttemptResult,
  type LessonAnswer,
  type LessonStepPayload,
  useLessonPlay,
  useLessonProgress,
  useUpdateLessonProgress,
  useSubmitLessonAttempt,
  useUnits,
  useDeleteStep,
  usePatchStep,
  useDeleteLesson,
} from "@/features/lessons/useLessonsApi";
import { QuestionStep } from "@/features/lessons/components/question-step";
import { LessonForm } from "@/components/lesson-quiz-forms";

export const Route = createFileRoute("/lesson/$lessonId")({
  beforeLoad: async () => {
    await requireContributorOrOnboarded();
  },
  component: LessonPage,
});

function LessonPage() {
  const navigate = useNavigate();
  const { lessonId } = Route.useParams();
  const numericLessonId = Number(lessonId);
  const isTempLesson = typeof lessonId === "string" && lessonId.startsWith("temp-");
  // valid if: positive integer (server lesson), temp- route, or negative integer (client-side lesson in temp unit)
  const hasValidLessonId = Number.isInteger(numericLessonId) || isTempLesson;

  const { data, isLoading, error } = useLessonPlay(numericLessonId);
  const { data: units, refetch: refetchUnits } = useUnits();
  const { data: progressItems } = useLessonProgress();
  const submitAttempt = useSubmitLessonAttempt();
  const updateProgress = useUpdateLessonProgress();
  const deleteLesson = useDeleteLesson();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answersByStep, setAnswersByStep] = useState<Record<number, LessonAnswer>>({});
  const [tempAnswer, setTempAnswer] = useState<LessonAnswer>("");
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const progressThrottleMs = 1200;
  const lastProgressSentAtRef = useRef(0);
  const pendingProgressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resumeAppliedRef = useRef(false);
  const [tempRefresh, setTempRefresh] = useState(0);

  useEffect(() => {
    setCurrentIndex(0);
    setAnswersByStep({});
    setTempAnswer("");
    setResult(null);
    setSubmitError(null);
    lastProgressSentAtRef.current = 0;
    resumeAppliedRef.current = false;
    if (pendingProgressTimerRef.current) {
      clearTimeout(pendingProgressTimerRef.current);
      pendingProgressTimerRef.current = null;
    }
  }, [numericLessonId]);

  useEffect(() => {
    return () => {
      if (pendingProgressTimerRef.current) {
        clearTimeout(pendingProgressTimerRef.current);
        pendingProgressTimerRef.current = null;
      }
    };
  }, []);

  // Listen for appended lessons changes (e.g., when rejected from review page)
  useEffect(() => {
    const handleAppendedLessonsChanged = () => {
      // Refresh tempData when appended units are modified
      setTempRefresh((v) => v + 1);
    };
    window.addEventListener("appended-lessons-changed", handleAppendedLessonsChanged);
    
    // Also listen for steps being added (from approval)
    const handleStepsAdded = () => {
      // Refresh tempData to re-read steps from localStorage
      setTempRefresh((v) => v + 1);
    };
    window.addEventListener("tempUnit-steps-added", handleStepsAdded);
    
    // Also listen for steps being deleted
    const handleStepDeleted = () => {
      // Refresh tempData to re-read steps from localStorage
      setTempRefresh((v) => v + 1);
    };
    window.addEventListener("tempUnit-step-deleted", handleStepDeleted);
    
    return () => {
      window.removeEventListener("appended-lessons-changed", handleAppendedLessonsChanged);
      window.removeEventListener("tempUnit-steps-added", handleStepsAdded);
      window.removeEventListener("tempUnit-step-deleted", handleStepDeleted);
    };
  }, []);

  // Refresh when page becomes visible (e.g. user switches tabs and returns)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Page is now visible - refresh appended unit data
        setTempRefresh((v) => v + 1);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  // If this route is a temp lesson (created client-side), load placeholder data from localStorage
  const tempData = useMemo(() => {
    try {
      // Case 1: temp-<key> route — load the unit itself as the lesson
      if (isTempLesson) {
        const key = String(lessonId).slice(5);
        const raw = typeof window !== "undefined" ? localStorage.getItem(`tempUnit:${key}`) : null;
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return {
          lesson: { title: parsed.title ?? "New Section" },
          steps: parsed.steps ?? [],
          unit: parsed,
        };
      }

      // Case 2: negative numeric ID — search all tempUnit:* entries for a lesson with this ID
      if (numericLessonId < 0 && typeof window !== "undefined") {
        console.log("[tempData lookup] Searching for lesson with ID:", numericLessonId);
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i) || "";
          if (!key.startsWith("tempUnit:")) continue;
          try {
            const raw = localStorage.getItem(key);
            if (!raw) continue;
            const parsed = JSON.parse(raw);
            // Search lessons array for a lesson with this ID
            const lessonsArray = Array.isArray(parsed.lessons) ? parsed.lessons : [];
            const foundLesson = lessonsArray.find((l: any) => l?.id === numericLessonId);
            if (foundLesson) {
              console.log("[tempData lookup] Found lesson:", foundLesson.title, "in", key);
              // Steps can be stored either:
              // 1. On the lesson object itself (foundLesson.steps)
              // 2. In the unit's steps array with step.id matching the lesson ID
              // 3. In the unit's steps array with step.targetSubunitId matching the lesson ID (after approval)
              let stepsArray = Array.isArray(foundLesson.steps) ? foundLesson.steps : [];
              console.log("[tempData lookup] Steps on lesson object:", stepsArray.length);
              
              // If no steps on lesson, look in unit's steps array by matching lesson ID or targetSubunitId
              if (stepsArray.length === 0) {
                const unitSteps = Array.isArray(parsed.steps) ? parsed.steps : [];
                console.log("[tempData lookup] Unit has", unitSteps.length, "total steps with:", unitSteps.map((s: any) => ({ id: s?.id, targetSubunitId: s?.targetSubunitId, orderIndex: s?.orderIndex })));
                console.log("[tempData lookup] Looking for steps with id===", numericLessonId, 'or targetSubunitId===', numericLessonId);
                stepsArray = unitSteps.filter((s: any) => {
                  const matchesId = s?.id === numericLessonId;
                  const matchesTargetSubunitId = s?.targetSubunitId === numericLessonId;
                  const matches = matchesId || matchesTargetSubunitId;
                  console.log("[tempData lookup]   Step id:", s?.id, "targetSubunitId:", s?.targetSubunitId, "matchesId:", matchesId, "matchesTargetSubunitId:", matchesTargetSubunitId, "→", matches ? "MATCH" : "no match");
                  return matches;
                });
                console.log("[tempData lookup] Found", stepsArray.length, "matching steps");
              }
              
              console.log("[tempData lookup] Returning tempData with", stepsArray.length, "steps");
              return {
                lesson: foundLesson,
                steps: stepsArray,
                unit: parsed,
              };
            }
          } catch (e) {
            // ignore parse errors
          }
        }
      }
    } catch (e) {
      // ignore
    }
    return null;
  }, [lessonId, numericLessonId, isTempLesson, tempRefresh]);

  const effectiveData: any = tempData ?? data;
  const effectiveSteps = effectiveData?.steps ?? [];
  
  // Auto-navigate to first subunit when opening appended unit
  useEffect(() => {
    if (isTempLesson && tempData?.unit) {
      const lessons = Array.isArray(tempData.unit.lessons) ? tempData.unit.lessons : [];
      // If unit has subunits and we're not already viewing one, navigate to first subunit
      if (lessons.length > 0) {
        const firstSubunit = lessons[0];
        if (firstSubunit?.id) {
          // Navigate to first subunit
          navigate({ to: `/lesson/${firstSubunit.id}` });
        }
      }
    }
  }, [isTempLesson, tempData?.unit?.lessons?.length, navigate]);
  
  // Filter out placeholder steps (marked with __placeholder flag when creating new subunits)
  const steps = effectiveSteps.filter((step: any) => !step.__placeholder);
  
  const currentStep = steps[currentIndex];
  const questionSteps = useMemo(
    () => steps.filter((step) => step.stepType === "QUESTION"),
    [steps],
  );
  const progressByLessonId = useMemo(() => progressMap(progressItems), [progressItems]);
  const currentUnit = useMemo(
    () => {
      // If we have tempData (either from temp-<key> route or negative ID within temp unit), use it
      if (tempData?.unit) return tempData.unit;
      // Otherwise for positive server IDs, find the unit from the server list
      // We search through units directly (not getVisibleUnits) to show all lessons including DRAFT
      if (!units) return null;
      return units.find((unit) => unit.lessons?.some((lesson) => lesson.id === numericLessonId)) ?? null;
    },
    [units, numericLessonId, tempData],
  );
  const displayUnit = useMemo(() => {
    if (!currentUnit) return null;
    // Filter for temp units: only show placeholder subunits and approved lessons in sidebar
    // Hide submitted content (DRAFT, PENDING_REVIEW, REJECTED) until it's approved
    if (tempData?.unit) {
      const lessons = Array.isArray(currentUnit.lessons) ? currentUnit.lessons : [];
      const isPlaceholder = (lesson: any) => {
        const title = String(lesson?.title ?? "");
        const slug = String(lesson?.slug ?? "");
        const description = String(lesson?.description ?? "");
        return (
          title.startsWith("Placeholder Lesson") ||
          slug.startsWith("placeholder-") ||
          title === "Coming soon" ||
          title.startsWith("New Lesson") ||
          slug.startsWith("new-lesson-") ||
          description === "Coming soon"
        );
      };
      const filtered = lessons.filter((l: any) => {
        // Show if it's a placeholder subunit OR if it's approved
        if (isPlaceholder(l)) return true;
        // Hide lessons that are wrappers for adding to specific subunits (targetSubunitId set)
        if (l.targetSubunitId) return false;
        if (l.status === "APPROVED") return true;
        // Hide anything else (DRAFT, PENDING_REVIEW, REJECTED)
        if (l.status === "DRAFT" || l.status === "PENDING_REVIEW" || l.status === "REJECTED") return false;
        return true;
      });
      return filtered.length > 0 ? ({ ...currentUnit, lessons: filtered } as typeof currentUnit) : ({ ...currentUnit, lessons: [] } as typeof currentUnit);
    }
    
    // Also filter server units: hide DRAFT/PENDING_REVIEW/REJECTED lessons from sidebar
    const lessons = Array.isArray(currentUnit?.lessons) ? currentUnit.lessons : [];
    const isPlaceholder = (lesson: any) => {
      const title = String(lesson?.title ?? "");
      const slug = String(lesson?.slug ?? "");
      const description = String(lesson?.description ?? "");
      return (
        title.startsWith("Placeholder Lesson") ||
        slug.startsWith("placeholder-") ||
        title === "Coming soon" ||
        title.startsWith("New Lesson") ||
        slug.startsWith("new-lesson-") ||
        description === "Coming soon"
      );
    };
    const filtered = lessons.filter((l: any) => {
      // Show placeholder subunits
      if (isPlaceholder(l)) return true;
      // Hide lessons that are wrappers for adding to specific subunits (targetSubunitId set)
      if (l.targetSubunitId) return false;
      // Show approved/published lessons, hide DRAFT/PENDING_REVIEW/REJECTED
      if (l.status === "DRAFT" || l.status === "PENDING_REVIEW" || l.status === "REJECTED") return false;
      // Show everything else (published, approved, etc.)
      return true;
    });
    
    return filtered.length > 0 ? ({ ...currentUnit, lessons: filtered } as typeof currentUnit) : ({ ...currentUnit, lessons: [] } as typeof currentUnit);
  }, [currentUnit, tempData]);
  
  // Debug: log displayUnit vs currentUnit
  useEffect(() => {
    if (currentUnit?.id && currentUnit.id < 0) {
      console.log("DEBUG displayUnit lessons:", displayUnit?.lessons?.map((l: any) => ({ id: l.id, title: l.title, status: l.status })));
      console.log("DEBUG currentUnit lessons:", currentUnit?.lessons?.map((l: any) => ({ id: l.id, title: l.title, status: l.status })));
    }
  }, [displayUnit, currentUnit]);
  
  const unitRoadmap = useMemo(
    () => (displayUnit ? getUnitRoadmap(displayUnit, progressByLessonId, numericLessonId) : null),
    [displayUnit, progressByLessonId, numericLessonId],
  );

  // Debug effect: log whenever displayUnit or currentUnit changes
  useEffect(() => {
    if (currentUnit?.id && currentUnit.id < 0) {
      console.log("DEBUG: Viewing temp/appended unit with ID:", currentUnit.id, "lessons:", currentUnit.lessons?.length);
    }
  }, [currentUnit]);

  const nextLesson = useMemo(() => {
    if (!unitRoadmap) {
      return null;
    }

    const currentLessonIndex = unitRoadmap.orderedLessons.findIndex(
      (lesson) => lesson.id === numericLessonId,
    );

    if (currentLessonIndex < 0) {
      return null;
    }

    return unitRoadmap.orderedLessons[currentLessonIndex + 1] ?? null;
  }, [unitRoadmap, numericLessonId]);

  // current user view (to check role for appeal permissions)
  const currentUserViewQuery = useQuery(optionalCurrentUserViewQueryOptions());
  const currentProfile = currentUserViewQuery.data?.profile ?? null;
  const isContributor =
    currentProfile?.role === "CONTRIBUTOR";
  const isAdmin =
    currentProfile?.role === "ADMIN" || currentProfile?.role === "MODERATOR";

  const [appealOpen, setAppealOpen] = useState(false);
  const [appealText, setAppealText] = useState("");
  const [appealSubmitting, setAppealSubmitting] = useState(false);
  const [appealError, setAppealError] = useState<string | null>(null);
  const submitContent = useSubmitContent();
  const [addTitle, setAddTitle] = useState("");
  const [addDesc, setAddDesc] = useState("");

  const deleteTempLesson = (lessonIdToDelete: number) => {
    try {
      // Confirm deletion with the user
      // eslint-disable-next-line no-restricted-globals
      if (!window.confirm("Delete this subunit? This cannot be undone.")) return;

      // If lessonIdToDelete is positive, it's a server-side lesson - delete via API
      if (lessonIdToDelete > 0) {
        deleteLesson.mutateAsync(lessonIdToDelete).then(() => {
          // Refetch to update the UI
          void refetchUnits();
          if (lessonIdToDelete === numericLessonId) {
            navigate({ to: "/lessons" });
          }
        });
        return;
      }

      // If we're viewing a temp unit route (temp-<key>), remove directly from that key.
      if (isTempLesson) {
        const key = String(lessonId).slice(5);
        const raw = localStorage.getItem(`tempUnit:${key}`);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        parsed.lessons = (parsed.lessons || []).filter((l: any) => l.id !== lessonIdToDelete);
        // Delete steps that belong to this lesson (either by id or targetSubunitId)
        parsed.steps = (parsed.steps || []).filter((s: any) => s.id !== lessonIdToDelete && s.targetSubunitId !== lessonIdToDelete);
        localStorage.setItem(`tempUnit:${key}`, JSON.stringify(parsed));
        setTempRefresh((v) => v + 1);
        if (lessonIdToDelete === numericLessonId) {
          navigate({ to: "/lessons" });
        }
        return;
      }

      // Otherwise, search all tempUnit:* entries for the lesson id and remove it if found.
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i) || "";
        if (!key.startsWith("tempUnit:")) continue;
        try {
          const raw = localStorage.getItem(key);
          if (!raw) continue;
          const parsed = JSON.parse(raw);
          const before = (parsed.lessons || []).length;
          parsed.lessons = (parsed.lessons || []).filter((l: any) => l.id !== lessonIdToDelete);
          // Delete steps that belong to this lesson (either by id or targetSubunitId)
          parsed.steps = (parsed.steps || []).filter((s: any) => s.id !== lessonIdToDelete && s.targetSubunitId !== lessonIdToDelete);
          const after = (parsed.lessons || []).length;
          if (after !== before) {
            localStorage.setItem(key, JSON.stringify(parsed));
            setTempRefresh((v) => v + 1);
            return;
          }
        } catch (e) {
          // ignore parse errors
        }
      }

      // If not found in tempUnit:*, try to delete from tempPlaceholderUnit:* entries
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i) || "";
        if (!key.startsWith("tempPlaceholderUnit:")) continue;
        try {
          const raw = localStorage.getItem(key);
          if (!raw) continue;
          const parsed = JSON.parse(raw);
          if (parsed.id === lessonIdToDelete) {
            localStorage.removeItem(key);
            setTempRefresh((v) => v + 1);
            return;
          }
        } catch (e) {
          // ignore parse errors
        }
      }
    } catch (e) {
      // ignore
    }
  };

  const submitAppeal = async () => {
    if (!appealText.trim() || !currentProfile) return;
    setAppealSubmitting(true);
    setAppealError(null);
    try {
      const title = `Appeal: Lesson ${numericLessonId} - ${effectiveData?.lesson?.title ?? ""}`;
      const payload = {
        term: title.slice(0, 100),
        definition: appealText.trim().slice(0, 500),
        example: null,
      };
      await submitContent.mutateAsync(payload);
      setAppealOpen(false);
      setAppealText("");
    } catch (err) {
      setAppealError(err instanceof Error ? err.message : "Failed to submit appeal");
    } finally {
      setAppealSubmitting(false);
    }
  };

  useEffect(() => {
    if (!currentStep || currentStep.stepType !== "QUESTION") {
      setTempAnswer("");
      return;
    }

    const existingAnswer = answersByStep[currentStep.id];
    if (existingAnswer !== undefined) {
      setTempAnswer(existingAnswer);
      return;
    }

    if (currentStep.question?.questionType === "MATCH") {
      setTempAnswer({});
      return;
    }

    setTempAnswer("");
  }, [currentStep, answersByStep]);

  useEffect(() => {
    if (resumeAppliedRef.current) {
      return;
    }
    // don't attempt resume for client-only temp lessons (either temp-<key> route or negative ID in temp unit)
    if (tempData) {
      resumeAppliedRef.current = true;
      return;
    }
    if (!data || effectiveSteps.length === 0) {
      return;
    }

    const progressItem = progressItems?.find((item) => item.lessonId === numericLessonId);
    if (!progressItem?.lastStepId || progressItem.completedAt) {
      resumeAppliedRef.current = true;
      return;
    }

    const lastStepIndex = effectiveSteps.findIndex((step) => step.id === progressItem.lastStepId);
    if (lastStepIndex < 0) {
      resumeAppliedRef.current = true;
      return;
    }

    const resumeIndex = Math.min(lastStepIndex + 1, effectiveSteps.length - 1);
    setCurrentIndex(resumeIndex);
    resumeAppliedRef.current = true;
  }, [tempData, data, effectiveSteps, progressItems, numericLessonId]);

  if (!hasValidLessonId) {
    return (
      <div className="flex flex-1 items-center justify-center bg-background px-4">
        <div className="text-center">
          <p className="text-xl text-muted-foreground">Invalid lesson ID</p>
          <Button className="mt-4" onClick={() => navigate({ to: "/lessons" })}>
            Back to Learn
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading && !tempData) {
    return <div className="p-8 text-center">Loading lesson...</div>;
  }

  if (!effectiveData) {
    return (
      <div className="flex flex-1 items-center justify-center bg-background px-4">
        <div className="text-center">
          <p className="text-xl text-muted-foreground">Lesson not found</p>
          <Button className="mt-4" onClick={() => navigate({ to: "/lessons" })}>
            Back to Learn
          </Button>
        </div>
      </div>
    );
  }

    // For temp units we will render Add Content inside the normal page layout below

  if (!currentStep) {
    // For temp units show Add Content UI in the main pane while preserving the sidebar/header
    if (tempData) {
      return (
        <div className="flex flex-1 flex-col bg-background">
          <div className="border-b bg-card/60 backdrop-blur">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate({ to: "/lessons" })}
                  className="gap-1.5"
                >
                  <ArrowLeft className="size-4" />
                  Exit
                </Button>
              </div>
              <div className="text-right">
                {currentUnit ? (
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    {currentUnit.title}
                  </p>
                ) : null}
                <span className="text-sm font-semibold text-muted-foreground">0 / 0</span>
              </div>
            </div>
            <div className="mx-auto max-w-6xl px-4 pb-3">
              <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                <div className="h-full rounded-full bg-gradient-to-r from-chart-1 to-chart-5" style={{ width: `0%` }} />
              </div>
            </div>
          </div>

          <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 lg:py-10">
            <div className="grid gap-8 lg:grid-cols-[320px_minmax(0,1fr)]">
              {currentUnit ? (
                <aside className="hidden lg:block">
                  <div className="sticky top-6">
                    <UnitRoadmap
                      unit={displayUnit ?? currentUnit}
                      progressItems={progressItems}
                      currentLessonId={numericLessonId}
                      title="Unit Lessons"
                      interactive
                      allowAllUnlocked={isContributor || isAdmin}
                      onDeleteLesson={deleteTempLesson}
                      headerAction={
                        (isContributor || isAdmin) ? (
                          <div className="flex gap-2">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="default">Add Content</Button>
                              </DialogTrigger>
                              <DialogContent title="Add Content" description="Create a lesson for this section" className="max-w-2xl max-h-[90vh] overflow-y-auto">
                                <LessonForm defaultUnitId={currentUnit?.id ?? undefined} setTempRefresh={setTempRefresh} />
                              </DialogContent>
                            </Dialog>
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="default">Add Subunit</Button>
                              </DialogTrigger>
                              <DialogContent title="Add Subunit" description="Create a lesson under this section">
                              <div className="space-y-3">
                                <div>
                                  <Label htmlFor="add-lesson-title">Subunit title</Label>
                                  <Input id="add-lesson-title" value={addTitle} onChange={(e) => setAddTitle(e.target.value)} />
                                </div>
                                <div>
                                  <Label htmlFor="add-lesson-desc">Description</Label>
                                  <Input id="add-lesson-desc" value={addDesc} onChange={(e) => setAddDesc(e.target.value)} />
                                </div>
                                <div className="flex justify-end gap-2">
                                  <DialogClose asChild>
                                    <Button variant="outline">Cancel</Button>
                                  </DialogClose>
                                  <DialogClose asChild>
                                    <Button
                                      onClick={async () => {
                                        try {
                                          if (isTempLesson) {
                                            const key = String(lessonId).slice(5);
                                            const raw = localStorage.getItem(`tempUnit:${key}`);
                                            const parsed = raw ? JSON.parse(raw) : { id: -(Date.now()), title: effectiveData?.lesson?.title ?? "New Section", description: effectiveData?.lesson?.description ?? null, orderIndex: 0, lessons: [], steps: [] };
                                            const nextIndex = (parsed.lessons?.length ?? 0) + 1;
                                            const newLesson = {
                                              id: -(Date.now()),
                                              unitId: parsed.id,
                                              title: addTitle || `New Lesson ${nextIndex}`,
                                              slug: `new-lesson-${nextIndex}`,
                                              description: addDesc || "Coming soon",
                                              learningObjective: null,
                                              estimatedMinutes: null,
                                              orderIndex: nextIndex,
                                              status: "DRAFT",
                                            };
                                            parsed.lessons = parsed.lessons ?? [];
                                            parsed.lessons.push(newLesson);
                                            parsed.steps = parsed.steps ?? [];
                                            parsed.steps.push({
                                              id: newLesson.id,
                                              orderIndex: newLesson.orderIndex,
                                              stepType: "TEACH",
                                              vocab: { term: newLesson.title, definition: newLesson.description, exampleSentence: null, partOfSpeech: null },
                                              question: null,
                                              dialogueText: null,
                                              payload: null,
                                              __placeholder: true,
                                            });
                                            localStorage.setItem(`tempUnit:${key}`, JSON.stringify(parsed));
                                            setTempRefresh((v) => v + 1);
                                          } else if (currentUnit?.id && currentUnit.id < 0) {
                                          const nextIndex = (currentUnit.lessons?.length ?? 0) + 1;
                                          const newLesson = {
                                            id: -(Date.now()),
                                            unitId: currentUnit.id,
                                            title: addTitle || `New Lesson ${nextIndex}`,
                                            slug: `new-lesson-${nextIndex}`,
                                            description: addDesc || "Coming soon",
                                            learningObjective: null,
                                            estimatedMinutes: null,
                                            orderIndex: nextIndex,
                                            status: "DRAFT",
                                          };
                                          const tempKey = currentUnit.id;
                                          const raw = localStorage.getItem(`tempPlaceholderUnit:${tempKey}`);
                                          const parsed = raw ? JSON.parse(raw) : { ...currentUnit, lessons: [], steps: [] };
                                          parsed.lessons = (parsed.lessons ?? []).concat(newLesson);
                                          parsed.steps = (parsed.steps ?? []).concat({
                                            id: newLesson.id,
                                            orderIndex: newLesson.orderIndex,
                                            stepType: "TEACH",
                                            vocab: { term: newLesson.title, definition: newLesson.description, exampleSentence: null, partOfSpeech: null },
                                            question: null,
                                            dialogueText: null,
                                            payload: null,
                                            __placeholder: true,
                                          });
                                          localStorage.setItem(`tempPlaceholderUnit:${tempKey}`, JSON.stringify(parsed));
                                          setTempRefresh((v) => v + 1);
                                          } else {
                                          // Submit to lessons API for real units
                                          const finalTitle = (addTitle || "").trim() || "New Lesson";
                                          const finalDesc = (addDesc || "").trim() || "Coming soon";
                                          await api.post("lessons", {
                                            json: {
                                              unitId: currentUnit?.id,
                                              title: finalTitle.slice(0, 100),
                                              description: finalDesc.slice(0, 500),
                                              learningObjective: null,
                                              estimatedMinutes: null,
                                              targetSubunitId: currentUnit?.id,
                                            },
                                          });
                                          // Refetch units to show new lesson
                                          await refetchUnits();
                                          setTempRefresh((v) => v + 1);
                                          }
                                          setAddTitle("");
                                          setAddDesc("");
                                        } catch (e) {
                                          alert(`Error adding subunit: ${e instanceof Error ? e.message : String(e)}`);
                                        }
                                      }}
                                    >
                                      Save
                                    </Button>
                                  </DialogClose>
                                </div>
                              </div>
                            </DialogContent>
                            </Dialog>
                          </div>
                        ) : null
                      }
                      onDeleteLesson={deleteTempLesson}
                    />
                  </div>
                </aside>
              ) : null}

              <div className="min-w-0">
                <div className="mx-auto w-full max-w-2xl">
                  <h1 className="mb-2 text-lg font-semibold text-muted-foreground">
                    {effectiveData?.lesson?.title}
                  </h1>

                  <div className="relative">
                    <Card className="border-chart-1/30 bg-chart-1/5">
                      <CardContent className="pt-6 text-center">
                        <h2 className="text-xl font-semibold">This section has no published steps</h2>
                        <p className="mt-2 text-sm text-muted-foreground">Add lessons or quizzes to populate this section.</p>
                        <div className="mt-6">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button size="lg">Add Content</Button>
                            </DialogTrigger>
                            <DialogContent title="Add Content" description="Create a lesson or quiz for this section">
                                  <LessonForm defaultUnitId={currentUnit?.id ?? undefined} setTempRefresh={setTempRefresh} />
                            </DialogContent>
                          </Dialog>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-1 items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <h2 className="text-xl font-semibold">Lesson Content Coming Soon</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              This lesson exists, but no steps have been published yet.
            </p>
            <Button className="mt-4" onClick={() => navigate({ to: "/lessons" })}>
              Back to Learn
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (result) {
    return (
      <ResultView
        result={result}
        lessonTitle={effectiveData?.lesson?.title ?? ""}
        unitTitle={currentUnit?.title ?? null}
        nextLessonTitle={result.passed ? (nextLesson?.title ?? null) : null}
        onRetry={() => {
          setCurrentIndex(0);
          setAnswersByStep({});
          setTempAnswer("");
          setResult(null);
          setSubmitError(null);
        }}
        onExit={() => navigate({ to: "/lessons" })}
        onContinue={
          result.passed && nextLesson && !isAdmin && !isContributor
            ? () =>
                navigate({ to: "/lesson/$lessonId", params: { lessonId: String(nextLesson.id) } })
            : undefined
                      }
                      onDeleteLesson={deleteTempLesson}
      />
    );
  }

  const isLast = currentIndex === steps.length - 1;
  const progressPercent = ((currentIndex + 1) / steps.length) * 100;

  const canContinue = (() => {
    if (currentStep.stepType !== "QUESTION") return true;
    if (currentStep.question?.questionType === "MATCH") {
      if (typeof tempAnswer === "string") return false;
      const requiredPairs = currentStep.question.matchPairs.length;
      const filled = currentStep.question.matchPairs.filter((pair) => {
        const value = tempAnswer[pair.left];
        return typeof value === "string" && value.trim().length > 0;
      }).length;
      return requiredPairs > 0 && filled === requiredPairs;
    }
    return typeof tempAnswer === "string" && tempAnswer.trim().length > 0;
  })();

  const persistCurrentAnswer = () => {
    if (currentStep.stepType !== "QUESTION") return;
    const normalizedAnswer = typeof tempAnswer === "string" ? tempAnswer.trim() : tempAnswer;
    setAnswersByStep((prev) => ({
      ...prev,
      [currentStep.id]: normalizedAnswer,
    }));
  };

  const queueProgressUpdate = (lastStepId: number) => {
    const now = Date.now();
    const elapsedMs = now - lastProgressSentAtRef.current;

    const send = () => {
      lastProgressSentAtRef.current = Date.now();
      updateProgress.mutate({ lessonId: numericLessonId, lastStepId });
    };

    if (elapsedMs >= progressThrottleMs) {
      if (pendingProgressTimerRef.current) {
        clearTimeout(pendingProgressTimerRef.current);
        pendingProgressTimerRef.current = null;
      }
      send();
      return;
    }

    if (pendingProgressTimerRef.current) {
      clearTimeout(pendingProgressTimerRef.current);
    }

    pendingProgressTimerRef.current = setTimeout(() => {
      send();
      pendingProgressTimerRef.current = null;
    }, progressThrottleMs - elapsedMs);
  };

  const goNext = async () => {
    if (!canContinue) return;

    setSubmitError(null);
    persistCurrentAnswer();

    if (!isLast) {
      queueProgressUpdate(currentStep.id);
      setCurrentIndex((value) => value + 1);
      return;
    }

    const finalAnswers = {
      ...answersByStep,
      ...(currentStep.stepType === "QUESTION"
        ? { [currentStep.id]: typeof tempAnswer === "string" ? tempAnswer.trim() : tempAnswer }
        : {}),
    };

    const payloadAnswers = questionSteps
      .map((step) => {
        const answer = finalAnswers[step.id];
        if (answer === undefined) return null;
        if (typeof answer === "string" && answer.length === 0) return null;
        return { stepId: step.id, answer };
      })
      .filter((item): item is { stepId: number; answer: LessonAnswer } => item !== null);

    try {
      const submission = await submitAttempt.mutateAsync({
        lessonId: numericLessonId,
        answers: payloadAnswers,
      });
      setResult(submission);
    } catch (error) {
      setSubmitError(await getSubmitErrorMessage(error));
    }
  };

  return (
    <div className="flex flex-1 flex-col bg-background">
      <div className="border-b bg-card/60 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate({ to: "/lessons" })}
                className="gap-1.5"
              >
                <ArrowLeft className="size-4" />
                Exit
              </Button>
              {/* admin edit/delete controls moved to bottom area for per-page editing */}
            </div>
            <div className="text-right">
              {currentUnit ? (
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  {currentUnit.title}
                </p>
              ) : null}
              <span className="text-sm font-semibold text-muted-foreground">
                {currentIndex + 1} / {steps.length}
              </span>
            </div>
          </div>
        {/* header CTA removed — appeal button moved next to Continue below */}

        <div className="mx-auto max-w-6xl px-4 pb-3">
          <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-gradient-to-r from-chart-1 to-chart-5 transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 lg:py-10">
        <div className="grid gap-8 lg:grid-cols-[320px_minmax(0,1fr)]">
          {currentUnit ? (
            <aside className="hidden lg:block">
              <div className="sticky top-6">
                <UnitRoadmap
                  unit={displayUnit ?? currentUnit}
                  progressItems={progressItems}
                  currentLessonId={numericLessonId}
                  title="Unit Lessons"
                  interactive
                    allowAllUnlocked={isContributor || isAdmin}
                    onDeleteLesson={deleteTempLesson}
                  headerAction={
                    (isContributor || isAdmin) ? (
                      <div className="flex gap-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="default">Add Content</Button>
                          </DialogTrigger>
                          <DialogContent title="Add Content" description="Create a lesson for this section" className="max-w-2xl max-h-[90vh] overflow-y-auto">
                            <LessonForm defaultUnitId={currentUnit?.id ?? undefined} setTempRefresh={setTempRefresh} />
                          </DialogContent>
                        </Dialog>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="default">Add Subunit</Button>
                          </DialogTrigger>
                          <DialogContent title="Add Subunit" description={`Create a lesson under ${currentUnit?.title ?? "this section"}`}>
                          <div className="space-y-3">
                            <div>
                              <Label htmlFor="add-lesson-title">Subunit title</Label>
                              <Input id="add-lesson-title" value={addTitle} onChange={(e) => setAddTitle(e.target.value)} />
                            </div>
                            <div>
                              <Label htmlFor="add-lesson-desc">Description</Label>
                              <Input id="add-lesson-desc" value={addDesc} onChange={(e) => setAddDesc(e.target.value)} />
                            </div>
                            <div className="flex justify-end gap-2">
                              <DialogClose asChild>
                                <Button variant="outline">Cancel</Button>
                              </DialogClose>
                              <DialogClose asChild>
                                <Button
                                  onClick={async () => {
                                    try {
                                      console.log("DEBUG: Add subunit clicked (handler 2)");
                                      console.log("DEBUG: isTempLesson=", isTempLesson);
                                      console.log("DEBUG: currentUnit=", currentUnit);
                                      console.log("DEBUG: currentUnit?.id=", currentUnit?.id);
                                      
                                      if (isTempLesson) {
                                        console.log("DEBUG: Handling temp lesson (handler 2)");
                                        const key = String(lessonId).slice(5);
                                        const raw = localStorage.getItem(`tempUnit:${key}`);
                                        const parsed = raw ? JSON.parse(raw) : { id: -(Date.now()), title: effectiveData?.lesson?.title ?? "New Section", description: effectiveData?.lesson?.description ?? null, orderIndex: 0, lessons: [], steps: [] };
                                        const nextIndex = (parsed.lessons?.length ?? 0) + 1;
                                        const newLesson = {
                                          id: -(Date.now()),
                                          unitId: parsed.id,
                                          title: addTitle || `New Lesson ${nextIndex}`,
                                          slug: `new-lesson-${nextIndex}`,
                                          description: addDesc || "Coming soon",
                                          learningObjective: null,
                                          estimatedMinutes: null,
                                          orderIndex: nextIndex,
                                          status: "DRAFT",
                                        };
                                        parsed.lessons = parsed.lessons ?? [];
                                        parsed.lessons.push(newLesson);
                                        parsed.steps = parsed.steps ?? [];
                                        parsed.steps.push({
                                          id: newLesson.id,
                                          orderIndex: newLesson.orderIndex,
                                          stepType: "TEACH",
                                          vocab: { term: newLesson.title, definition: newLesson.description, exampleSentence: null, partOfSpeech: null },
                                          question: null,
                                          dialogueText: null,
                                          payload: null,
                                        });
                                        localStorage.setItem(`tempUnit:${key}`, JSON.stringify(parsed));
                                        setTempRefresh((v) => v + 1);
                                      } else if (currentUnit?.id && currentUnit.id < 0) {
                                        const nextIndex = (currentUnit.lessons?.length ?? 0) + 1;
                                        const newLesson = {
                                          id: -(Date.now()),
                                          unitId: currentUnit.id,
                                          title: addTitle || `New Lesson ${nextIndex}`,
                                          slug: `new-lesson-${nextIndex}`,
                                          description: addDesc || "Coming soon",
                                          learningObjective: null,
                                          estimatedMinutes: null,
                                          orderIndex: nextIndex,
                                          status: "DRAFT",
                                        };
                                        const tempKey = currentUnit.id;
                                        const raw = localStorage.getItem(`tempPlaceholderUnit:${tempKey}`);
                                        const parsed = raw ? JSON.parse(raw) : { ...currentUnit, lessons: [], steps: [] };
                                        parsed.lessons = (parsed.lessons ?? []).concat(newLesson);
                                        parsed.steps = (parsed.steps ?? []).concat({
                                          id: newLesson.id,
                                          orderIndex: newLesson.orderIndex,
                                          stepType: "TEACH",
                                          vocab: { term: newLesson.title, definition: newLesson.description, exampleSentence: null, partOfSpeech: null },
                                          question: null,
                                          dialogueText: null,
                                          payload: null,
                                        });
                                        localStorage.setItem(`tempPlaceholderUnit:${tempKey}`, JSON.stringify(parsed));
                                        setTempRefresh((v) => v + 1);
                                      } else {
                                        // Submit to lessons API for real units
                                        const finalTitle = (addTitle || "").trim() || "New Lesson";
                                        const finalDesc = (addDesc || "").trim() || "Coming soon";
                                        await api.post("lessons", {
                                          json: {
                                            unitId: currentUnit?.id,
                                            title: finalTitle.slice(0, 100),
                                            description: finalDesc.slice(0, 500),
                                            learningObjective: null,
                                            estimatedMinutes: null,
                                            targetSubunitId: currentUnit?.id,
                                          },
                                        });
                                        // Refetch units to show new lesson
                                        await refetchUnits();
                                        setTempRefresh((v) => v + 1);
                                      }
                                      setAddTitle("");
                                      setAddDesc("");
                                    } catch (e) {
                                      alert(`Error adding subunit: ${e instanceof Error ? e.message : String(e)}`);
                                    }
                                  }}
                                >
                                  Save
                                </Button>
                              </DialogClose>
                            </div>
                          </div>
                        </DialogContent>
                        </Dialog>
                      </div>
                    ) : null
                  }
                />
              </div>
            </aside>
          ) : null}

          <div className="min-w-0">
            <div className="mx-auto w-full max-w-2xl">
              <h1 className="mb-2 text-lg font-semibold text-muted-foreground">
                {effectiveData?.lesson?.title}
              </h1>

              <div className="relative">
                {isTempLesson ? (
                  <Card className="border-chart-1/30 bg-chart-1/5">
                    <CardContent className="pt-6 text-center">
                      <h2 className="text-xl font-semibold">This section has no published steps</h2>
                      <p className="mt-2 text-sm text-muted-foreground">Add lessons or quizzes to populate this section.</p>
                      <div className="mt-6">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button size="lg">Add Content</Button>
                          </DialogTrigger>
                          <DialogContent title="Add Content" description="Create a lesson for this section">
                            <LessonForm defaultUnitId={currentUnit?.id ?? undefined} setTempRefresh={setTempRefresh} />
                          </DialogContent>
                        </Dialog>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    <StepBody step={currentStep} tempAnswer={tempAnswer} setTempAnswer={setTempAnswer} />

                    {(isContributor || isAdmin) && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                          className="absolute left-0 top-1/2 z-20 -translate-y-1/2 -translate-x-full"
                        >
                          <ChevronLeft className="size-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setCurrentIndex((i) => Math.min(steps.length - 1, i + 1))}
                          className="absolute right-0 top-1/2 z-20 -translate-y-1/2 translate-x-full"
                        >
                          <ChevronRight className="size-4" />
                        </Button>
                      </>
                    )}
                  </>
                )}

                {appealOpen && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="w-full max-w-lg rounded-lg bg-card p-6">
                      <h3 className="mb-2 text-lg font-semibold">Appeal content</h3>
                      <p className="mb-3 text-sm text-muted-foreground">Describe the inaccuracy or issue you found.</p>
                      <textarea
                        className="w-full min-h-[120px] rounded-md border px-3 py-2 text-sm"
                        value={appealText}
                        onChange={(e) => setAppealText(e.target.value)}
                      />
                      {appealError && <p className="mt-2 text-sm text-destructive">{appealError}</p>}
                      <div className="mt-4 flex justify-end gap-2">
                        <Button variant="ghost" onClick={() => setAppealOpen(false)}>Cancel</Button>
                        <Button onClick={submitAppeal} disabled={appealSubmitting || !appealText.trim()}>
                          {appealSubmitting ? "Submitting…" : "Submit Appeal"}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-8">
                {submitError ? (
                  <p className="mb-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    {submitError}
                  </p>
                ) : null}
                {!isAdmin && !isContributor && (
                  <Button
                    size="lg"
                    className="w-full gap-2 text-base"
                    onClick={() => {
                      void goNext();
                    }}
                    disabled={submitAttempt.isPending || !canContinue || isTempLesson}
                  >
                    {isLast
                      ? submitAttempt.isPending
                        ? "Submitting..."
                        : "See Results"
                      : "Continue"}
                    <ArrowRight className="size-4" />
                  </Button>
                )}
                {/* Arrows moved adjacent to the step card above (to the sides) */}

                {/* For admins, show edit/delete for the current page instead of appeal */}
                {!isTempLesson && isAdmin && currentStep ? (
                  <div className="mt-4 flex gap-2">
                    <AdminEditStepButton
                      lessonId={numericLessonId}
                      step={currentStep}
                      onSaved={() => void null}
                    />
                    <AdminDeleteStepButton
                      lessonId={numericLessonId}
                      stepId={currentStep.id}
                      step={currentStep}
                      onDeleted={() => {
                        setCurrentIndex((idx) => Math.max(0, Math.min(idx, Math.max(0, steps.length - 2))));
                        setTempRefresh((v) => v + 1);
                      }}
                    />
                  </div>
                ) : null}

                {/* Contributors still get the appeal button */}
                {!isAdmin && isContributor && (
                  <div className="mt-4">
                    <Button
                      size="md"
                      variant="outline"
                      className="w-full gap-2"
                      onClick={() => setAppealOpen(true)}
                    >
                      ⚑ Report an issue / Appeal
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

async function getSubmitErrorMessage(error: unknown) {
  if (error instanceof HTTPError) {
    const payload = (await error.response
      .clone()
      .json()
      .catch(() => null)) as { message?: string; error?: string } | null;

    if (payload?.message) {
      return payload.message;
    }

    if (payload?.error) {
      return payload.error;
    }

    return `Couldn't submit your lesson right now (${error.response.status}). Try again.`;
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "Couldn't submit your lesson right now. Try again.";
}

function StepBody({
  step,
  tempAnswer,
  setTempAnswer,
}: {
  step: LessonStepPayload;
  tempAnswer: LessonAnswer;
  setTempAnswer: (value: LessonAnswer) => void;
}) {
  if (step.stepType === "TEACH" && step.vocab) {
    return (
      <Card className="border-chart-1/30 bg-chart-1/5">
        <CardContent className="pt-6">
          <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">learn</p>
          <h2 className="mt-2 text-3xl font-bold">{step.vocab.term}</h2>
          <p className="mt-4 text-lg">{step.vocab.definition}</p>
          {step.vocab.exampleSentence && (
            <p className="mt-3 text-sm italic text-muted-foreground">
              "{step.vocab.exampleSentence}"
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  if (step.stepType === "DIALOGUE") {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">dialogue</p>
          <p className="mt-3 text-lg">{step.dialogueText ?? "Dialogue step"}</p>
        </CardContent>
      </Card>
    );
  }

  if (step.stepType === "RECAP") {
    const headline = readStringField(step.payload, "headline") ?? "Quick recap";
    const summary =
      readStringField(step.payload, "summary") ??
      "You reached the end of this lesson. Lock in the key idea before you move on.";
    const takeaways = readStringArrayField(step.payload, "takeaways");

    return (
      <Card className="border-chart-2/25 bg-chart-2/8">
        <CardContent className="pt-6">
          <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">recap</p>
          <h2 className="mt-2 text-3xl font-bold">{headline}</h2>
          <p className="mt-4 text-base text-muted-foreground">{summary}</p>
          {takeaways.length > 0 ? (
            <div className="mt-5 space-y-3">
              {takeaways.map((takeaway) => (
                <div
                  key={takeaway}
                  className="rounded-2xl border border-border/70 bg-background/80 px-4 py-3"
                >
                  <p className="text-sm font-medium">{takeaway}</p>
                </div>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  return <QuestionStep step={step} value={tempAnswer} onChange={setTempAnswer} />;
}

function ResultView({
  result,
  lessonTitle,
  unitTitle,
  nextLessonTitle,
  onRetry,
  onExit,
  onContinue,
}: {
  result: AttemptResult;
  lessonTitle: string;
  unitTitle: string | null;
  nextLessonTitle: string | null;
  onRetry: () => void;
  onExit: () => void;
  onContinue?: () => void;
}) {
  return (
    <div className="flex flex-1 items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg">
        <CardContent className="pt-8 text-center">
          {unitTitle ? (
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {unitTitle}
            </p>
          ) : null}
          <h2 className="mb-1 text-3xl font-bold">{lessonTitle}</h2>
          <p className="mb-6 text-muted-foreground">
            {result.passed ? "Lesson complete" : "Try again"}
          </p>

          <div className="mb-6 rounded-2xl bg-secondary p-6">
            <div className="mb-1 text-5xl font-bold">{result.score}%</div>
            <p className="text-sm text-muted-foreground">
              {result.correctCount} out of {result.totalQuestions} correct
            </p>
          </div>

          <div className="flex flex-col gap-3">
            {result.passed && onContinue && nextLessonTitle ? (
              <Button size="lg" className="w-full text-base" onClick={onContinue}>
                Continue to {nextLessonTitle}
              </Button>
            ) : null}
            {!result.passed && (
              <Button size="lg" className="w-full text-base" onClick={onRetry}>
                Try Again
              </Button>
            )}
            <Button size="lg" variant="default" className="w-full text-base" onClick={onExit}>
              Back to Learn
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function readStringField(payload: LessonStepPayload["payload"], key: string) {
  const value = payload?.[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function readStringArrayField(payload: LessonStepPayload["payload"], key: string) {
  const value = payload?.[key];
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function AdminDeleteStepButton({
  lessonId,
  stepId,
  step,
  onDeleted,
}: {
  lessonId: number;
  stepId: number;
  step?: LessonStepPayload;
  onDeleted?: () => void;
}) {
  const deleteStep = useDeleteStep();
  const [busy, setBusy] = useState(false);

  const handle = async () => {
    if (!confirm("Delete this step? This cannot be undone.")) return;
    setBusy(true);
    try {
      // For appended unit lessons (negative IDs), delete from localStorage instead of API
      if (lessonId < 0) {
        if (!step) throw new Error("Step data required for appended unit deletion");
        
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i) || "";
          if (!key.startsWith("tempUnit:")) continue;
          const raw = localStorage.getItem(key);
          if (!raw) continue;
          const parsed = JSON.parse(raw);
          const steps = Array.isArray(parsed.steps) ? parsed.steps : [];
          const before = steps.length;
          
          // For appended units, delete by matching (lessonId OR targetSubunitId) AND orderIndex
          // A step belongs to current lesson if:
          // 1. step.id === lessonId (original lesson, not yet approved), OR
          // 2. step.targetSubunitId === lessonId (copied to target subunit after approval)
          parsed.steps = steps.filter((s: any) => {
            const belongsToLesson = (s.id === lessonId || s.targetSubunitId === lessonId);
            const sameOrderIndex = s.orderIndex === step.orderIndex;
            return !(belongsToLesson && sameOrderIndex);
          });
          
          if (parsed.steps.length !== before) {
            // Re-index remaining steps for this lesson to ensure orderIndex is sequential
            const lessonSteps = parsed.steps.filter((s: any) => 
              s.id === lessonId || s.targetSubunitId === lessonId
            );
            const otherSteps = parsed.steps.filter((s: any) => 
              s.id !== lessonId && s.targetSubunitId !== lessonId
            );
            
            // Re-order the steps for this lesson
            lessonSteps.forEach((s: any, idx: number) => {
              s.orderIndex = idx;
            });
            
            // Combine back
            parsed.steps = [...lessonSteps, ...otherSteps];
            
            localStorage.setItem(key, JSON.stringify(parsed));
            
            // Dispatch storage event for listeners
            window.dispatchEvent(new StorageEvent('storage', {
              key: key,
              newValue: JSON.stringify(parsed),
              oldValue: null,
              storageArea: localStorage,
            }));
            
            // Dispatch custom event to trigger UI refresh
            window.dispatchEvent(new CustomEvent('tempUnit-step-deleted', { 
              detail: { lessonId, stepDeletedIndex: step.orderIndex } 
            }));
            
            onDeleted?.();
            setBusy(false);
            return;
          }
        }
        throw new Error("Step not found in storage");
      }
      
      // For server lessons, use the API with the actual step ID
      await deleteStep.mutateAsync({ lessonId, stepId });
      onDeleted?.();
    } catch (err) {
      alert(`Error deleting step: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button size="sm" variant="destructive" disabled={busy} onClick={handle}>
      Delete step
    </Button>
  );
}

function AdminEditStepButton({
  lessonId,
  step,
  onSaved,
}: {
  lessonId: number;
  step: LessonStepPayload;
  onSaved?: () => void;
}) {
  const patchStep = usePatchStep();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState<string>(() => JSON.stringify(step.payload ?? {}, null, 2));

  useEffect(() => {
    setText(JSON.stringify(step.payload ?? {}, null, 2));
  }, [step]);

  const handleSave = async () => {
    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      alert("Invalid JSON payload");
      return;
    }

    setBusy(true);
    try {
      const body = {
        orderIndex: step.orderIndex,
        stepType: step.stepType,
        vocabItemId: step.vocab?.id ?? null,
        questionId: step.question?.id ?? null,
        questionType: step.question ? (step.question.questionType as any) : null,
        prompt: step.question?.prompt ?? null,
        explanation: step.question?.explanation ?? null,
        options: step.question?.choices?.map((c) => c.text) ?? null,
        correctOptionIndex: null,
        acceptedAnswers: step.question?.acceptedAnswers ?? null,
        matchPairs: null,
        dialogueText: step.dialogueText ?? null,
        payload: parsed,
      };

      await patchStep.mutateAsync({ lessonId, stepId: step.id, body });
      setOpen(false);
      onSaved?.();
    } catch (err) {
      // no-op
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        Edit
      </Button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-2xl rounded-lg bg-card p-6">
            <h3 className="mb-2 text-lg font-semibold">Edit step payload</h3>
            <p className="mb-3 text-sm text-muted-foreground">Edit the JSON payload for this step.</p>
            <textarea
              className="w-full min-h-[240px] rounded-md border px-3 py-2 text-sm font-mono"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={busy}>
                {busy ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
