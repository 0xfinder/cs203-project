package com.group7.app.lesson.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.group7.app.lesson.controller.LessonController.MatchPairPayload;
import com.group7.app.lesson.controller.LessonController.QuestionPayload;
import com.group7.app.lesson.service.AuthContextService;
import com.group7.app.lesson.service.LessonAttemptService;
import com.group7.app.lesson.service.LessonStepPayloadService;
import com.group7.app.user.User;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
@Tag(
    name = "Learning Progress",
    description = "Lesson attempts, progress, and vocab memory endpoints")
public class LearningProgressController {

  private final LessonAttemptService lessonAttemptService;
  private final AuthContextService authContextService;
  private final LessonStepPayloadService lessonStepPayloadService;

  public LearningProgressController(
      LessonAttemptService lessonAttemptService,
      AuthContextService authContextService,
      LessonStepPayloadService lessonStepPayloadService) {
    this.lessonAttemptService = lessonAttemptService;
    this.authContextService = authContextService;
    this.lessonStepPayloadService = lessonStepPayloadService;
  }

  @PostMapping("/lesson-attempts")
  @Operation(summary = "Submit a lesson attempt")
  public ResponseEntity<LessonAttemptService.AttemptSubmissionResult> submitAttempt(
      @AuthenticationPrincipal Jwt jwt, @Valid @RequestBody SubmitAttemptRequest request) {
    User actor = authContextService.resolveUser(jwt);
    LessonAttemptService.AttemptSubmissionResult result =
        lessonAttemptService.submitAttempt(
            actor,
            request.lessonId(),
            request.answers().stream()
                .map(
                    answer ->
                        new LessonAttemptService.AnswerInput(answer.stepId(), answer.answer()))
                .toList(),
            request.startedAt());
    return ResponseEntity.ok(result);
  }

  @GetMapping("/lesson-attempts/{attemptId}")
  @Operation(summary = "Get lesson attempt details")
  public LessonAttemptService.AttemptSubmissionResult getAttempt(
      @AuthenticationPrincipal Jwt jwt, @PathVariable Long attemptId) {
    User actor = authContextService.resolveUser(jwt);
    return lessonAttemptService.getAttempt(actor, attemptId);
  }

  @GetMapping("/user-lesson-progress")
  @Operation(summary = "Get current user lesson progress")
  public List<LessonAttemptService.ProgressItem> getProgress(@AuthenticationPrincipal Jwt jwt) {
    User actor = authContextService.resolveUser(jwt);
    return lessonAttemptService.getProgress(actor);
  }

  @PatchMapping("/user-lesson-progress/{lessonId}")
  @Operation(summary = "Update current user lesson position")
  public LessonAttemptService.ProgressItem updateProgressPosition(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable Long lessonId,
      @Valid @RequestBody UpdateProgressRequest request) {
    User actor = authContextService.resolveUser(jwt);
    return lessonAttemptService.updateProgressPosition(actor, lessonId, request.lastStepId());
  }

  @GetMapping("/vocab-memory")
  @Operation(summary = "Get vocab memory queue")
  public List<LessonAttemptService.VocabMemoryItem> getVocabMemory(
      @AuthenticationPrincipal Jwt jwt,
      @RequestParam(defaultValue = "true") boolean due,
      @RequestParam(defaultValue = "20") int limit) {
    User actor = authContextService.resolveUser(jwt);
    return lessonAttemptService.listDueVocabMemory(actor, limit, due);
  }

  @GetMapping("/revise-queue")
  @Operation(summary = "Get adaptive revise queue")
  public ReviseQueueResponse getReviseQueue(
      @AuthenticationPrincipal Jwt jwt, @RequestParam(defaultValue = "10") int limit) {
    User actor = authContextService.resolveUser(jwt);
    LessonAttemptService.ReviseQueueResponse queue =
        lessonAttemptService.getReviseQueue(actor, limit);
    return new ReviseQueueResponse(
        queue.items().stream().map(this::toReviseQueueItem).toList(), queue.dueCount());
  }

