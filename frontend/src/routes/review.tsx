import { createFileRoute } from "@tanstack/react-router";
import {
  usePendingContentsPaginated,
  useApproveContent,
  useRejectContent,
} from "@/features/content/useContentData";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { requireOnboardingCompleted } from "@/lib/auth";
import { getMe } from "@/lib/me";
import { usePendingLessons, useUnits } from "@/features/lessons/useLessonsApi";
import { api } from "@/lib/api";

function ReviewPage() {
  const [page, setPage] = useState(0);
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
  const { data: response, isLoading, error } = usePendingContentsPaginated(page, pageSize);
  const approveMutation = useApproveContent();
  const rejectMutation = useRejectContent();
  const pendingContents = response?.content || [];
  const appeals = pendingContents.filter((c: any) => typeof c.term === "string" && c.term.startsWith("Appeal:"));
  const newContents = pendingContents.filter((c: any) => !(typeof c.term === "string" && c.term.startsWith("Appeal:")));
  // pending contents endpoint currently returns submitted term/content items only
  const termItems = newContents;
  const quizItems: any[] = [];
  const { data: pendingLessons } = usePendingLessons();
  const lessonItems: any[] = Array.isArray(pendingLessons) ? pendingLessons : [];
  const { data: units } = useUnits();
  const [debugInfo, setDebugInfo] = useState<{ serverPendingCount?: number; serverAllCount?: number } | null>(null);
  const [modalLesson, setModalLesson] = useState<any | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const openLessonModal = async (id: number) => {
    setModalLoading(true);
    try {
      const detail = await api.get(`lessons/${id}`).json<any>();
      const steps = await api.get(`lessons/${id}/content`).json<any>();
      setModalLesson({ detail, steps });
    } catch (e) {
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
    (async () => {
      try {
        const serverPending = await api.get("lessons", { searchParams: { status: "PENDING_REVIEW" } }).json<any[]>();
        const serverAll = await api.get("lessons").json<any[]>();
        if (!mounted) return;
        setDebugInfo({ serverPendingCount: Array.isArray(serverPending) ? serverPending.length : undefined, serverAllCount: Array.isArray(serverAll) ? serverAll.length : undefined });
      } catch (e) {
        if (!mounted) return;
        setDebugInfo({});
      }
    })();

    return () => { mounted = false; };
  }, [hasAccess, lessonItems]);

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
            <TabsTrigger value="content" className="px-8 py-2">
              Content
            </TabsTrigger>
            <TabsTrigger value="appeals" className="px-8 py-2">
              Appeals
            </TabsTrigger>
          </TabsList>

          <TabsContent value="content" className="space-y-4">
            <Tabs value={contentSubTab} onValueChange={setContentSubTab}>
              <TabsList className="mb-6 grid w-full grid-cols-2">
                <TabsTrigger value="term">Term</TabsTrigger>
                <TabsTrigger value="lesson">Lesson</TabsTrigger>
              </TabsList>

              <TabsContent value="term">
                {termItems.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <h2 className="text-xl font-semibold mb-2">No term items to review</h2>
                  </div>
                ) : (
                  <>
                    <p className="text-muted-foreground mb-6">Page {page + 1} of {totalPages} • Showing {termItems.length} of {totalElements} pending {totalElements === 1 ? "item" : "items"}</p>
                    <div className="grid gap-4">
                      {termItems.map((content: any) => (
                        <Card key={content.id} className="p-6">
                          <div className="mb-4">
                            <h2 className="text-2xl font-bold text-primary">{content.term}</h2>
                            <p className="text-sm text-muted-foreground mt-1">Submitted by: {content.submittedBy}</p>
                          </div>

                          <div className="space-y-3 mb-6">
                            <div>
                              <Label className="font-semibold">Definition</Label>
                              <p className="text-foreground mt-2">{content.definition}</p>
                            </div>

                            {content.example && (
                              <div>
                                <Label className="font-semibold">Example</Label>
                                <p className="text-foreground mt-2">{content.example}</p>
                              </div>
                            )}

                            <div className="text-xs text-muted-foreground">Created: {new Date(content.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "2-digit" })}</div>
                          </div>

                          <div className="flex gap-3">
                            <Button onClick={() => setExpandedId(expandedId === content.id ? null : content.id)} variant="success">Approve</Button>
                            <Button onClick={() => setExpandedId(expandedId === -content.id ? null : -content.id)} variant="destructive">Reject</Button>
                          </div>

                          {expandedId === content.id && (
                            <div className="mt-4 space-y-4 border-t pt-4">
                              <h3 className="font-semibold">Approve "{content.term}"</h3>
                              <div>
                                <Label htmlFor={`approve-comment-${content.id}`}>Comment (Optional)</Label>
                                <textarea id={`approve-comment-${content.id}`} placeholder="Add any notes about this approval..." value={reviewData[content.id]?.comment || ""} onChange={(e) => setReviewData((prev) => ({ ...prev, [content.id]: { comment: e.target.value } }))} className="w-full px-3 py-2 border rounded-md mt-1 min-h-20" />
                              </div>
                              <div className="flex gap-2">
                                <Button onClick={() => handleApprove(content.id)} variant="success" className="text-white hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0" disabled={approveMutation.isPending}>{approveMutation.isPending ? "Approving..." : "Confirm Approve"}</Button>
                                <Button onClick={() => setExpandedId(null)} variant="outline">Cancel</Button>
                              </div>
                            </div>
                          )}

                          {expandedId === -content.id && (
                            <div className="mt-4 space-y-4 border-t pt-4">
                              <h3 className="font-semibold">Reject "{content.term}"</h3>
                              <div>
                                <Label htmlFor={`reject-comment-${content.id}`}>Reason for Rejection</Label>
                                <textarea id={`reject-comment-${content.id}`} placeholder="Explain why this item is being rejected..." value={reviewData[content.id]?.comment || ""} onChange={(e) => setReviewData((prev) => ({ ...prev, [content.id]: { comment: e.target.value } }))} className="w-full px-3 py-2 border rounded-md mt-1 min-h-20" />
                              </div>
                              <div className="flex gap-2">
                                <Button onClick={() => handleReject(content.id)} variant="destructive" className="text-white hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0" disabled={rejectMutation.isPending}>{rejectMutation.isPending ? "Rejecting..." : "Confirm Reject"}</Button>
                                <Button onClick={() => setExpandedId(null)} variant="outline">Cancel</Button>
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
                        <div>Server pending count: {typeof debugInfo.serverPendingCount === "number" ? debugInfo.serverPendingCount : "?"}</div>
                        <div>Server total lessons: {typeof debugInfo.serverAllCount === "number" ? debugInfo.serverAllCount : "?"}</div>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {lessonItems.map((lesson: any) => {
                      const unit = units?.find((u: any) => u.id === lesson.unitId);
                      return (
                        <Card key={lesson.id} className="p-6">
                          <div className="mb-4">
                            <h2 className="text-2xl font-bold text-primary">{lesson.title}</h2>
                            <p className="text-sm text-muted-foreground mt-1">Unit: {unit?.title ?? lesson.unitId} • Status: {lesson.status}</p>
                          </div>

                          <div className="space-y-3 mb-6">
                            <div>
                              <Label className="font-semibold">Summary</Label>
                              <p className="text-foreground mt-2">{lesson.description}</p>
                            </div>
                          </div>

                          <div className="flex gap-3">
                            <Button onClick={() => setExpandedId(expandedId === lesson.id ? null : lesson.id)} variant="success">Approve</Button>
                            <Button onClick={() => setExpandedId(expandedId === -lesson.id ? null : -lesson.id)} variant="destructive">Reject</Button>
                            <Button onClick={() => openLessonModal(lesson.id)} variant="secondary">View</Button>
                          </div>
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
                <p className="text-muted-foreground mb-6">Page {page + 1} of {totalPages} • Showing {appeals.length} of {totalElements} pending {totalElements === 1 ? "item" : "items"}</p>

                <div className="grid gap-4">
                  {appeals.map((content: any) => (
                    <Card key={content.id} className="p-6">
                      <div className="mb-4">
                        <h2 className="text-2xl font-bold text-primary">{content.term}</h2>
                        <p className="text-sm text-muted-foreground mt-1">Submitted by: {content.submittedBy}</p>
                      </div>

                      <div className="space-y-3 mb-6">
                        <div>
                          <Label className="font-semibold">Appeal Text</Label>
                          <p className="text-foreground mt-2">{content.definition}</p>
                        </div>

                        <div className="text-xs text-muted-foreground">Created: {new Date(content.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "2-digit" })}</div>
                      </div>

                        <div className="flex gap-3">
                          <Button onClick={() => setExpandedId(expandedId === content.id ? null : content.id)} variant="success" className="text-white hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0">Resolve</Button>
                          <Button onClick={() => setExpandedId(expandedId === -content.id ? null : -content.id)} variant="destructive" className="text-white hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0">Reject</Button>
                        </div>

                      {expandedId === content.id && (
                        <div className="mt-4 space-y-4 border-t pt-4">
                          <h3 className="font-semibold">Resolve "{content.term}"</h3>
                          <div>
                            <Label htmlFor={`approve-comment-${content.id}`}>Comment (Optional)</Label>
                            <textarea id={`approve-comment-${content.id}`} placeholder="Add any notes about this resolution..." value={reviewData[content.id]?.comment || ""} onChange={(e) => setReviewData((prev) => ({ ...prev, [content.id]: { comment: e.target.value } }))} className="w-full px-3 py-2 border rounded-md mt-1 min-h-20" />
                          </div>
                          <div className="flex gap-2">
                            <Button onClick={() => handleApprove(content.id)} variant="success" className="text-white hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0" disabled={approveMutation.isPending}>{approveMutation.isPending ? "Resolving..." : "Confirm Resolve"}</Button>
                            <Button onClick={() => setExpandedId(null)} variant="outline">Cancel</Button>
                          </div>
                        </div>
                      )}

                      {expandedId === -content.id && (
                        <div className="mt-4 space-y-4 border-t pt-4">
                          <h3 className="font-semibold">Reject "{content.term}"</h3>
                          <div>
                            <Label htmlFor={`reject-comment-${content.id}`}>Reason for Rejection</Label>
                            <textarea id={`reject-comment-${content.id}`} placeholder="Explain why this item is being rejected..." value={reviewData[content.id]?.comment || ""} onChange={(e) => setReviewData((prev) => ({ ...prev, [content.id]: { comment: e.target.value } }))} className="w-full px-3 py-2 border rounded-md mt-1 min-h-20" />
                          </div>
                          <div className="flex gap-2">
                            <Button onClick={() => handleReject(content.id)} variant="destructive" className="text-white hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0" disabled={rejectMutation.isPending}>{rejectMutation.isPending ? "Rejecting..." : "Confirm Reject"}</Button>
                            <Button onClick={() => setExpandedId(null)} variant="outline">Cancel</Button>
                          </div>
                        </div>
                      )}

                      {expandedId === content.id && (
                        <div className="mt-4 space-y-4 border-t pt-4">
                          <h3 className="font-semibold">Resolve "{content.term}"</h3>
                          <div>
                            <Label htmlFor={`approve-comment-${content.id}`}>Comment (Optional)</Label>
                            <textarea id={`approve-comment-${content.id}`} placeholder="Add any notes about this resolution..." value={reviewData[content.id]?.comment || ""} onChange={(e) => setReviewData((prev) => ({ ...prev, [content.id]: { comment: e.target.value } }))} className="w-full px-3 py-2 border rounded-md mt-1 min-h-20" />
                          </div>
                          <div className="flex gap-2">
                            <Button onClick={() => handleApprove(content.id)} variant="success" className="text-white hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0" disabled={approveMutation.isPending}>{approveMutation.isPending ? "Resolving..." : "Confirm Resolve"}</Button>
                            <Button onClick={() => setExpandedId(null)} variant="outline">Cancel</Button>
                          </div>
                        </div>
                      )}

                      {expandedId === -content.id && (
                        <div className="mt-4 space-y-4 border-t pt-4">
                          <h3 className="font-semibold">Reject "{content.term}"</h3>
                          <div>
                            <Label htmlFor={`reject-comment-${content.id}`}>Reason for Rejection</Label>
                            <textarea id={`reject-comment-${content.id}`} placeholder="Explain why this item is being rejected..." value={reviewData[content.id]?.comment || ""} onChange={(e) => setReviewData((prev) => ({ ...prev, [content.id]: { comment: e.target.value } }))} className="w-full px-3 py-2 border rounded-md mt-1 min-h-20" />
                          </div>
                          <div className="flex gap-2">
                            <Button onClick={() => handleReject(content.id)} variant="destructive" className="text-white hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0" disabled={rejectMutation.isPending}>{rejectMutation.isPending ? "Rejecting..." : "Confirm Reject"}</Button>
                            <Button onClick={() => setExpandedId(null)} variant="outline">Cancel</Button>
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
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">{modalLesson.detail?.title ?? "Lesson"}</h3>
                <Button variant="ghost" onClick={closeLessonModal}>Close</Button>
              </div>
              {modalLoading ? (
                <div>Loading...</div>
              ) : modalLesson.error ? (
                <div className="text-destructive">{modalLesson.error}</div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">{modalLesson.detail?.description}</p>
                  <div className="space-y-2">
                    {(modalLesson.steps?.steps ?? modalLesson.steps ?? []).map((s: any) => (
                      <div key={s.id} className="p-3 border rounded">
                        <div className="text-sm font-medium">Type: {s.stepType}</div>
                        {s.stepType === "TEACH" && s.vocab && (
                          <div className="mt-2">
                            <div className="font-semibold">{s.vocab.term}</div>
                            <div className="text-sm">{s.vocab.definition}</div>
                          </div>
                        )}
                        {s.stepType === "QUESTION" && s.question && (
                          <div className="mt-2">
                            <div className="font-semibold">Question: {s.question.prompt}</div>
                            <div className="text-sm">Type: {s.question.questionType}</div>
                          </div>
                        )}
                      </div>
                    ))}
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
