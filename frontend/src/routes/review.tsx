import { createFileRoute } from "@tanstack/react-router";
import {
  usePendingContentsPaginated,
  useApproveContent,
  useRejectContent,
} from "@/features/content/useContentData";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { requireOnboardingCompleted } from "@/lib/auth";

function ReviewPage() {
  const [page, setPage] = useState(0);
  const pageSize = 10;
  const { data: response, isLoading, error } = usePendingContentsPaginated(page, pageSize);
  const approveMutation = useApproveContent();
  const rejectMutation = useRejectContent();

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [reviewData, setReviewData] = useState<{
    [key: number]: { comment: string; reviewer: string };
  }>({});

  const handleApprove = async (id: number) => {
    const reviewer = reviewData[id]?.reviewer || "Admin";
    const comment = reviewData[id]?.comment;

    approveMutation.mutate({ id, reviewer, reviewComment: comment });
    setReviewData((prev) => {
      const newData = { ...prev };
      delete newData[id];
      return newData;
    });
    setExpandedId(null);
  };

  const handleReject = async (id: number) => {
    const reviewer = reviewData[id]?.reviewer || "Admin";
    const comment = reviewData[id]?.comment || "No reason provided";

    rejectMutation.mutate({ id, reviewer, reviewComment: comment });
    setReviewData((prev) => {
      const newData = { ...prev };
      delete newData[id];
      return newData;
    });
    setExpandedId(null);
  };

  if (isLoading) {
    return <div className="p-8 text-center">Loading pending items...</div>;
  }

  if (error) {
    return (
      <div className="p-8 text-center text-destructive">Error loading items: {error.message}</div>
    );
  }

  if (!response || response.content.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <h2 className="text-xl font-semibold mb-2">No items to review</h2>
        <p>All pending items have been reviewed.</p>
      </div>
    );
  }

  const pendingContents = response.content;
  const totalPages = response.totalPages;
  const totalElements = response.totalElements;

  return (
    <div className="flex-1 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Review Items</h1>
        <p className="text-muted-foreground mb-6">
          Page {page + 1} of {totalPages} • Showing {pendingContents.length} of {totalElements}{" "}
          pending {totalElements === 1 ? "item" : "items"}
        </p>

        <div className="grid gap-4">
          {pendingContents.map((content: any) => (
            <Card key={content.id} className="p-6">
              <div className="mb-4">
                <h2 className="text-2xl font-bold text-primary">{content.term}</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Submitted by: {content.submittedBy}
                </p>
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

                <div className="text-xs text-muted-foreground">
                  Created: {new Date(content.createdAt).toLocaleDateString()}
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={() => setExpandedId(expandedId === content.id ? null : content.id)}
                  variant="success"
                  className="text-white hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0"
                >
                  Approve
                </Button>
                <Button
                  onClick={() => setExpandedId(expandedId === -content.id ? null : -content.id)}
                  variant="destructive"
                  className="text-white hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0"
                >
                  Reject
                </Button>
              </div>

              {expandedId === content.id && (
                <div className="mt-4 space-y-4 border-t pt-4">
                  <h3 className="font-semibold">Approve "{content.term}"</h3>
                  <div>
                    <Label htmlFor={`reviewer-${content.id}`}>Your Name</Label>
                    <input
                      id={`reviewer-${content.id}`}
                      type="text"
                      placeholder="Admin"
                      value={reviewData[content.id]?.reviewer || ""}
                      onChange={(e) =>
                        setReviewData((prev) => ({
                          ...prev,
                          [content.id]: {
                            ...prev[content.id],
                            reviewer: e.target.value,
                          },
                        }))
                      }
                      className="w-full px-3 py-2 border rounded-md mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor={`approve-comment-${content.id}`}>Comment (Optional)</Label>
                    <textarea
                      id={`approve-comment-${content.id}`}
                      placeholder="Add any notes about this approval..."
                      value={reviewData[content.id]?.comment || ""}
                      onChange={(e) =>
                        setReviewData((prev) => ({
                          ...prev,
                          [content.id]: {
                            ...prev[content.id],
                            comment: e.target.value,
                          },
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
                    <Label htmlFor={`reject-reviewer-${content.id}`}>Your Name</Label>
                    <input
                      id={`reject-reviewer-${content.id}`}
                      type="text"
                      placeholder="Admin"
                      value={reviewData[content.id]?.reviewer || ""}
                      onChange={(e) =>
                        setReviewData((prev) => ({
                          ...prev,
                          [content.id]: {
                            ...prev[content.id],
                            reviewer: e.target.value,
                          },
                        }))
                      }
                      className="w-full px-3 py-2 border rounded-md mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor={`reject-comment-${content.id}`}>Reason for Rejection</Label>
                    <textarea
                      id={`reject-comment-${content.id}`}
                      placeholder="Explain why this item is being rejected..."
                      value={reviewData[content.id]?.comment || ""}
                      onChange={(e) =>
                        setReviewData((prev) => ({
                          ...prev,
                          [content.id]: {
                            ...prev[content.id],
                            comment: e.target.value,
                          },
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

        <div className="mt-8 flex justify-between items-center">
          <Button
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
            variant="outline"
          >
            ← Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page + 1} of {totalPages}
          </span>
          <Button
            onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
            disabled={page === totalPages - 1}
            variant="outline"
          >
            Next →
          </Button>
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/review")({
  beforeLoad: requireOnboardingCompleted,
  component: ReviewPage,
});
