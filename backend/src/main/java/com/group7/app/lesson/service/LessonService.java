package com.group7.app.lesson.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.group7.app.lesson.model.Lesson;
import com.group7.app.lesson.model.LessonStatus;
import com.group7.app.lesson.model.LessonStep;
import com.group7.app.lesson.model.QuestionType;
import com.group7.app.lesson.model.StepType;
import com.group7.app.lesson.model.Unit;
import com.group7.app.lesson.model.VocabItem;
import com.group7.app.lesson.repository.LessonRepository;
import com.group7.app.lesson.repository.LessonStepRepository;
import com.group7.app.lesson.repository.UnitRepository;
import com.group7.app.lesson.repository.VocabItemRepository;
import com.group7.app.user.Role;
import com.group7.app.user.User;
import jakarta.transaction.Transactional;
import java.text.Normalizer;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional
public class LessonService {

  private final UnitRepository unitRepository;
  private final LessonRepository lessonRepository;
  private final LessonStepRepository lessonStepRepository;
  private final VocabItemRepository vocabItemRepository;
  private final LessonStepPayloadService lessonStepPayloadService;

  public LessonService(
      UnitRepository unitRepository,
      LessonRepository lessonRepository,
      LessonStepRepository lessonStepRepository,
      VocabItemRepository vocabItemRepository,
      LessonStepPayloadService lessonStepPayloadService) {
    this.unitRepository = unitRepository;
    this.lessonRepository = lessonRepository;
    this.lessonStepRepository = lessonStepRepository;
    this.vocabItemRepository = vocabItemRepository;
    this.lessonStepPayloadService = lessonStepPayloadService;
  }

  public List<Unit> listUnits() {
    return unitRepository.findAllByOrderByOrderIndexAsc();
  }

  public Lesson createLesson(User actor, LessonDraftInput input) {
    requireRole(actor, Role.CONTRIBUTOR, Role.ADMIN);
    Unit unit =
        unitRepository
            .findById(input.unitId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "unit not found"));
    String title = sanitize(input.title());
    Integer orderIndex = input.orderIndex();
    if (orderIndex == null) {
      List<Lesson> existing = lessonRepository.findByUnitIdOrderByOrderIndexAsc(unit.getId());
      int max =
          existing.stream()
              .map(Lesson::getOrderIndex)
              .filter(i -> i != null)
              .max(Comparator.naturalOrder())
              .orElse(0);
      orderIndex = max + 1;
    }