  @PostMapping("/revise-attempts")
  @Operation(summary = "Submit revise session answers")
  public LessonAttemptService.ReviseAttemptResult submitReviseAttempt(
      @AuthenticationPrincipal Jwt jwt, @Valid @RequestBody SubmitReviseAttemptRequest request) {
    User actor = authContextService.resolveUser(jwt);
    return lessonAttemptService.submitReviseAttempt(
        actor,
        request.answers().stream()
            .map(answer -> new LessonAttemptService.AnswerInput(answer.stepId(), answer.answer()))
            .toList());
  }

  @PostMapping("/vocab-memory-attempts")
  @Operation(summary = "Submit vocab memory review results")
  public List<LessonAttemptService.VocabMemoryItem> submitVocabMemoryAttempt(
      @AuthenticationPrincipal Jwt jwt,
      @Valid @RequestBody SubmitVocabMemoryAttemptRequest request) {
    User actor = authContextService.resolveUser(jwt);
    List<LessonAttemptService.VocabMemoryAnswerInput> answers =
        request.answers().stream()
            .map(
                answer ->
                    new LessonAttemptService.VocabMemoryAnswerInput(
                        answer.vocabItemId(), answer.correct()))
            .toList();
    return lessonAttemptService.submitVocabMemoryAttempt(actor, answers);
  }

  public record SubmitAttemptRequest(
      @NotNull Long lessonId,
      @NotNull List<AttemptAnswerRequest> answers,
      java.time.Instant startedAt) {}

  public record AttemptAnswerRequest(@NotNull Long stepId, JsonNode answer) {}

  public record UpdateProgressRequest(@NotNull Long lastStepId) {}

  public record SubmitReviseAttemptRequest(@NotNull List<AttemptAnswerRequest> answers) {}

  public record SubmitVocabMemoryAttemptRequest(@NotNull List<VocabMemoryAnswerRequest> answers) {}

  public record VocabMemoryAnswerRequest(@NotNull Long vocabItemId, boolean correct) {}

  public record ReviseQueueResponse(List<ReviseQueueItem> items, int dueCount) {}

  public record ReviseQueueItem(
      Long stepId,
      Long lessonId,
      String lessonTitle,
      String priorityReason,
      QuestionPayload question,
      JsonNode payload) {}

  private ReviseQueueItem toReviseQueueItem(LessonAttemptService.ReviseQueueItem item) {
    return new ReviseQueueItem(
        item.stepId(),
        item.lessonId(),
        item.lessonTitle(),
        item.priorityReason(),
        toQuestionPayload(item.step()),
        lessonStepPayloadService.sanitizePayloadForPlay(item.step()));
  }

  private QuestionPayload toQuestionPayload(com.group7.app.lesson.model.LessonStep step) {
    LessonStepPayloadService.QuestionContent question = lessonStepPayloadService.readQuestion(step);
    if (question.questionType() == com.group7.app.lesson.model.QuestionType.MCQ) {
      return new QuestionPayload(
          step.getId(),
          question.questionType(),
          question.prompt(),
          question.explanation(),
          question.choices().stream()
              .map(
                  choice ->
                      new LessonController.ChoicePayload(
                          choice.id(), choice.text(), null, choice.orderIndex()))
              .toList(),
          List.of(),
          List.of(),
          List.of());
    }

    if (question.questionType() == com.group7.app.lesson.model.QuestionType.MATCH) {
      return new QuestionPayload(
          step.getId(),
          question.questionType(),
          question.prompt(),
          question.explanation(),
          List.of(),
          question.matchPairs().stream()
              .map(pair -> new MatchPairPayload(pair.id(), pair.left(), null, pair.orderIndex()))
              .toList(),
          List.of(),
          lessonStepPayloadService.shuffledRights(question));
    }

    return new QuestionPayload(
        step.getId(),
        question.questionType(),
        question.prompt(),
        question.explanation(),
        List.of(),
        List.of(),
        List.of(),
        List.of());
  }
}
