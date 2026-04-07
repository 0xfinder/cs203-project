import { createFileRoute } from "@tanstack/react-router";
import {
  usePendingContentsPaginated,
  useApproveContent,
  useRejectContent,
} from "@/features/content/useContentData";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { requireOnboardingCompleted } from "@/lib/auth";
import { getMe } from "@/lib/me";
import {
  usePendingLessons,
  useUnits,
  useApproveLesson,
  useRejectLesson,
} from "@/features/lessons/useLessonsApi";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

function ReviewPage() {
  const queryClient = useQueryClient();
  const [page] = useState(0);
  const [activeTab, setActiveTab] = useState("content");
  const [contentSubTab, setContentSubTab] = useState("term");
  useEffect(() => {
    try {
      const pref = sessionStorage.getItem("reviewActiveSub");
      if (pref === "lesson") {
        setActiveTab("content");
        setContentSubTab("lesson");
        sessionStorage.removeItem("reviewActiveSub");
      }
    } catch (e) {
      // ignore storage errors
    }
  }, []);
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [reviewData, setReviewData] = useState<Record<number, { comment?: string }>>({});
  const pageSize = 10;
  const { data: response, isLoading } = usePendingContentsPaginated(page, pageSize);
  const approveMutation = useApproveContent();
  const rejectMutation = useRejectContent();
  const approveLessonMutation = useApproveLesson();
  const rejectLessonMutation = useRejectLesson();
  const pendingContents = response?.content || [];
  const appeals = pendingContents.filter(
    (c: any) => typeof c.term === "string" && c.term.startsWith("Appeal:"),
  );
  const newContents = pendingContents.filter(
    (c: any) => !(typeof c.term === "string" && c.term.startsWith("Appeal:")),
  );
  // pending contents endpoint currently returns submitted term/content items only
  const termItems = newContents;
  const { data: pendingLessons } = usePendingLessons();
  const [appendedUnitLessons, setAppendedUnitLessons] = useState<any[]>([]);
  const lessonItems: any[] = [
    ...(Array.isArray(pendingLessons) ? pendingLessons : []),
    ...appendedUnitLessons,
  ];
  const { data: units } = useUnits();
  const [appendedUnitsCache, setAppendedUnitsCache] = useState<any[]>([]);
  const [firstStepMap, setFirstStepMap] = useState<
    Record<number, { stepType?: string; questionType?: string | null; prompt?: string | null }>
  >({});
  const [pendingMetaMap, setPendingMetaMap] = useState<Record<number, any> | null>(null);
  const [debugInfo, setDebugInfo] = useState<{
    serverPendingCount?: number;
    serverAllCount?: number;
  } | null>(null);
  const [modalLesson, setModalLesson] = useState<any | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const openLessonModal = async (id: number) => {
    setModalLoading(true);
    try {
      // Check if this is an appended unit lesson (negative ID)
      if (id < 0) {
        // Read from localStorage
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i) || "";
          if (!key.startsWith("tempUnit:")) continue;
          try {
            const raw = localStorage.getItem(key);
            if (!raw) continue;
            const parsed = JSON.parse(raw);
            const lessons = Array.isArray(parsed.lessons) ? parsed.lessons : [];
            const lesson = lessons.find((l: any) => l.id === id);
            if (lesson) {
              const steps = Array.isArray(parsed.steps)
                ? parsed.steps.filter((s: any) => s.id === id)
                : [];
              setModalLesson({ detail: lesson, steps });
              return;
            }
          } catch (e) {
            // ignore
          }
        }
        setModalLesson({ error: "Lesson not found in storage" });
      } else {
        // Fetch lesson detail from backend (includes step payloads with answers for preview)
        const detail = await api.get(`lessons/${id}`).json<any>();
        // Use the detail's steps for preview so we can show correct answers
        const steps = detail?.steps ?? [];
        setModalLesson({ detail, steps });
      }
    } catch (e) {
      setModalLesson({ error: String(e) });
    } finally {
      setModalLoading(false);
    }
  };
  const closeLessonModal = () => setModalLesson(null);
  const totalPages = response?.totalPages || 0;
  const totalElements = response?.totalElements || 0;

  // Helper to identify placeholder lessons (empty subunit containers)
  const isPlaceholderLesson = (lesson: any) => {
    if (!lesson) return false;
    const title = String(lesson.title ?? "");
    const slug = String(lesson.slug ?? "");
    const description = String(lesson.description ?? "");
    return (
      title.startsWith("Placeholder Lesson") ||
      slug.startsWith("placeholder-") ||
      title === "Coming soon" ||
      description === "Coming soon" ||
      !!lesson.__placeholder ||
      title.startsWith("New Lesson")
    );
  };

  useEffect(() => {
    let mounted = true;
    getMe()
      .then((u: any) => {
        if (!mounted) return;
        const role = u?.role || "LEARNER";
        setHasAccess(role === "MODERATOR" || role === "ADMIN");
      })
      .catch(() => {
        if (!mounted) return;
        setHasAccess(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Admin-only debug: if no pending lessons appear, fetch raw server endpoints to inspect
  useEffect(() => {
    if (hasAccess !== true) return;
    if ((lessonItems?.length ?? 0) > 0) {
      setDebugInfo(null);
      return;
    }

    let mounted = true;
    (async () => {
      try {
        const serverPending = await api
          .get("lessons", { searchParams: { status: "PENDING_REVIEW" } })
          .json<any[]>();
        const serverAll = await api.get("lessons").json<any[]>();
        if (!mounted) return;
        setDebugInfo({
          serverPendingCount: Array.isArray(serverPending) ? serverPending.length : undefined,
          serverAllCount: Array.isArray(serverAll) ? serverAll.length : undefined,
        });
      } catch (e) {
        if (!mounted) return;
        setDebugInfo({});
      }
    })();

    return () => {
      mounted = false;
    };
  }, [hasAccess, lessonItems]);

  // load client-side pending metadata (saved by the lesson form) so we can show selected subunit/title
  useEffect(() => {
    try {
      const raw = localStorage.getItem("pendingLessonMeta");
      setPendingMetaMap(raw ? JSON.parse(raw) : {});
    } catch (e) {
      setPendingMetaMap({});
    }
    const onStorage = (ev: StorageEvent) => {
      if (!ev.key) return;
      if (ev.key === "pendingLessonMeta") {
        try {
          setPendingMetaMap(ev.newValue ? JSON.parse(ev.newValue) : {});
        } catch (e) {
          setPendingMetaMap({});
        }
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Load appended unit lessons from localStorage (negative IDs)
  // These are client-side submissions to appended units that haven't been synced to server
  useEffect(() => {
    try {
      const collected: any[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i) || "";
        if (!key.startsWith("tempUnit:")) continue;
        try {
          const raw = localStorage.getItem(key);
          if (!raw) continue;
          const parsed = JSON.parse(raw);
          const lessons = Array.isArray(parsed.lessons) ? parsed.lessons : [];
          // Filter for PENDING_REVIEW status (newly submitted lessons waiting for review)
          // Exclude placeholder lessons (empty subunit containers)
          lessons.forEach((lesson: any) => {
            if (
              lesson.status === "PENDING_REVIEW" &&
              lesson.id &&
              lesson.id < 0 &&
              !isPlaceholderLesson(lesson)
            ) {
              collected.push({
                id: lesson.id,
                unitId: lesson.unitId,
                title: lesson.title,
                slug: lesson.slug,
                description: lesson.description,
                learningObjective: lesson.learningObjective,
                estimatedMinutes: lesson.estimatedMinutes,
                orderIndex: lesson.orderIndex,
                status: "PENDING_REVIEW",
                submittedBy: lesson.submittedBy,
                subunitId: lesson.subunitId,
                subunitTitle: lesson.subunitTitle,
              });
            }
          });
        } catch (e) {
          // ignore malformed entries
        }
      }
      setAppendedUnitLessons(collected);
    } catch (e) {
      setAppendedUnitLessons([]);
    }

    // Listen for storage changes to refresh appended unit lessons
    const onStorage = (ev: StorageEvent) => {
      if (!ev.key) return;
      if (ev.key.startsWith("tempUnit:")) {
        // Re-read all appended unit lessons
        try {
          const collected: any[] = [];
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i) || "";
            if (!k.startsWith("tempUnit:")) continue;
            try {
              const r = localStorage.getItem(k);
              if (!r) continue;
              const p = JSON.parse(r);
              const l = Array.isArray(p.lessons) ? p.lessons : [];
              l.forEach((lesson: any) => {
                if (
                  lesson.status === "PENDING_REVIEW" &&
                  lesson.id &&
                  lesson.id < 0 &&
                  !isPlaceholderLesson(lesson)
                ) {
                  collected.push({
                    id: lesson.id,
                    unitId: lesson.unitId,
                    title: lesson.title,
                    slug: lesson.slug,
                    description: lesson.description,
                    learningObjective: lesson.learningObjective,
                    estimatedMinutes: lesson.estimatedMinutes,
                    orderIndex: lesson.orderIndex,
                    status: "PENDING_REVIEW",
                    submittedBy: lesson.submittedBy,
                    subunitId: lesson.subunitId,
                    subunitTitle: lesson.subunitTitle,
                  });
                }
              });
            } catch (ignore) {}
          }
          setAppendedUnitLessons(collected);
        } catch (ignore) {}
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Load appended units data from localStorage for unit lookups
  useEffect(() => {
    try {
      const collected: any[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i) || "";
        if (!key.startsWith("tempUnit:")) continue;
        try {
          const raw = localStorage.getItem(key);
          if (!raw) continue;
          const parsed = JSON.parse(raw);
          if (parsed.id && parsed.id < 0) {
            collected.push(parsed);
          }
        } catch (e) {
          // ignore malformed entries
        }
      }
      setAppendedUnitsCache(collected);
    } catch (e) {
      setAppendedUnitsCache([]);
    }

    const onStorage = (ev: StorageEvent) => {
      if (!ev.key?.startsWith("tempUnit:")) return;
      try {
        const collected: any[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i) || "";
          if (!k.startsWith("tempUnit:")) continue;
          try {
            const r = localStorage.getItem(k);
            if (!r) continue;
            const p = JSON.parse(r);
            if (p.id && p.id < 0) {
              collected.push(p);
            }
          } catch (ignore) {}
        }
        setAppendedUnitsCache(collected);
      } catch (ignore) {}
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // For pending lessons that don't include firstStepType/firstQuestionType, fetch their first step so we can show Type on the card
  // For appended unit lessons (negative IDs), read steps from localStorage instead
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const toFetch = lessonItems.filter(
          (l: any) => !(l.firstStepType || l.firstQuestionType) && !firstStepMap[l.id],
        );
        for (const l of toFetch) {
          try {
            // Check if this is an appended unit lesson (negative ID)
            if (l.id < 0) {
              // Read from localStorage
              for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i) || "";
                if (!key.startsWith("tempUnit:")) continue;
                const raw = localStorage.getItem(key);
                if (!raw) continue;
                const parsed = JSON.parse(raw);
                const steps = Array.isArray(parsed.steps)
                  ? parsed.steps.filter((s: any) => s.id === l.id)
                  : [];
                if (steps.length > 0) {
                  const first = steps[0];
                  if (!mounted) return;
                  setFirstStepMap((prev) => ({
                    ...prev,
                    [l.id]: {
                      stepType: first.stepType,
                      questionType: first?.question?.questionType ?? null,
                      prompt: first?.question?.prompt ?? null,
                    },
                  }));
                  break;
                }
              }
            } else {
              // Fetch from backend API
              const resp = await api.get(`lessons/${l.id}/content`).json<any>();
              const steps = resp?.steps ?? resp ?? [];
              if (!mounted) return;
              if (Array.isArray(steps) && steps.length > 0) {
                const first = steps[0];
                setFirstStepMap((prev) => ({
                  ...prev,
                  [l.id]: {
                    stepType: first.stepType,
                    questionType: first?.question?.questionType ?? null,
                    prompt: first?.question?.prompt ?? null,
                  },
                }));
              }
            }
          } catch (e) {
            // ignore per-lesson fetch failures
          }
        }
      } catch (e) {
        // ignore
      }
    })();
    return () => {
      mounted = false;
    };
  }, [lessonItems, firstStepMap]);

  const handleApprove = async (id: number) => {
    const comment = reviewData[id]?.comment;
    approveMutation.mutate({ id, reviewComment: comment });
    setReviewData((prev) => {
      const newData = { ...prev };
      delete newData[id];
      return newData;
    });
    setExpandedId(null);
  };

  const handleReject = async (id: number) => {
    const comment = reviewData[id]?.comment || "No reason provided";
    rejectMutation.mutate({ id, reviewComment: comment });
    setReviewData((prev) => {
      const newData = { ...prev };
      delete newData[id];
      return newData;
    });
    setExpandedId(null);
  };

  const handleApproveLesson = async (id: number) => {
    // For appended unit lessons (negative IDs), append steps to the target subunit
    if (id < 0) {
      try {
        // Find the lesson being approved from appendedUnitLessons
        const lesson = appendedUnitLessons.find((l: any) => l.id === id);
        if (!lesson) {
          console.error("Could not find lesson to approve:", id);
          alert("Error: Could not find lesson to approve");
          setExpandedId(null);
          return;
        }

        // The subunitId tells us which subunit to add steps to
        const targetSubunitId = lesson.subunitId;
        if (!targetSubunitId) {
          console.error("Lesson has no subunitId:", id, "lesson:", lesson);
          alert(`Error: Lesson has no subunit selected. Lesson: ${JSON.stringify(lesson)}`);
          setExpandedId(null);
          return;
        }

        // Get the steps for this lesson from localStorage
        let stepsToApprove: any[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i) || "";
          if (!key.startsWith("tempUnit:")) continue;
          const raw = localStorage.getItem(key);
          if (!raw) continue;
          const parsed = JSON.parse(raw);
          const steps = Array.isArray(parsed.steps) ? parsed.steps : [];
          stepsToApprove = steps.filter((s: any) => s.id === id);
          if (stepsToApprove.length > 0) {
            break;
          }
        }

        if (stepsToApprove.length === 0) {
          console.error("No steps found for lesson:", id);
          alert("Error: No steps found for this lesson");
          setExpandedId(null);
          return;
        }

        // For appended unit lessons, add steps directly to the target subunit in localStorage
        // Find the tempUnit entry containing the target subunit
        let targetSubunitFound = false;
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i) || "";
          if (!key.startsWith("tempUnit:")) continue;
          const raw = localStorage.getItem(key);
          if (!raw) continue;
          const parsed = JSON.parse(raw);
          const lessons = Array.isArray(parsed.lessons) ? parsed.lessons : [];

          // Find if target subunit is in this unit
          const targetSubunit = lessons.find((l: any) => l.id === targetSubunitId);
          if (targetSubunit) {
            // Add steps directly to the target subunit's steps array in this unit
            parsed.steps = Array.isArray(parsed.steps) ? parsed.steps : [];

            // Calculate next orderIndex for target subunit (to prevent all steps having orderIndex 0)
            const existingStepsForTarget = parsed.steps.filter(
              (s: any) => s.id === targetSubunitId || s.targetSubunitId === targetSubunitId,
            );
            let nextOrderIndex = 0;
            if (existingStepsForTarget.length > 0) {
              nextOrderIndex =
                Math.max(...existingStepsForTarget.map((s: any) => s.orderIndex ?? 0)) + 1;
            }

            // Add all steps from the lesson being approved, but associate them with the target subunit
            for (const step of stepsToApprove) {
              const newStep = {
                ...step,
                // Add targetSubunitId to track where step was copied to
                targetSubunitId: targetSubunitId,
                // Set proper sequential orderIndex to prevent deletion bug
                orderIndex: nextOrderIndex++,
              };
              parsed.steps.push(newStep);
            }

            localStorage.setItem(key, JSON.stringify(parsed));
            // Dispatch custom event to notify unit component that steps changed
            window.dispatchEvent(
              new CustomEvent("tempUnit-steps-added", {
                detail: { unitKey: key, targetSubunitId, stepsCount: stepsToApprove.length },
              }),
            );
            break;
          }
        }

        if (!targetSubunitFound) {
          alert("Error: Could not find target subunit in storage. Steps not added.");
          throw new Error("Target subunit not found");
        }

        // Remove the lesson from localStorage
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i) || "";
          if (!key.startsWith("tempUnit:")) continue;
          const raw = localStorage.getItem(key);
          if (!raw) continue;
          const parsed = JSON.parse(raw);
          const lessons = Array.isArray(parsed.lessons) ? parsed.lessons : [];
          const lessonIndex = lessons.findIndex((l: any) => l.id === id);
          if (lessonIndex >= 0) {
            // Remove lesson and associated steps
            parsed.lessons = lessons.filter((l: any) => l.id !== id);
            // Only remove steps that DON'T have targetSubunitId (those are temporary session steps)
            // Keep steps with targetSubunitId because they were just added to the subunit
            parsed.steps = (Array.isArray(parsed.steps) ? parsed.steps : []).filter(
              (s: any) => !(s.id === id && !s.targetSubunitId),
            );
            localStorage.setItem(key, JSON.stringify(parsed));
            // Trigger storage event so listeners update
            window.dispatchEvent(
              new StorageEvent("storage", {
                key: key,
                newValue: JSON.stringify(parsed),
                oldValue: null,
                storageArea: localStorage,
              }),
            );
            break;
          }
        }

        // Update UI
        setAppendedUnitLessons((prev) => prev.filter((l: any) => l.id !== id));
        window.dispatchEvent(
          new CustomEvent("appended-lessons-changed", {
            detail: { lessonId: id, action: "approved" },
          }),
        );

        // Dispatch a generic storage event to trigger re-reads everywhere
        window.dispatchEvent(
          new StorageEvent("storage", {
            key: null,
            newValue: null,
            oldValue: null,
            storageArea: localStorage,
          }),
        );

        alert("Lesson approved and steps added to subunit!");
      } catch (e) {
        console.error("Error approving appended unit lesson:", e);
      }
      setReviewData((prev) => {
        const newData = { ...prev };
        delete newData[id];
        return newData;
      });
      setExpandedId(null);
      return;
    }

    // For server lessons, use backend mutation
    const comment = reviewData[id]?.comment;
    approveLessonMutation.mutate(
      { id, reviewComment: comment },
      {
        onSuccess: () => {
          // Invalidate units cache so wrappers with targetSubunitId are filtered out
          queryClient.invalidateQueries({ queryKey: ["units"] });
          // Invalidate all lesson play queries to refresh with new steps
          queryClient.invalidateQueries({ queryKey: ["lessons", "play"] });

          // Clear tempData for this lesson so it uses fresh API data
          if (id < 0) {
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i) || "";
              if (!key.startsWith("tempUnit:")) continue;
              try {
                const raw = localStorage.getItem(key);
                if (!raw) continue;
                const parsed = JSON.parse(raw);
                // Remove this lesson from the unit's lessons array
                parsed.lessons = (parsed.lessons || []).filter((l: any) => l?.id !== id);
                // Remove steps for this lesson
                parsed.steps = (parsed.steps || []).filter(
                  (s: any) => s?.id !== id && s?.targetSubunitId !== id,
                );
                localStorage.setItem(key, JSON.stringify(parsed));
              } catch (e) {
                // ignore parse errors
              }
            }
            // Dispatch event to notify lesson view to refresh
            window.dispatchEvent(new CustomEvent("lesson-approved", { detail: { lessonId: id } }));
          }

          // Dispatch event for other listeners
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("lesson-approved", { detail: { lessonId: id } }));
          }
        },
        onError: (error: any) => {
          console.error("Error approving lesson:", error);
          let errorMsg = "Failed to approve lesson";
          try {
            if (error?.response?.body) {
              const body =
                typeof error.response.body === "object"
                  ? error.response.body
                  : JSON.parse(String(error.response.body));
              errorMsg = body.message || body.detail || String(error.response.body);
            } else if (error?.message) {
              errorMsg = error.message;
            }
          } catch (e) {
            // ignore parse error
          }
          alert("Error: " + errorMsg);
        },
      },
    );
    setReviewData((prev) => {
      const newData = { ...prev };
      delete newData[id];
      return newData;
    });
    setExpandedId(null);
  };

  const handleRejectLesson = async (id: number) => {
    // For appended unit lessons (negative IDs), delete from localStorage
    if (id < 0) {
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i) || "";
          if (!key.startsWith("tempUnit:")) continue;
          const raw = localStorage.getItem(key);
          if (!raw) continue;
          const parsed = JSON.parse(raw);
          const lessons = Array.isArray(parsed.lessons) ? parsed.lessons : [];
          if (lessons.some((l: any) => l.id === id)) {
            parsed.lessons = lessons.filter((l: any) => l.id !== id);
            parsed.steps = (Array.isArray(parsed.steps) ? parsed.steps : []).filter(
              (s: any) => s.id !== id,
            );
            localStorage.setItem(key, JSON.stringify(parsed));
            setAppendedUnitLessons((prev) => prev.filter((l: any) => l.id !== id));
            // Dispatch custom event to notify lesson page of deletion
            window.dispatchEvent(
              new CustomEvent("appended-lessons-changed", {
                detail: { lessonId: id, action: "deleted" },
              }),
            );
            break;
          }
        }
      } catch (e) {
        console.error("Error rejecting appended unit lesson:", e);
      }
      setReviewData((prev) => {
        const newData = { ...prev };
        delete newData[id];
        return newData;
      });
      setExpandedId(null);
      return;
    }

    // For server lessons, use backend mutation
    const comment = reviewData[id]?.comment || "No reason provided";
    rejectLessonMutation.mutate(
      { id, reviewComment: comment },
      {
        onError: (error: any) => {
          console.error("Error rejecting lesson:", error);
          let errorMsg = "Failed to reject lesson";
          try {
            if (error?.response?.body) {
              const body =
                typeof error.response.body === "object"
                  ? error.response.body
                  : JSON.parse(String(error.response.body));
              errorMsg = body.message || body.detail || String(error.response.body);
            } else if (error?.message) {
              errorMsg = error.message;
            }
          } catch (e) {
            // ignore parse error
          }
          alert("Error: " + errorMsg);
        },
      },
    );
    setReviewData((prev) => {
      const newData = { ...prev };
      delete newData[id];
      return newData;
    });
    setExpandedId(null);
  };

  const termCount = termItems.length;
  const lessonCount = lessonItems.length;
  const contentCount = termCount + lessonCount;
  const appealsCount = appeals.length;

  if (isLoading || hasAccess === null) {
    return <div className="p-8 text-center">Loading pending items...</div>;
  }
  if (hasAccess === false) {
    return (
      <div className="p-8 text-center text-destructive">
        <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
        <p>Only moderators and admins can review items.</p>
      </div>
    );
  }
  return (
    <div className="flex-1 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Review</h1>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6 gap-4">
            <TabsTrigger value="content" className="px-8 py-2 flex items-center gap-2">
              <span>Content</span>
              {contentCount > 0 && (
                <Badge variant="secondary" className="bg-primary text-primary-foreground">
                  {contentCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="appeals" className="px-8 py-2 flex items-center gap-2">
              <span>Appeals</span>
              {appealsCount > 0 && (
                <Badge variant="secondary" className="bg-primary text-primary-foreground">
                  {appealsCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="content" className="space-y-4">
            <Tabs value={contentSubTab} onValueChange={setContentSubTab}>
              <TabsList className="mb-6 grid w-full grid-cols-2">
                <TabsTrigger value="term" className="flex items-center justify-center gap-2">
                  <span>Term</span>
                  {termCount > 0 && (
                    <Badge variant="outline" className="border-primary/50 text-primary">
                      {termCount}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="lesson" className="flex items-center justify-center gap-2">
                  <span>Lesson</span>
                  {lessonCount > 0 && (
                    <Badge variant="outline" className="border-primary/50 text-primary">
                      {lessonCount}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="term">
                {termItems.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <h2 className="text-xl font-semibold mb-2">No term items to review</h2>
                  </div>
                ) : (
                  <>
                    <p className="text-muted-foreground mb-6">
                      Page {page + 1} of {totalPages} • Showing {termItems.length} of{" "}
                      {totalElements} pending {totalElements === 1 ? "item" : "items"}
                    </p>
                    <div className="grid gap-4">
                      {termItems.map((content: any) => (
                        <Card key={content.id} className="p-6">
                          <div className="mb-4">
                            <h2 className="text-2xl font-bold text-primary">{content.term}</h2>
                            <p className="text-sm text-muted-foreground mt-1">
                              Submitted by: {content.submittedBy}
                            </p>
                          </div>

                          <div className="space-y-3 mb-6">
                            <div>
                              <Label className="font-semibold">Learn</Label>
                              <p className="text-foreground mt-2">{content.definition}</p>
                            </div>

                            {content.example && (
                              <div>
                                <Label className="font-semibold">Example</Label>
                                <p className="text-foreground mt-2">{content.example}</p>
                              </div>
                            )}

                            <div className="text-xs text-muted-foreground">
                              Created:{" "}
                              {new Date(content.createdAt).toLocaleDateString("en-GB", {
                                day: "2-digit",
                                month: "2-digit",
                                year: "2-digit",
                              })}
                            </div>
                          </div>

                          <div className="flex gap-3">
                            <Button
                              onClick={() =>
                                setExpandedId(expandedId === content.id ? null : content.id)
                              }
                              variant="success"
                            >
                              Approve
                            </Button>
                            <Button
                              onClick={() =>
                                setExpandedId(expandedId === -content.id ? null : -content.id)
                              }
                              variant="destructive"
                            >
                              Reject
                            </Button>
                          </div>

                          {expandedId === content.id && (
                            <div className="mt-4 space-y-4 border-t pt-4">
                              <h3 className="font-semibold">Approve "{content.term}"</h3>
                              <div>
                                <Label htmlFor={`approve-comment-${content.id}`}>
                                  Comment (Optional)
                                </Label>
                                <textarea
                                  id={`approve-comment-${content.id}`}
                                  placeholder="Add any notes about this approval..."
                                  value={reviewData[content.id]?.comment || ""}
                                  onChange={(e) =>
                                    setReviewData((prev) => ({
                                      ...prev,
                                      [content.id]: { comment: e.target.value },
                                    }))
                                  }
                                  className="w-full px-3 py-2 border rounded-md mt-1 min-h-20"
                                />
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  onClick={() => handleApprove(content.id)}
                                  variant="success"
                                  className="text-white hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0"
                                  disabled={approveMutation.isPending}
                                >
                                  {approveMutation.isPending ? "Approving..." : "Confirm Approve"}
                                </Button>
                                <Button onClick={() => setExpandedId(null)} variant="outline">
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          )}

                          {expandedId === -content.id && (
                            <div className="mt-4 space-y-4 border-t pt-4">
                              <h3 className="font-semibold">Reject "{content.term}"</h3>
                              <div>
                                <Label htmlFor={`reject-comment-${content.id}`}>
                                  Reason for Rejection
                                </Label>
                                <textarea
                                  id={`reject-comment-${content.id}`}
                                  placeholder="Explain why this item is being rejected..."
                                  value={reviewData[content.id]?.comment || ""}
                                  onChange={(e) =>
                                    setReviewData((prev) => ({
                                      ...prev,
                                      [content.id]: { comment: e.target.value },
                                    }))
                                  }
                                  className="w-full px-3 py-2 border rounded-md mt-1 min-h-20"
                                />
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  onClick={() => handleReject(content.id)}
                                  variant="destructive"
                                  className="text-white hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0"
                                  disabled={rejectMutation.isPending}
                                >
                                  {rejectMutation.isPending ? "Rejecting..." : "Confirm Reject"}
                                </Button>
                                <Button onClick={() => setExpandedId(null)} variant="outline">
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          )}
                        </Card>
                      ))}
                    </div>
                  </>
                )}
              </TabsContent>

              <TabsContent value="lesson">
                {lessonItems.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <h2 className="text-xl font-semibold mb-2">No lesson items to review</h2>
                    {debugInfo ? (
                      <div className="mt-4 text-sm text-muted-foreground">
                        <div>
                          Server pending count:{" "}
                          {typeof debugInfo.serverPendingCount === "number"
                            ? debugInfo.serverPendingCount
                            : "?"}
                        </div>
                        <div>
                          Server total lessons:{" "}
                          {typeof debugInfo.serverAllCount === "number"
                            ? debugInfo.serverAllCount
                            : "?"}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {lessonItems.map((lesson: any) => {
                      // Look up unit from server units or appended units cache
                      let unit = units?.find((u: any) => u.id === lesson.unitId);
                      if (!unit && lesson.unitId < 0) {
                        unit = appendedUnitsCache.find((u: any) => u.id === lesson.unitId);
                      }
                      // prefer server-provided metadata, fall back to client-cached firstStepMap
                      const firstMeta = {
                        stepType: lesson.firstStepType ?? firstStepMap[lesson.id]?.stepType,
                        questionType:
                          lesson.firstQuestionType ?? firstStepMap[lesson.id]?.questionType,
                        prompt: lesson.firstStepPrompt ?? firstStepMap[lesson.id]?.prompt,
                      };
                      const formatStepLabel = (stepType?: string, questionType?: string | null) => {
                        if (!stepType) return null;
                        switch (stepType) {
                          case "TEACH":
                            return "Learn";
                          case "QUESTION":
                            return `Question${questionType ? ` (${questionType})` : ""}`;
                          case "DIALOGUE":
                            return "Dialogue";
                          case "RECAP":
                            return "Recap";
                          default:
                            return stepType;
                        }
                      };
                      const typeLabel = formatStepLabel(firstMeta.stepType, firstMeta.questionType);
                      // Choose display title/summary for question lessons
                      const displayTitle =
                        firstMeta.stepType === "QUESTION" && firstMeta.prompt
                          ? firstMeta.prompt
                          : lesson.title;
                      const displaySummary =
                        firstMeta.stepType === "QUESTION" && firstMeta.prompt
                          ? firstMeta.prompt
                          : lesson.description;
                      const submittedBy = (lesson as any).submittedBy ?? null;

                      return (
                        <Card key={lesson.id} className="p-6">
                          <div className="mb-4">
                            <h2 className="text-2xl font-bold text-primary">{displayTitle}</h2>
                            {submittedBy ? (
                              <p className="text-sm text-muted-foreground mt-1">
                                Submitted by: {submittedBy}
                              </p>
                            ) : null}
                            {(() => {
                              const summarySubunitTitle = (lesson as any).subunitTitle;
                              const summarySubunitId = (lesson as any).subunitId;
                              let resolvedSubunitTitle: string | null = null;
                              // prefer client-persisted pending metadata (works for newly submitted items in this browser)
                              if (
                                pendingMetaMap &&
                                pendingMetaMap[lesson.id] &&
                                pendingMetaMap[lesson.id].subunitTitle
                              ) {
                                resolvedSubunitTitle = pendingMetaMap[lesson.id].subunitTitle;
                              } else if (summarySubunitTitle) {
                                resolvedSubunitTitle = summarySubunitTitle;
                              } else if (summarySubunitId && unit?.lessons) {
                                const found = unit.lessons.find(
                                  (l: any) => l.id === summarySubunitId,
                                );
                                if (found && found.title) resolvedSubunitTitle = found.title;
                              }
                              return (
                                <p className="text-sm text-muted-foreground mt-1">
                                  Unit: {unit?.title ?? lesson.unitId}
                                  {resolvedSubunitTitle
                                    ? ` • Subunit: ${resolvedSubunitTitle}`
                                    : ""}
                                  {typeLabel ? ` • Type: ${typeLabel}` : null}
                                </p>
                              );
                            })()}
                          </div>

                          <div className="space-y-3 mb-6">
                            <div>
                              <Label className="font-semibold">Summary</Label>
                              <p className="text-foreground mt-2">{displaySummary}</p>
                            </div>
                          </div>

                          <div className="flex gap-3">
                            <Button
                              onClick={() =>
                                setExpandedId(expandedId === lesson.id ? null : lesson.id)
                              }
                              variant="success"
                            >
                              Approve
                            </Button>
                            <Button
                              onClick={() =>
                                setExpandedId(expandedId === -lesson.id ? null : -lesson.id)
                              }
                              variant="destructive"
                            >
                              Reject
                            </Button>
                            <Button onClick={() => openLessonModal(lesson.id)} variant="secondary">
                              View
                            </Button>
                          </div>
                          {expandedId === lesson.id && (
                            <div className="mt-4 space-y-4 border-t pt-4">
                              <h3 className="font-semibold">Approve "{lesson.title}"</h3>
                              <div>
                                <Label htmlFor={`approve-comment-lesson-${lesson.id}`}>
                                  Comment (Optional)
                                </Label>
                                <textarea
                                  id={`approve-comment-lesson-${lesson.id}`}
                                  placeholder="Add any notes about this approval..."
                                  value={reviewData[lesson.id]?.comment || ""}
                                  onChange={(e) =>
                                    setReviewData((prev) => ({
                                      ...prev,
                                      [lesson.id]: { comment: e.target.value },
                                    }))
                                  }
                                  className="w-full px-3 py-2 border rounded-md mt-1 min-h-20"
                                />
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  onClick={() => handleApproveLesson(lesson.id)}
                                  variant="success"
                                  className="text-white hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0"
                                  disabled={approveLessonMutation.isPending}
                                >
                                  {approveLessonMutation.isPending
                                    ? "Approving..."
                                    : "Confirm Approve"}
                                </Button>
                                <Button onClick={() => setExpandedId(null)} variant="outline">
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          )}

                          {expandedId === -lesson.id && (
                            <div className="mt-4 space-y-4 border-t pt-4">
                              <h3 className="font-semibold">Reject "{lesson.title}"</h3>
                              <div>
                                <Label htmlFor={`reject-comment-lesson-${lesson.id}`}>
                                  Reason for Rejection
                                </Label>
                                <textarea
                                  id={`reject-comment-lesson-${lesson.id}`}
                                  placeholder="Explain why this item is being rejected..."
                                  value={reviewData[lesson.id]?.comment || ""}
                                  onChange={(e) =>
                                    setReviewData((prev) => ({
                                      ...prev,
                                      [lesson.id]: { comment: e.target.value },
                                    }))
                                  }
                                  className="w-full px-3 py-2 border rounded-md mt-1 min-h-20"
                                />
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  onClick={() => handleRejectLesson(lesson.id)}
                                  variant="destructive"
                                  className="text-white hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0"
                                  disabled={rejectLessonMutation.isPending}
                                >
                                  {rejectLessonMutation.isPending
                                    ? "Rejecting..."
                                    : "Confirm Reject"}
                                </Button>
                                <Button onClick={() => setExpandedId(null)} variant="outline">
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          )}
                        </Card>
                      );
                    })}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </TabsContent>

          <TabsContent value="appeals" className="space-y-4">
            {appeals.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <h2 className="text-xl font-semibold mb-2">No appeals</h2>
                <p>There are no lesson appeals pending review.</p>
              </div>
            ) : (
              <>
                <p className="text-muted-foreground mb-6">
                  Page {page + 1} of {totalPages} • Showing {appeals.length} of {totalElements}{" "}
                  pending {totalElements === 1 ? "item" : "items"}
                </p>

                <div className="grid gap-4">
                  {appeals.map((content: any) => (
                    <Card key={content.id} className="p-6">
                      <div className="mb-4">
                        <h2 className="text-2xl font-bold text-primary">{content.term}</h2>
                        <p className="text-sm text-muted-foreground mt-1">
                          Submitted by: {content.submittedBy}
                        </p>
                      </div>

                      <div className="space-y-3 mb-6">
                        <div>
                          <Label className="font-semibold">Appeal Text</Label>
                          <p className="text-foreground mt-2">{content.definition}</p>
                        </div>

                        <div className="text-xs text-muted-foreground">
                          Created:{" "}
                          {new Date(content.createdAt).toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "2-digit",
                          })}
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <Button
                          onClick={() =>
                            setExpandedId(expandedId === content.id ? null : content.id)
                          }
                          variant="success"
                          className="text-white hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0"
                        >
                          Resolve
                        </Button>
                        <Button
                          onClick={() =>
                            setExpandedId(expandedId === -content.id ? null : -content.id)
                          }
                          variant="destructive"
                          className="text-white hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0"
                        >
                          Reject
                        </Button>
                      </div>

                      {expandedId === content.id && (
                        <div className="mt-4 space-y-4 border-t pt-4">
                          <h3 className="font-semibold">Resolve "{content.term}"</h3>
                          <div>
                            <Label htmlFor={`approve-comment-${content.id}`}>
                              Comment (Optional)
                            </Label>
                            <textarea
                              id={`approve-comment-${content.id}`}
                              placeholder="Add any notes about this resolution..."
                              value={reviewData[content.id]?.comment || ""}
                              onChange={(e) =>
                                setReviewData((prev) => ({
                                  ...prev,
                                  [content.id]: { comment: e.target.value },
                                }))
                              }
                              className="w-full px-3 py-2 border rounded-md mt-1 min-h-20"
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button
                              onClick={() => handleApprove(content.id)}
                              variant="success"
                              className="text-white hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0"
                              disabled={approveMutation.isPending}
                            >
                              {approveMutation.isPending ? "Resolving..." : "Confirm Resolve"}
                            </Button>
                            <Button onClick={() => setExpandedId(null)} variant="outline">
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}

                      {expandedId === -content.id && (
                        <div className="mt-4 space-y-4 border-t pt-4">
                          <h3 className="font-semibold">Reject "{content.term}"</h3>
                          <div>
                            <Label htmlFor={`reject-comment-${content.id}`}>
                              Reason for Rejection
                            </Label>
                            <textarea
                              id={`reject-comment-${content.id}`}
                              placeholder="Explain why this item is being rejected..."
                              value={reviewData[content.id]?.comment || ""}
                              onChange={(e) =>
                                setReviewData((prev) => ({
                                  ...prev,
                                  [content.id]: { comment: e.target.value },
                                }))
                              }
                              className="w-full px-3 py-2 border rounded-md mt-1 min-h-20"
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button
                              onClick={() => handleReject(content.id)}
                              variant="destructive"
                              className="text-white hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0"
                              disabled={rejectMutation.isPending}
                            >
                              {rejectMutation.isPending ? "Rejecting..." : "Confirm Reject"}
                            </Button>
                            <Button onClick={() => setExpandedId(null)} variant="outline">
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}

                      {expandedId === content.id && (
                        <div className="mt-4 space-y-4 border-t pt-4">
                          <h3 className="font-semibold">Resolve "{content.term}"</h3>
                          <div>
                            <Label htmlFor={`approve-comment-${content.id}`}>
                              Comment (Optional)
                            </Label>
                            <textarea
                              id={`approve-comment-${content.id}`}
                              placeholder="Add any notes about this resolution..."
                              value={reviewData[content.id]?.comment || ""}
                              onChange={(e) =>
                                setReviewData((prev) => ({
                                  ...prev,
                                  [content.id]: { comment: e.target.value },
                                }))
                              }
                              className="w-full px-3 py-2 border rounded-md mt-1 min-h-20"
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button
                              onClick={() => handleApprove(content.id)}
                              variant="success"
                              className="text-white hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0"
                              disabled={approveMutation.isPending}
                            >
                              {approveMutation.isPending ? "Resolving..." : "Confirm Resolve"}
                            </Button>
                            <Button onClick={() => setExpandedId(null)} variant="outline">
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}

                      {expandedId === -content.id && (
                        <div className="mt-4 space-y-4 border-t pt-4">
                          <h3 className="font-semibold">Reject "{content.term}"</h3>
                          <div>
                            <Label htmlFor={`reject-comment-${content.id}`}>
                              Reason for Rejection
                            </Label>
                            <textarea
                              id={`reject-comment-${content.id}`}
                              placeholder="Explain why this item is being rejected..."
                              value={reviewData[content.id]?.comment || ""}
                              onChange={(e) =>
                                setReviewData((prev) => ({
                                  ...prev,
                                  [content.id]: { comment: e.target.value },
                                }))
                              }
                              className="w-full px-3 py-2 border rounded-md mt-1 min-h-20"
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button
                              onClick={() => handleReject(content.id)}
                              variant="destructive"
                              className="text-white hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0"
                              disabled={rejectMutation.isPending}
                            >
                              {rejectMutation.isPending ? "Rejecting..." : "Confirm Reject"}
                            </Button>
                            <Button onClick={() => setExpandedId(null)} variant="outline">
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
        {modalLesson && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-card rounded-lg w-11/12 max-w-2xl p-6">
              <div className="flex justify-end items-center mb-4">
                <Button variant="ghost" onClick={closeLessonModal}>
                  Close
                </Button>
              </div>
              {modalLoading ? (
                <div>Loading...</div>
              ) : modalLesson.error ? (
                <div className="text-destructive">{modalLesson.error}</div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-2">
                    {(modalLesson.steps?.steps ?? modalLesson.steps ?? []).map((s: any) => {
                      const stepLabel = (() => {
                        if (!s?.stepType) return null;
                        switch (s.stepType) {
                          case "TEACH":
                            return "Learn";
                          case "QUESTION":
                            return `Question${s.question?.questionType ? ` (${s.question.questionType})` : ""}`;
                          case "DIALOGUE":
                            return "Dialogue";
                          case "RECAP":
                            return "Recap";
                          default:
                            return s.stepType;
                        }
                      })();

                      return (
                        <div key={s.id} className="p-3">
                          {s.stepType === "TEACH" && s.vocab ? (
                            <Card className="border-chart-1/30 bg-chart-1/5">
                              <CardContent className="pt-6">
                                <div className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
                                  {stepLabel}
                                </div>
                                <h2 className="mt-2 text-3xl font-bold">{s.vocab.term}</h2>
                                <p className="mt-4 text-lg">{s.vocab.definition}</p>
                                {s.vocab.exampleSentence && (
                                  <p className="mt-3 text-sm italic text-muted-foreground">
                                    "{s.vocab.exampleSentence}"
                                  </p>
                                )}
                              </CardContent>
                            </Card>
                          ) : s.stepType === "QUESTION" && s.question ? (
                            <Card className="border-chart-1/30 bg-chart-1/5">
                              <CardContent className="pt-6">
                                <div className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
                                  {stepLabel}
                                </div>
                                <h3 className="mt-2 text-2xl font-semibold">{s.question.prompt}</h3>

                                {s.question.questionType === "MATCH" &&
                                Array.isArray(s.question.matchPairs) &&
                                s.question.matchPairs.length > 0 ? (
                                  <div className="mt-4 space-y-2">
                                    <div className="text-sm font-semibold text-muted-foreground">
                                      Match pairs:
                                    </div>
                                    {s.question.matchPairs.map((pair: any, idx: number) => (
                                      <div key={pair.id ?? idx} className="flex gap-4">
                                        <div className="flex-1 rounded border px-3 py-2 bg-card/80 border-border">
                                          <div className="text-sm">{pair.left}</div>
                                        </div>
                                        <div className="text-muted-foreground text-lg">→</div>
                                        <div className="flex-1 rounded border px-3 py-2 bg-green-500/10 border-green-500/30">
                                          <div className="text-sm text-green-600">{pair.right}</div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : Array.isArray(s.question.choices) &&
                                  s.question.choices.length > 0 ? (
                                  <div className="mt-4 space-y-3">
                                    {s.question.choices.map((c: any, idx: number) => (
                                      <div
                                        key={c.id ?? idx}
                                        className={`w-full rounded border px-4 py-3 flex justify-between items-center ${c.isCorrect ? "border-green-500 bg-[rgba(72,187,120,0.06)]" : "bg-card/80 border-border"}`}
                                      >
                                        <div className="text-base">{c.text}</div>
                                        {c.isCorrect ? (
                                          <div className="text-sm text-green-500 font-semibold">
                                            Correct
                                          </div>
                                        ) : null}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="mt-4 text-sm">
                                    <div className="font-semibold">Accepted answers</div>
                                    <ul className="list-disc ml-5 mt-2">
                                      {(s.question.acceptedAnswers ?? []).map(
                                        (a: any, i: number) => (
                                          <li key={i}>{a}</li>
                                        ),
                                      )}
                                    </ul>
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          ) : s.stepType === "DIALOGUE" && (s.dialogueText || s.payload?.text) ? (
                            <Card className="border-chart-1/30 bg-chart-1/5">
                              <CardContent className="pt-6">
                                <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
                                  Dialogue
                                </p>
                                <p className="mt-3 text-lg whitespace-pre-wrap">
                                  {s.dialogueText ?? s.payload?.text}
                                </p>
                              </CardContent>
                            </Card>
                          ) : (
                            <div className="p-3 border rounded">
                              {stepLabel}: {JSON.stringify(s)}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export const Route = createFileRoute("/review")({
  beforeLoad: requireOnboardingCompleted,
  component: ReviewPage,
});