    Lesson lesson =
        new Lesson(
            unit,
            title,
            // ensure slug uniqueness across lessons by appending a numeric suffix when needed
            uniqueSlugForTitle(title),
            sanitize(input.description()),
            trimToNull(input.learningObjective()),
            input.estimatedMinutes(),
            orderIndex,
            actor.getId());
    lesson.setStatus(LessonStatus.DRAFT);
    lesson.setTargetSubunitId(input.targetSubunitId());
    return lessonRepository.save(lesson);
  }

  private String uniqueSlugForTitle(String title) {
    String base = slugify(title);
    String candidate = base;
    int suffix = 1;
    while (lessonRepository.existsBySlug(candidate)) {
      candidate = base + "-" + suffix;
      suffix++;
    }
    return candidate;
  }

  public Lesson patchLesson(User actor, Long lessonId, LessonPatchInput input) {
    Lesson lesson = requireLesson(lessonId);

    if (input.status() != null && input.status() != lesson.getStatus()) {
      applyStatusTransition(actor, lesson, input.status(), input.reviewComment());
    }

    if (input.unitId() != null
        || input.title() != null
        || input.description() != null
        || input.learningObjective() != null
        || input.estimatedMinutes() != null
        || input.orderIndex() != null) {
      if (lesson.getStatus() == LessonStatus.APPROVED && !isAdminOrModerator(actor)) {
        throw new ResponseStatusException(
            HttpStatus.FORBIDDEN, "approved lessons can only be edited by moderators/admin");
      }

      requireOwnerOrAdmin(actor, lesson);

      if (input.unitId() != null) {
        Unit unit =
            unitRepository
                .findById(input.unitId())
                .orElseThrow(
                    () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "unit not found"));
        lesson.setUnit(unit);
      }
      if (input.title() != null) {
        String title = sanitize(input.title());
        lesson.setTitle(title);
        lesson.setSlug(slugify(title));
      }
      if (input.description() != null) {
        lesson.setDescription(sanitize(input.description()));
      }
      if (input.learningObjective() != null) {
        lesson.setLearningObjective(trimToNull(input.learningObjective()));
      }
      if (input.estimatedMinutes() != null) {
        lesson.setEstimatedMinutes(input.estimatedMinutes());
      }
      if (input.orderIndex() != null) {
        lesson.setOrderIndex(input.orderIndex());
      }
    }

    return lessonRepository.save(lesson);
  }

  public List<Lesson> listLessons(User actor, Long unitId, LessonStatus status) {
    boolean canSeeAll = isAdminOrModerator(actor);

    LessonStatus effectiveStatus = status;
    if (!canSeeAll) {
      effectiveStatus = LessonStatus.APPROVED;
    }

    List<Lesson> lessons;
    if (unitId != null && effectiveStatus != null) {
      lessons = lessonRepository.findByUnitIdAndStatusOrderByOrderIndexAsc(unitId, effectiveStatus);
    } else if (unitId != null) {
      lessons = lessonRepository.findByUnitIdOrderByOrderIndexAsc(unitId);
    } else if (effectiveStatus != null) {
      lessons = lessonRepository.findByStatusOrderByOrderIndexAsc(effectiveStatus);
    } else {
      lessons = lessonRepository.findAllByOrderByOrderIndexAsc();
    }

    if (canSeeAll) {
      return lessons;
    }

    return lessons.stream().filter(lesson -> lesson.getStatus() == LessonStatus.APPROVED).toList();
  }

  public Lesson getLesson(User actor, Long lessonId) {
    Lesson lesson = requireLesson(lessonId);
    ensureCanViewLesson(actor, lesson);
    return lesson;
  }

  public List<LessonStep> getLessonSteps(User actor, Long lessonId) {
    Lesson lesson = getLesson(actor, lessonId);
    return lessonStepRepository.findByLessonIdOrderByOrderIndexAsc(lesson.getId());
  }

  public LessonStep createStep(User actor, Long lessonId, StepWriteInput input) {
    Lesson lesson = requireLesson(lessonId);
    ensureCanEditSteps(actor, lesson);

    LessonStep step = new LessonStep(lesson, input.orderIndex(), input.stepType());
    applyStepPayload(step, input);

    LessonStep saved = lessonStepRepository.save(step);
    normalizeStepOrder(lessonId);
    return saved;
  }

  public LessonStep updateStep(User actor, Long lessonId, Long stepId, StepWriteInput input) {
    Lesson lesson = requireLesson(lessonId);
    ensureCanEditSteps(actor, lesson);

    LessonStep step =
        lessonStepRepository
            .findByIdAndLessonId(stepId, lessonId)
            .orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "lesson step not found"));

    step.setOrderIndex(input.orderIndex());
    step.setStepType(input.stepType());
    applyStepPayload(step, input);

    LessonStep saved = lessonStepRepository.save(step);
    normalizeStepOrder(lessonId);
    return saved;
  }

  public void deleteStep(User actor, Long lessonId, Long stepId) {
    Lesson lesson = requireLesson(lessonId);
    ensureCanEditSteps(actor, lesson);

    LessonStep step =
        lessonStepRepository
            .findByIdAndLessonId(stepId, lessonId)
            .orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "lesson step not found"));
    lessonStepRepository.delete(step);
    normalizeStepOrder(lessonId);

    // If no steps remain for this lesson, remove the empty lesson as well (owner/admin only)
    List<LessonStep> remaining = lessonStepRepository.findByLessonIdOrderByOrderIndexAsc(lessonId);
    if (remaining == null || remaining.isEmpty()) {
      // requireOwnerOrAdmin already checked via ensureCanEditSteps, so safe to delete
      lessonRepository.delete(lesson);
    }
  }

  public void deleteLesson(User actor, Long lessonId) {
    Lesson lesson = requireLesson(lessonId);
    requireOwnerOrAdmin(actor, lesson);

    // Delete steps first
    List<LessonStep> steps =
        lessonStepRepository.findByLessonIdOrderByOrderIndexAsc(lesson.getId());
    for (LessonStep s : steps) {
      lessonStepRepository.delete(s);
    }

    lessonRepository.delete(lesson);
  }

  public List<LessonStep> getQuestionSteps(Long lessonId) {
    return lessonStepRepository.findByLessonIdAndStepTypeOrderByOrderIndexAsc(
        lessonId, StepType.QUESTION);
  }

  private void applyStatusTransition(
      User actor, Lesson lesson, LessonStatus targetStatus, String reviewComment) {
    LessonStatus current = lesson.getStatus();

    if (current == LessonStatus.DRAFT && targetStatus == LessonStatus.PENDING_REVIEW) {
      requireOwnerOrAdmin(actor, lesson);
      lesson.setStatus(targetStatus);
      lesson.setReviewComment(null);
      lesson.setReviewedBy(null);
      return;
    }

    if (current == LessonStatus.PENDING_REVIEW
        && (targetStatus == LessonStatus.APPROVED || targetStatus == LessonStatus.REJECTED)) {
      if (!isAdminOrModerator(actor)) {
        throw new ResponseStatusException(
            HttpStatus.FORBIDDEN, "only moderators/admin can review lessons");
      }
      if (targetStatus == LessonStatus.REJECTED && isBlank(reviewComment)) {
        throw new ResponseStatusException(
            HttpStatus.BAD_REQUEST, "reviewComment is required when rejecting");
      }
      lesson.setStatus(targetStatus);
      lesson.setReviewedBy(actor.getId());
      lesson.setReviewComment(isBlank(reviewComment) ? null : reviewComment.trim());
      if (targetStatus == LessonStatus.APPROVED) {
        lesson.setPublishedAt(Instant.now());
        // Copy steps to target subunit if specified
        if (lesson.getTargetSubunitId() != null) {
          copyStepsToTargetSubunit(lesson);
        }
      }
      return;
    }

    if (current == LessonStatus.REJECTED && targetStatus == LessonStatus.DRAFT) {
      requireOwnerOrAdmin(actor, lesson);
      lesson.setStatus(targetStatus);
      lesson.setReviewComment(null);
      return;
    }

    throw new ResponseStatusException(
        HttpStatus.BAD_REQUEST, "invalid status transition: " + current + " -> " + targetStatus);
  }

  private void copyStepsToTargetSubunit(Lesson sourceLessonWithSteps) {
    // Get the target subunit (parent lesson/subunit where we'll add these steps)
    Lesson targetSubunit =
        lessonRepository
            .findById(sourceLessonWithSteps.getTargetSubunitId())
            .orElseThrow(
                () ->
                    new ResponseStatusException(HttpStatus.NOT_FOUND, "target subunit not found"));

    // Get the highest order index in the target subunit
    List<LessonStep> existingSteps =
        lessonStepRepository.findByLessonIdOrderByOrderIndexAsc(targetSubunit.getId());
    int nextOrderIndex = existingSteps.isEmpty() ? 1 : existingSteps.size() + 1;

    // Get all steps from the source lesson
    List<LessonStep> sourceSteps =
        lessonStepRepository.findByLessonIdOrderByOrderIndexAsc(sourceLessonWithSteps.getId());

    // Copy each step to the target subunit
    for (LessonStep sourceStep : sourceSteps) {
      LessonStep newStep = new LessonStep(targetSubunit, nextOrderIndex, sourceStep.getStepType());
      newStep.setVocabItem(sourceStep.getVocabItem());
      newStep.setPayload(sourceStep.getPayload());
      lessonStepRepository.save(newStep);
      nextOrderIndex++;
    }

    // Delete the source lesson after copying steps (it's no longer needed)
    lessonRepository.delete(sourceLessonWithSteps);
  }

  private void applyStepPayload(LessonStep step, StepWriteInput input) {
    switch (input.stepType()) {
      case TEACH -> {
        if (input.vocabItemId() == null) {
          throw new ResponseStatusException(
              HttpStatus.BAD_REQUEST, "vocabItemId is required for teach step");
        }
        VocabItem vocabItem =
            vocabItemRepository
                .findById(input.vocabItemId())
                .orElseThrow(
                    () ->
                        new ResponseStatusException(HttpStatus.NOT_FOUND, "vocab item not found"));
        step.setVocabItem(vocabItem);
        step.setPayload(
            lessonStepPayloadService.buildTeachPayload(
                vocabItem.getTerm(),
                vocabItem.getDefinition(),
                vocabItem.getExampleSentence(),
                vocabItem.getPartOfSpeech()));
      }
      case DIALOGUE -> {
        if (isBlank(input.dialogueText())) {
          throw new ResponseStatusException(
              HttpStatus.BAD_REQUEST, "dialogueText is required for dialogue step");
        }
        step.setVocabItem(null);
        step.setPayload(lessonStepPayloadService.buildDialoguePayload(input.dialogueText().trim()));
      }
      case QUESTION -> {
        if (input.questionType() == null || isBlank(input.prompt())) {
          throw new ResponseStatusException(
              HttpStatus.BAD_REQUEST, "questionType and prompt are required for question steps");
        }
        step.setVocabItem(null);
        step.setPayload(
            lessonStepPayloadService.buildQuestionPayload(
                input.questionType(),
                input.prompt().trim(),
                trimToNull(input.explanation()),
                sanitizeList(input.options()),
                input.correctOptionIndex(),
                sanitizeList(input.acceptedAnswers()),
                sanitizePairs(input.matchPairs())));
      }
      case RECAP -> {
        step.setVocabItem(null);
        step.setPayload(lessonStepPayloadService.buildRecapPayload(input.payload()));
      }
    }
  }

  private void normalizeStepOrder(Long lessonId) {
    List<LessonStep> steps =
        lessonStepRepository.findByLessonIdOrderByOrderIndexAsc(lessonId).stream()
            .sorted(
                Comparator.comparing(LessonStep::getOrderIndex).thenComparing(LessonStep::getId))
            .toList();

    int i = 1;
    for (LessonStep step : steps) {
      if (!step.getOrderIndex().equals(i)) {
        step.setOrderIndex(i);
        lessonStepRepository.save(step);
      }
      i++;
    }
  }

  private Lesson requireLesson(Long lessonId) {
    return lessonRepository
        .findById(lessonId)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "lesson not found"));
  }

  private void ensureCanViewLesson(User actor, Lesson lesson) {
    if (lesson.getStatus() == LessonStatus.APPROVED) {
      return;
    }
    if (isAdminOrModerator(actor)) {
      return;
    }
    if (lesson.getCreatedBy() != null && lesson.getCreatedBy().equals(actor.getId())) {
      return;
    }
    throw new ResponseStatusException(HttpStatus.FORBIDDEN, "lesson is not available");
  }

  private void ensureCanEditSteps(User actor, Lesson lesson) {
    // Allow full editing of DRAFT and REJECTED lessons
    if (lesson.getStatus() == LessonStatus.DRAFT || lesson.getStatus() == LessonStatus.REJECTED) {
      requireOwnerOrAdmin(actor, lesson);
    } else if (lesson.getStatus() == LessonStatus.APPROVED) {
      // Only admins/moderators can edit approved lessons (e.g., hardcoded curriculum content)
      if (!isAdminOrModerator(actor)) {
        throw new ResponseStatusException(
            HttpStatus.FORBIDDEN, "only admins/moderators can edit approved lessons");
      }
    } else {
      // PENDING_REVIEW or other statuses
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "steps can only be edited when lesson is in DRAFT or REJECTED");
    }
  }

  private void requireOwnerOrAdmin(User actor, Lesson lesson) {
    if (isAdminOrModerator(actor)) {
      return;
    }
    if (lesson.getCreatedBy() != null && lesson.getCreatedBy().equals(actor.getId())) {
      return;
    }
    throw new ResponseStatusException(
        HttpStatus.FORBIDDEN, "you do not have permission for this lesson");
  }

  private boolean isAdminOrModerator(User actor) {
    return actor.getRole() == Role.ADMIN || actor.getRole() == Role.MODERATOR;
  }

  private void requireRole(User actor, Role... roles) {
    for (Role role : roles) {
      if (actor.getRole() == role) {
        return;
      }
    }
    throw new ResponseStatusException(HttpStatus.FORBIDDEN, "insufficient role permissions");
  }

  private static String sanitize(String value) {
    if (value == null) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "field is required");
    }
    String trimmed = value.trim();
    if (trimmed.isEmpty()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "field cannot be blank");
    }
    return trimmed;
  }

  private static String trimToNull(String value) {
    if (value == null) {
      return null;
    }
    String trimmed = value.trim();
    return trimmed.isEmpty() ? null : trimmed;
  }

  private static boolean isBlank(String value) {
    return value == null || value.trim().isEmpty();
  }

  private static String slugify(String value) {
    String normalized =
        Normalizer.normalize(value, Normalizer.Form.NFD)
            .replaceAll("\\p{M}+", "")
            .toLowerCase()
            .replaceAll("[^a-z0-9]+", "-")
            .replaceAll("(^-|-$)", "");
    if (normalized.isBlank()) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "title cannot produce an empty slug");
    }
    return normalized;
  }

  private static List<String> sanitizeList(List<String> values) {
    if (values == null) {
      return null;
    }
    return values.stream().map(LessonService::sanitize).toList();
  }

  private static List<LessonStepPayloadService.MatchPairWrite> sanitizePairs(
      List<MatchPairInput> pairs) {
    if (pairs == null) {
      return null;
    }
    return pairs.stream()
        .map(
            pair ->
                new LessonStepPayloadService.MatchPairWrite(
                    sanitize(pair.left()), sanitize(pair.right())))
        .toList();
  }

  public record LessonDraftInput(
      Long unitId,
      String title,
      String description,
      String learningObjective,
      Integer estimatedMinutes,
      Integer orderIndex,
      Long targetSubunitId) {}

  public record LessonPatchInput(
      Long unitId,
      String title,
      String description,
      String learningObjective,
      Integer estimatedMinutes,
      Integer orderIndex,
      LessonStatus status,
      String reviewComment) {}

  public record MatchPairInput(String left, String right) {}

  public record StepWriteInput(
      Integer orderIndex,
      StepType stepType,
      Long vocabItemId,
      Long questionId,
      QuestionType questionType,
      String prompt,
      String explanation,
      List<String> options,
      Integer correctOptionIndex,
      List<String> acceptedAnswers,
      List<MatchPairInput> matchPairs,
      String dialogueText,
      JsonNode payload) {}
}
