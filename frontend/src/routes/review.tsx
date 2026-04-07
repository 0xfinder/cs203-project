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
  const [contentSubTab, setContentSubTab] = useState("term");
  useEffect(() => {
    try {
      const pref = sessionStorage.getItem("reviewActiveSub");
      if (pref === "lesson") {
        setContentSubTab("lesson");
        sessionStorage.removeItem("reviewActiveSub");
      }
    } catch (e) {
      console.error("failed to read review active sub from session storage:", e);
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
  const termItems = pendingContents;
  const { data: pendingLessons } = usePendingLessons();
  const lessonItems: any[] = Array.isArray(pendingLessons) ? pendingLessons : [];
  const { data: units } = useUnits();
  const [firstStepMap, setFirstStepMap] = useState<
    Record<number, { stepType?: string; questionType?: string | null; prompt?: string | null }>
  >({});
  const [debugInfo, setDebugInfo] = useState<{
    serverPendingCount?: number;
    serverAllCount?: number;
  } | null>(null);
  const [modalLesson, setModalLesson] = useState<any>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const openLessonModal = async (id: number) => {
    setModalLoading(true);
    try {
      const detail = await api.get(`lessons/${id}`).json<any>();
      const steps = detail?.steps ?? [];
      setModalLesson({ detail, steps });
    } catch (e) {
      console.error("failed to open lesson modal:", e);
      setModalLesson({ error: String(e) });
    } finally {
      setModalLoading(false);
    }
  };
  const closeLessonModal = () => setModalLesson(null);
  const totalPages = response?.totalPages || 0;
  const totalElements = response?.totalElements || 0;

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
    void (async () => {
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
        console.error("failed to fetch debug info for lessons:", e);
        if (!mounted) return;
        setDebugInfo({});
      }
    })();

    return () => {
      mounted = false;
    };
  }, [hasAccess, lessonItems]);

  // For pending lessons that don't include firstStepType/firstQuestionType, fetch their first step so we can show Type on the card.
  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const toFetch = lessonItems.filter(
          (l: any) => !(l.firstStepType || l.firstQuestionType) && !firstStepMap[l.id],
        );
        for (const l of toFetch) {
          try {
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
          } catch (e) {
            console.error("failed to fetch first step for lesson:", e);
            // ignore per-lesson fetch failures
          }
        }
      } catch (e) {
        console.error("failed to fetch first steps for lessons:", e);
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
    const comment = reviewData[id]?.comment;
    approveLessonMutation.mutate(
      { id, reviewComment: comment },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({ queryKey: ["units"] });
          // Invalidate all lesson play queries to refresh with new steps
          void queryClient.invalidateQueries({ queryKey: ["lessons", "play"] });
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
            console.error("failed to parse error response from approve lesson:", e);
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
            console.error("failed to parse error response from reject lesson:", e);
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
                  Page {page + 1} of {totalPages} • Showing {termItems.length} of {totalElements}{" "}
                  pending {totalElements === 1 ? "item" : "items"}
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
                  const unit = units?.find((u: any) => u.id === lesson.unitId);
                  // prefer server-provided metadata, fall back to client-cached firstStepMap
                  const firstMeta = {
                    stepType: lesson.firstStepType ?? firstStepMap[lesson.id]?.stepType,
                    questionType: lesson.firstQuestionType ?? firstStepMap[lesson.id]?.questionType,
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
                          return (
                            <p className="text-sm text-muted-foreground mt-1">
                              Unit: {unit?.title ?? lesson.unitId}
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
                          onClick={() => setExpandedId(expandedId === lesson.id ? null : lesson.id)}
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
                              {approveLessonMutation.isPending ? "Approving..." : "Confirm Approve"}
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
                              {rejectLessonMutation.isPending ? "Rejecting..." : "Confirm Reject"}
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
