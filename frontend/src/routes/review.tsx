import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { BookOpenText, Clock3, Eye, FileWarning, MessageSquareQuote } from "lucide-react";
import { AppPageShell } from "@/components/app-page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Dialog, { DialogContent } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useApproveContent,
  usePendingContentsPaginated,
  useRejectContent,
} from "@/features/content/useContentData";
import {
  type LessonDetail,
  type LessonStepPayload,
  type LessonSummary,
  useApproveLesson,
  useLessonForEdit,
  usePendingLessons,
  useRejectLesson,
  useUnits,
} from "@/features/lessons/useLessonsApi";
import { requireModeratorRole } from "@/lib/auth";

export const Route = createFileRoute("/review")({
  beforeLoad: requireModeratorRole,
  component: ReviewPage,
});

type ReviewCommentMap = Record<number, { comment?: string }>;

function ReviewPage() {
  const [page] = useState(0);
  const [contentSubTab, setContentSubTab] = useState("term");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [reviewData, setReviewData] = useState<ReviewCommentMap>({});
  const [selectedLessonId, setSelectedLessonId] = useState<number | null>(null);

  useEffect(() => {
    try {
      const pref = sessionStorage.getItem("reviewActiveSub");
      if (pref === "lesson") {
        setContentSubTab("lesson");
        sessionStorage.removeItem("reviewActiveSub");
      }
    } catch (error) {
      console.error("failed to read review active sub from session storage:", error);
    }
  }, []);

  const pageSize = 10;
  const { data: response, isLoading } = usePendingContentsPaginated(page, pageSize);
  const approveMutation = useApproveContent();
  const rejectMutation = useRejectContent();
  const approveLessonMutation = useApproveLesson();
  const rejectLessonMutation = useRejectLesson();
  const { data: pendingLessons } = usePendingLessons();
  const { data: units } = useUnits();
  const lessonDetailQuery = useLessonForEdit(selectedLessonId ?? 0);

  const termItems = response?.content || [];
  const lessonItems: LessonSummary[] = Array.isArray(pendingLessons) ? pendingLessons : [];
  const totalPages = response?.totalPages || 0;
  const totalElements = response?.totalElements || 0;
  const unitTitleById = useMemo(
    () => new Map((units ?? []).map((unit) => [unit.id, unit.title])),
    [units],
  );

  function clearReviewState(id: number) {
    setReviewData((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setExpandedId(null);
  }

  function handleApprove(id: number) {
    const comment = reviewData[id]?.comment;
    approveMutation.mutate({ id, reviewComment: comment });
    clearReviewState(id);
  }

  function handleReject(id: number) {
    const comment = reviewData[id]?.comment || "No reason provided";
    rejectMutation.mutate({ id, reviewComment: comment });
    clearReviewState(id);
  }

  function handleApproveLesson(id: number) {
    const comment = reviewData[id]?.comment;
    approveLessonMutation.mutate({ id, reviewComment: comment });
    clearReviewState(id);
  }

  function handleRejectLesson(id: number) {
    const comment = reviewData[id]?.comment || "No reason provided";
    rejectLessonMutation.mutate({ id, reviewComment: comment });
    clearReviewState(id);
  }

  if (isLoading) {
    return <div className="p-8 text-center">Loading pending items...</div>;
  }

  return (
    <AppPageShell contentClassName="max-w-5xl">
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Review</h1>
          <p className="text-sm text-muted-foreground">
            Moderate pending submissions here. Contributors revise rejected lessons later in `/add
            &gt; My Lessons`.
          </p>
        </div>

        <Tabs value={contentSubTab} onValueChange={setContentSubTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="term" className="flex items-center justify-center gap-2">
              <span>Term</span>
              {termItems.length > 0 ? (
                <Badge variant="outline" className="border-primary/50 text-primary">
                  {termItems.length}
                </Badge>
              ) : null}
            </TabsTrigger>
            <TabsTrigger value="lesson" className="flex items-center justify-center gap-2">
              <span>Lesson</span>
              {lessonItems.length > 0 ? (
                <Badge variant="outline" className="border-primary/50 text-primary">
                  {lessonItems.length}
                </Badge>
              ) : null}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="term" className="space-y-6">
            {termItems.length === 0 ? (
              <EmptyReviewState
                title="No term items to review"
                description="New term submissions will appear here when contributors send them for moderation."
              />
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Page {page + 1} of {totalPages} • Showing {termItems.length} of {totalElements}{" "}
                  pending {totalElements === 1 ? "item" : "items"}
                </p>

                <div className="grid gap-4">
                  {termItems.map((content: any) => (
                    <Card key={content.id} className="border-border/70 shadow-sm">
                      <CardContent className="space-y-6 p-6">
                        <div className="space-y-2">
                          <h2 className="text-2xl font-bold text-primary">{content.term}</h2>
                          <p className="text-sm text-muted-foreground">
                            Submitted by: {content.submittedBy}
                          </p>
                        </div>

                        <div className="space-y-4">
                          <div>
                            <Label className="font-semibold">Definition</Label>
                            <p className="mt-2 text-foreground">{content.definition}</p>
                          </div>

                          {content.example ? (
                            <div>
                              <Label className="font-semibold">Example</Label>
                              <p className="mt-2 text-foreground">{content.example}</p>
                            </div>
                          ) : null}

                          <p className="text-xs text-muted-foreground">
                            Created:{" "}
                            {new Date(content.createdAt).toLocaleDateString("en-GB", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "2-digit",
                            })}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-3">
                          <Button
                            className="bg-green-600 text-white hover:-translate-y-0.5 hover:bg-green-550 hover:shadow-lg active:translate-y-0"
                            onClick={() =>
                              setExpandedId(expandedId === content.id ? null : content.id)
                            }
                          >
                            Approve
                          </Button>
                          <Button
                            variant="destructive"
                            className="text-white hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0"
                            onClick={() =>
                              setExpandedId(expandedId === -content.id ? null : -content.id)
                            }
                          >
                            Reject
                          </Button>
                        </div>

                        {expandedId === content.id ? (
                          <ReviewDecisionPanel
                            title={`Approve "${content.term}"`}
                            description="Optional notes can explain why this submission is ready to go live."
                            label="Comment (Optional)"
                            placeholder="Add any notes about this approval..."
                            value={reviewData[content.id]?.comment || ""}
                            onChange={(value) =>
                              setReviewData((prev) => ({
                                ...prev,
                                [content.id]: { comment: value },
                              }))
                            }
                            onConfirm={() => handleApprove(content.id)}
                            onCancel={() => setExpandedId(null)}
                            confirmLabel={
                              approveMutation.isPending ? "Approving..." : "Confirm Approve"
                            }
                            confirmVariant="success"
                            confirmDisabled={approveMutation.isPending}
                          />
                        ) : null}

                        {expandedId === -content.id ? (
                          <ReviewDecisionPanel
                            title={`Reject "${content.term}"`}
                            description="This feedback will be stored as the moderator reason for rejection."
                            label="Reason for Rejection"
                            placeholder="Explain why this item is being rejected..."
                            value={reviewData[content.id]?.comment || ""}
                            onChange={(value) =>
                              setReviewData((prev) => ({
                                ...prev,
                                [content.id]: { comment: value },
                              }))
                            }
                            onConfirm={() => handleReject(content.id)}
                            onCancel={() => setExpandedId(null)}
                            confirmLabel={
                              rejectMutation.isPending ? "Rejecting..." : "Confirm Reject"
                            }
                            confirmVariant="destructive"
                            confirmDisabled={rejectMutation.isPending}
                          />
                        ) : null}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="lesson" className="space-y-6">
            {lessonItems.length === 0 ? (
              <EmptyReviewState
                title="No lesson items to review"
                description="Pending lesson submissions will appear here. Rejected lessons now route back to contributors through `/add > My Lessons`."
              />
            ) : (
              <div className="grid gap-4">
                {lessonItems.map((lesson) => (
                  <Card key={lesson.id} className="border-border/70 shadow-sm">
                    <CardContent className="space-y-6 p-6">
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="secondary" className="px-3 py-1">
                              Pending Review
                            </Badge>
                            <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                              {unitTitleById.get(lesson.unitId) ?? `Unit ${lesson.unitId}`}
                            </span>
                          </div>
                          <div>
                            <h2 className="text-2xl font-bold text-primary">{lesson.title}</h2>
                            {lesson.submittedBy ? (
                              <p className="mt-1 text-sm text-muted-foreground">
                                Submitted by: {lesson.submittedBy}
                              </p>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                          {lesson.estimatedMinutes ? (
                            <span className="inline-flex items-center gap-1.5">
                              <Clock3 className="size-4" />
                              {lesson.estimatedMinutes} min
                            </span>
                          ) : null}
                          <Button
                            variant="secondary"
                            className="gap-2"
                            onClick={() => setSelectedLessonId(lesson.id)}
                          >
                            <Eye className="size-4" />
                            View Submission
                          </Button>
                        </div>
                      </div>

                      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
                        <div className="space-y-4">
                          <div>
                            <Label className="font-semibold">Summary</Label>
                            <p className="mt-2 text-foreground">{lesson.description}</p>
                          </div>

                          {lesson.learningObjective ? (
                            <div>
                              <Label className="font-semibold">Learning objective</Label>
                              <p className="mt-2 text-foreground">{lesson.learningObjective}</p>
                            </div>
                          ) : null}
                        </div>

                        <div className="rounded-2xl border border-amber-300/60 bg-amber-50/70 p-4 text-sm text-amber-900">
                          <div className="flex items-start gap-2">
                            <MessageSquareQuote className="mt-0.5 size-4 shrink-0" />
                            <div>
                              <p className="font-semibold">Contributor handoff</p>
                              <p className="mt-1">
                                If you reject this lesson, the contributor will revise it later in
                                `/add &gt; My Lessons` using the feedback you leave here.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-3">
                        <Button
                          variant="success"
                          onClick={() => setExpandedId(expandedId === lesson.id ? null : lesson.id)}
                        >
                          Approve
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={() =>
                            setExpandedId(expandedId === -lesson.id ? null : -lesson.id)
                          }
                        >
                          Reject
                        </Button>
                      </div>

                      {expandedId === lesson.id ? (
                        <ReviewDecisionPanel
                          title={`Approve "${lesson.title}"`}
                          description="Optional notes can explain why this lesson is ready for the live curriculum."
                          label="Comment (Optional)"
                          placeholder="Add any notes about this approval..."
                          value={reviewData[lesson.id]?.comment || ""}
                          onChange={(value) =>
                            setReviewData((prev) => ({
                              ...prev,
                              [lesson.id]: { comment: value },
                            }))
                          }
                          onConfirm={() => handleApproveLesson(lesson.id)}
                          onCancel={() => setExpandedId(null)}
                          confirmLabel={
                            approveLessonMutation.isPending ? "Approving..." : "Confirm Approve"
                          }
                          confirmVariant="success"
                          confirmDisabled={approveLessonMutation.isPending}
                        />
                      ) : null}

                      {expandedId === -lesson.id ? (
                        <ReviewDecisionPanel
                          title={`Reject "${lesson.title}"`}
                          description="This feedback is what the contributor will see when the lesson returns to `/add > My Lessons` for revision."
                          label="Reason for Rejection"
                          placeholder="Explain what needs to change before this lesson can be approved..."
                          value={reviewData[lesson.id]?.comment || ""}
                          onChange={(value) =>
                            setReviewData((prev) => ({
                              ...prev,
                              [lesson.id]: { comment: value },
                            }))
                          }
                          onConfirm={() => handleRejectLesson(lesson.id)}
                          onCancel={() => setExpandedId(null)}
                          confirmLabel={
                            rejectLessonMutation.isPending ? "Rejecting..." : "Confirm Reject"
                          }
                          confirmVariant="destructive"
                          confirmDisabled={rejectLessonMutation.isPending}
                        />
                      ) : null}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog
        open={selectedLessonId !== null}
        onOpenChange={(open) => !open && setSelectedLessonId(null)}
      >
        <DialogContent
          title={
            lessonDetailQuery.data
              ? `Submission Preview: ${lessonDetailQuery.data.title}`
              : "Submission Preview"
          }
          description="Read-only lesson preview for moderation. Contributors revise rejected lessons later in `/add > My Lessons`."
          className="max-w-4xl"
        >
          {lessonDetailQuery.isLoading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Loading lesson...</div>
          ) : lessonDetailQuery.error || !lessonDetailQuery.data ? (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              Couldn&apos;t load this lesson preview.
            </div>
          ) : (
            <LessonSubmissionPreview
              lesson={lessonDetailQuery.data}
              unitTitle={
                unitTitleById.get(lessonDetailQuery.data.unitId) ??
                `Unit ${lessonDetailQuery.data.unitId}`
              }
            />
          )}
        </DialogContent>
      </Dialog>
    </AppPageShell>
  );
}

function EmptyReviewState({ title, description }: { title: string; description: string }) {
  return (
    <Card className="border-dashed border-border/80 shadow-none">
      <CardContent className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          <FileWarning className="size-5" />
        </div>
        <div className="space-y-1">
          <h2 className="text-xl font-semibold">{title}</h2>
          <p className="max-w-xl text-sm text-muted-foreground">{description}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function ReviewDecisionPanel({
  title,
  description,
  label,
  placeholder,
  value,
  onChange,
  onConfirm,
  onCancel,
  confirmLabel,
  confirmVariant,
  confirmDisabled,
}: {
  title: string;
  description: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel: string;
  confirmVariant: "success" | "destructive";
  confirmDisabled: boolean;
}) {
  return (
    <div className="space-y-4 border-t pt-4">
      <div className="space-y-1">
        <h3 className="font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div>
        <Label>{label}</Label>
        <textarea
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="mt-1 min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={onConfirm} variant={confirmVariant} disabled={confirmDisabled}>
          {confirmLabel}
        </Button>
        <Button onClick={onCancel} variant="outline">
          Cancel
        </Button>
      </div>
    </div>
  );
}

function LessonSubmissionPreview({
  lesson,
  unitTitle,
}: {
  lesson: LessonDetail;
  unitTitle: string;
}) {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border/70 bg-card/70 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">Pending Review</Badge>
          <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            {unitTitle}
          </span>
        </div>
        <h3 className="mt-3 text-2xl font-semibold">{lesson.title}</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Summary</p>
            <p className="mt-2 text-sm leading-6 text-foreground">{lesson.description}</p>
          </div>
          <div className="space-y-4">
            {lesson.learningObjective ? (
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  Learning objective
                </p>
                <p className="mt-2 text-sm leading-6 text-foreground">{lesson.learningObjective}</p>
              </div>
            ) : null}
            {lesson.estimatedMinutes ? (
              <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <Clock3 className="size-4" />
                {lesson.estimatedMinutes} min
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <BookOpenText className="size-4 text-muted-foreground" />
          <p className="text-sm font-semibold">Lesson steps</p>
        </div>
        <div className="space-y-4">
          {lesson.steps.map((step, index) => (
            <LessonStepCard key={step.id} index={index} step={step} />
          ))}
        </div>
      </div>
    </div>
  );
}

function LessonStepCard({ index, step }: { index: number; step: LessonStepPayload }) {
  const stepLabel = getStepLabel(step);

  if (step.stepType === "TEACH" && step.vocab) {
    return (
      <Card className="border-chart-1/30 bg-chart-1/5">
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Step {index + 1}</Badge>
            <Badge variant="outline">{stepLabel}</Badge>
          </div>
          <h4 className="mt-4 text-2xl font-semibold">
            {readString(step.payload, "title") ?? step.vocab.term}
          </h4>
          <p className="mt-3 text-base">
            {readString(step.payload, "body") ?? step.vocab.definition}
          </p>
          {(readString(step.payload, "example") ?? step.vocab.exampleSentence) ? (
            <p className="mt-3 text-sm italic text-muted-foreground">
              "{readString(step.payload, "example") ?? step.vocab.exampleSentence}"
            </p>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  if (step.stepType === "QUESTION" && step.question) {
    return (
      <Card className="border-chart-1/30 bg-chart-1/5">
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Step {index + 1}</Badge>
            <Badge variant="outline">{stepLabel}</Badge>
          </div>
          <h4 className="mt-4 text-2xl font-semibold">{step.question.prompt}</h4>

          {step.question.questionType === "MATCH" &&
          Array.isArray(step.question.matchPairs) &&
          step.question.matchPairs.length > 0 ? (
            <div className="mt-4 space-y-2">
              <p className="text-sm font-semibold text-muted-foreground">Match pairs</p>
              {step.question.matchPairs.map((pair, pairIndex) => (
                <div key={pair.id ?? pairIndex} className="flex gap-4">
                  <div className="flex-1 rounded border border-border bg-card/80 px-3 py-2 text-sm">
                    {pair.left}
                  </div>
                  <div className="text-lg text-muted-foreground">→</div>
                  <div className="flex-1 rounded border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm text-green-600">
                    {pair.right}
                  </div>
                </div>
              ))}
            </div>
          ) : Array.isArray(step.question.choices) && step.question.choices.length > 0 ? (
            <div className="mt-4 space-y-3">
              {step.question.choices.map((choice, choiceIndex) => (
                <div
                  key={choice.id ?? choiceIndex}
                  className={`flex items-center justify-between rounded border px-4 py-3 ${
                    choice.isCorrect
                      ? "border-green-500 bg-[rgba(72,187,120,0.06)]"
                      : "border-border bg-card/80"
                  }`}
                >
                  <div className="text-base">{choice.text}</div>
                  {choice.isCorrect ? (
                    <div className="text-sm font-semibold text-green-500">Correct</div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4 text-sm">
              <p className="font-semibold">Accepted answers</p>
              <ul className="ml-5 mt-2 list-disc">
                {(step.question.acceptedAnswers ?? []).map((answer, answerIndex) => (
                  <li key={answerIndex}>{answer}</li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  if (step.stepType === "DIALOGUE" && (step.dialogueText || readString(step.payload, "text"))) {
    return (
      <Card className="border-chart-1/30 bg-chart-1/5">
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Step {index + 1}</Badge>
            <Badge variant="outline">{stepLabel}</Badge>
          </div>
          <p className="mt-4 whitespace-pre-wrap text-lg">
            {step.dialogueText ?? readString(step.payload, "text")}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (step.stepType === "RECAP") {
    return (
      <Card className="border-chart-2/25 bg-chart-2/8">
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Step {index + 1}</Badge>
            <Badge variant="outline">{stepLabel}</Badge>
          </div>
          <h4 className="mt-4 text-2xl font-semibold">
            {readString(step.payload, "headline") ?? "Quick recap"}
          </h4>
          <p className="mt-3 text-base text-muted-foreground">
            {readString(step.payload, "summary") ?? "No summary provided."}
          </p>
          {readStringArray(step.payload, "takeaways").length > 0 ? (
            <div className="mt-4 space-y-2">
              {readStringArray(step.payload, "takeaways").map((takeaway) => (
                <div
                  key={takeaway}
                  className="rounded-2xl border border-border/70 bg-background/80 px-4 py-3 text-sm font-medium"
                >
                  {takeaway}
                </div>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="rounded-2xl border border-border/70 bg-card/70 p-4 text-sm text-muted-foreground">
      Step {index + 1}: unsupported preview
    </div>
  );
}

function getStepLabel(step: LessonStepPayload) {
  if (step.stepType === "QUESTION") {
    return `Question${step.question?.questionType ? ` (${step.question.questionType})` : ""}`;
  }

  if (step.stepType === "TEACH") {
    return "Learn";
  }

  if (step.stepType === "DIALOGUE") {
    return "Dialogue";
  }

  return "Recap";
}

function readString(payload: LessonStepPayload["payload"], key: string) {
  const value = payload?.[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function readStringArray(payload: LessonStepPayload["payload"], key: string) {
  const value = payload?.[key];
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}
