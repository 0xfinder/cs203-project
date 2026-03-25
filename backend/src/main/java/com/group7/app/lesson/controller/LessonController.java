package com.group7.app.lesson.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.group7.app.lesson.model.Lesson;
import com.group7.app.lesson.model.LessonStatus;
import com.group7.app.lesson.model.LessonStep;
import com.group7.app.lesson.model.QuestionType;
import com.group7.app.lesson.model.StepType;
import com.group7.app.lesson.service.AuthContextService;
import com.group7.app.lesson.service.LessonService;
import com.group7.app.lesson.service.LessonStepPayloadService;
import com.group7.app.user.User;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.net.URI;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/lessons")
@Tag(name = "Lessons", description = "Lesson management and lesson play endpoints")
public class LessonController {

    private final LessonService lessonService;
    private final LessonStepPayloadService lessonStepPayloadService;
    private final AuthContextService authContextService;

    public LessonController(
            LessonService lessonService,
            LessonStepPayloadService lessonStepPayloadService,
            AuthContextService authContextService) {
        this.lessonService = lessonService;
        this.lessonStepPayloadService = lessonStepPayloadService;
        this.authContextService = authContextService;
    }

    @GetMapping
    @Operation(summary = "Get lessons")
    public List<LessonSummaryResponse> listLessons(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(required = false) Long unitId,
            @RequestParam(required = false) LessonStatus status) {
        User actor = authContextService.resolveUser(jwt);
        return lessonService.listLessons(actor, unitId, status).stream()
                .map(this::toSummary)
                .toList();
    }

    @GetMapping("/{lessonId}")
    @Operation(summary = "Get lesson details")
    public LessonDetailResponse getLesson(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long lessonId) {
        User actor = authContextService.resolveUser(jwt);
        Lesson lesson = lessonService.getLesson(actor, lessonId);
        List<StepResponse> steps = lessonService.getLessonSteps(actor, lessonId).stream()
                .map(step -> toStepResponse(step, true))
                .toList();

        return toDetail(lesson, steps);
    }

    @GetMapping("/{lessonId}/content")
    @Operation(summary = "Get learner-safe lesson content payload")
    public LessonPlayResponse getLessonForPlay(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long lessonId) {
        User actor = authContextService.resolveUser(jwt);
        Lesson lesson = lessonService.getLesson(actor, lessonId);
        List<StepResponse> steps = lessonService.getLessonSteps(actor, lessonId).stream()
                .map(step -> toStepResponse(step, false))
                .toList();

        return new LessonPlayResponse(toSummary(lesson), steps);
    }

    @PostMapping
    @Operation(summary = "Create lesson draft")
    public ResponseEntity<LessonDetailResponse> createLesson(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody CreateLessonRequest request) {
        User actor = authContextService.resolveUser(jwt);
        Lesson lesson = lessonService.createLesson(actor,
                new LessonService.LessonDraftInput(
                        request.unitId(),
                        request.title(),
                        request.description(),
                        request.learningObjective(),
                        request.estimatedMinutes(),
                        request.orderIndex()));

        return ResponseEntity
                .created(URI.create("/api/lessons/" + lesson.getId()))
                .body(toDetail(lesson, List.of()));
    }

    @PatchMapping("/{lessonId}")
    @Operation(summary = "Patch lesson metadata or status")
    public LessonDetailResponse patchLesson(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long lessonId,
            @RequestBody PatchLessonRequest request) {
        User actor = authContextService.resolveUser(jwt);
        Lesson lesson = lessonService.patchLesson(actor, lessonId,
                new LessonService.LessonPatchInput(
                        request.unitId(),
                        request.title(),
                        request.description(),
                        request.learningObjective(),
                        request.estimatedMinutes(),
                        request.orderIndex(),
                        request.status(),
                        request.reviewComment()));

        List<StepResponse> steps = lessonService.getLessonSteps(actor, lessonId).stream()
                .map(step -> toStepResponse(step, true))
                .toList();

        return toDetail(lesson, steps);
    }

        @DeleteMapping("/{lessonId}")
        @Operation(summary = "Delete a lesson (owner or admin only)")
        public org.springframework.http.ResponseEntity<Void> deleteLesson(
                        @AuthenticationPrincipal Jwt jwt,
                        @PathVariable Long lessonId) {
                User actor = authContextService.resolveUser(jwt);
                lessonService.deleteLesson(actor, lessonId);
                return org.springframework.http.ResponseEntity.noContent().build();
        }

    @PostMapping("/{lessonId}/steps")
    @Operation(summary = "Create lesson step")
    public ResponseEntity<StepResponse> createStep(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long lessonId,
            @RequestBody StepWriteRequest request) {
        User actor = authContextService.resolveUser(jwt);
        LessonStep step = lessonService.createStep(actor, lessonId, toStepWriteInput(request));
        return ResponseEntity.created(URI.create("/api/lessons/" + lessonId + "/steps/" + step.getId()))
                .body(toStepResponse(step, true));
    }

    @PatchMapping("/{lessonId}/steps/{stepId}")
    @Operation(summary = "Update lesson step")
    public StepResponse patchStep(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long lessonId,
            @PathVariable Long stepId,
            @RequestBody StepWriteRequest request) {
        User actor = authContextService.resolveUser(jwt);
        LessonStep step = lessonService.updateStep(actor, lessonId, stepId, toStepWriteInput(request));
        return toStepResponse(step, true);
    }

    @DeleteMapping("/{lessonId}/steps/{stepId}")
    @Operation(summary = "Delete lesson step")
    public ResponseEntity<Void> deleteStep(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long lessonId,
            @PathVariable Long stepId) {
        User actor = authContextService.resolveUser(jwt);
        lessonService.deleteStep(actor, lessonId, stepId);
        return ResponseEntity.noContent().build();
    }

    private LessonSummaryResponse toSummary(Lesson lesson) {
        return new LessonSummaryResponse(
                lesson.getId(),
                lesson.getUnit().getId(),
                lesson.getTitle(),
                lesson.getSlug(),
                lesson.getDescription(),
                lesson.getLearningObjective(),
                lesson.getEstimatedMinutes(),
                lesson.getOrderIndex(),
                lesson.getStatus());
    }

    private LessonDetailResponse toDetail(Lesson lesson, List<StepResponse> steps) {
        return new LessonDetailResponse(
                lesson.getId(),
                lesson.getUnit().getId(),
                lesson.getTitle(),
                lesson.getDescription(),
                lesson.getLearningObjective(),
                lesson.getEstimatedMinutes(),
                lesson.getOrderIndex(),
                lesson.getStatus(),
                lesson.getReviewComment(),
                lesson.getPublishedAt(),
                steps);
    }

    private StepResponse toStepResponse(LessonStep step, boolean includeAnswers) {
        JsonNode responsePayload = includeAnswers
                ? step.getPayload()
                : lessonStepPayloadService.sanitizePayloadForPlay(step);

        if (step.getStepType() == StepType.TEACH && step.getVocabItem() != null) {
            return new StepResponse(
                    step.getId(),
                    step.getOrderIndex(),
                    step.getStepType(),
                    new VocabPayload(
                            step.getVocabItem().getId(),
                            step.getVocabItem().getTerm(),
                            step.getVocabItem().getDefinition(),
                            step.getVocabItem().getExampleSentence(),
                            step.getVocabItem().getPartOfSpeech()),
                    null,
                    null,
                    responsePayload);
        }

        if (step.getStepType() == StepType.DIALOGUE) {
            return new StepResponse(
                    step.getId(),
                    step.getOrderIndex(),
                    step.getStepType(),
                    null,
                    null,
                    lessonStepPayloadService.readDialogueText(step),
                    responsePayload);
        }

        if (step.getStepType() == StepType.RECAP) {
            return new StepResponse(step.getId(), step.getOrderIndex(), step.getStepType(), null, null, null, responsePayload);
        }

        LessonStepPayloadService.QuestionContent question = lessonStepPayloadService.readQuestion(step);
        QuestionPayload payload;
        if (question.questionType() == QuestionType.MCQ) {
            long correctChoiceId = step.getPayload().path("answerKey").path("choiceId").asLong(-1L);
            List<ChoicePayload> choices = question.choices().stream()
                    .map(choice -> new ChoicePayload(
                            choice.id(),
                            choice.text(),
                            includeAnswers ? choice.id() == correctChoiceId : null,
                            choice.orderIndex()))
                    .toList();
            payload = new QuestionPayload(
                    step.getId(),
                    question.questionType(),
                    question.prompt(),
                    question.explanation(),
                    choices,
                    List.of(),
                    List.of(),
                    List.of());
        } else if (question.questionType() == QuestionType.MATCH) {
            List<MatchPairPayload> pairs = question.matchPairs().stream()
                    .map(pair -> new MatchPairPayload(pair.id(), pair.left(), pair.right(), pair.orderIndex()))
                    .toList();
            payload = new QuestionPayload(
                    step.getId(),
                    question.questionType(),
                    question.prompt(),
                    question.explanation(),
                    List.of(),
                    includeAnswers
                            ? pairs
                            : pairs.stream().map(pair -> new MatchPairPayload(pair.id(), pair.left(), null, pair.orderIndex())).toList(),
                    List.of(),
                    includeAnswers ? List.of() : lessonStepPayloadService.shuffledRights(question));
        } else {
            List<String> acceptedAnswers = includeAnswers
                    ? question.acceptedAnswers()
                    : List.of();
            payload = new QuestionPayload(
                    step.getId(),
                    question.questionType(),
                    question.prompt(),
                    question.explanation(),
                    List.of(),
                    List.of(),
                    acceptedAnswers,
                    List.of());
        }

        return new StepResponse(step.getId(), step.getOrderIndex(), step.getStepType(), null, payload, null, responsePayload);
    }

    private LessonService.StepWriteInput toStepWriteInput(StepWriteRequest request) {
        List<LessonService.MatchPairInput> pairs = request.matchPairs() == null
                ? null
                : request.matchPairs().stream().map(pair -> new LessonService.MatchPairInput(pair.left(), pair.right())).toList();

        return new LessonService.StepWriteInput(
                request.orderIndex(),
                request.stepType(),
                request.vocabItemId(),
                request.questionId(),
                request.questionType(),
                request.prompt(),
                request.explanation(),
                request.options(),
                request.correctOptionIndex(),
                request.acceptedAnswers(),
                pairs,
                request.dialogueText(),
                request.payload());
    }

    public record CreateLessonRequest(
            @NotNull Long unitId,
            @NotBlank String title,
            @NotBlank String description,
            String learningObjective,
            Integer estimatedMinutes,
            @NotNull Integer orderIndex) {
    }

    public record PatchLessonRequest(
            Long unitId,
            String title,
            String description,
            String learningObjective,
            Integer estimatedMinutes,
            Integer orderIndex,
            LessonStatus status,
            String reviewComment) {
    }

    public record StepWriteRequest(
            @NotNull Integer orderIndex,
            @NotNull StepType stepType,
            Long vocabItemId,
            Long questionId,
            QuestionType questionType,
            String prompt,
            String explanation,
            List<String> options,
            Integer correctOptionIndex,
            List<String> acceptedAnswers,
            List<MatchPairRequest> matchPairs,
            String dialogueText,
            JsonNode payload) {
    }

    public record MatchPairRequest(String left, String right) {
    }

    public record LessonSummaryResponse(
            Long id,
            Long unitId,
            String title,
            String slug,
            String description,
            String learningObjective,
            Integer estimatedMinutes,
            Integer orderIndex,
            LessonStatus status) {
    }

    public record LessonDetailResponse(
            Long id,
            Long unitId,
            String title,
            String description,
            String learningObjective,
            Integer estimatedMinutes,
            Integer orderIndex,
            LessonStatus status,
            String reviewComment,
            java.time.Instant publishedAt,
            List<StepResponse> steps) {
    }

    public record LessonPlayResponse(LessonSummaryResponse lesson, List<StepResponse> steps) {
    }

    public record StepResponse(
            Long id,
            Integer orderIndex,
            StepType stepType,
            VocabPayload vocab,
            QuestionPayload question,
            String dialogueText,
            JsonNode payload) {
    }

    public record VocabPayload(
            Long id,
            String term,
            String definition,
            String exampleSentence,
            String partOfSpeech) {
    }

    public record QuestionPayload(
            Long id,
            QuestionType questionType,
            String prompt,
            String explanation,
            List<ChoicePayload> choices,
            List<MatchPairPayload> matchPairs,
            List<String> acceptedAnswers,
            List<String> shuffledRights) {
    }

    public record ChoicePayload(Long id, String text, Boolean isCorrect, Integer orderIndex) {
    }

    public record MatchPairPayload(Long id, String left, String right, Integer orderIndex) {
    }
}
