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

  public Unit createUnit(User actor, UnitCreateInput input) {
    requireRole(actor, Role.ADMIN, Role.MODERATOR);

    String title = sanitize(input.title());
    Unit unit =
        new Unit(
            title,
            uniqueUnitSlugForTitle(title, null),
            trimToNull(input.description()),
            nextUnitOrderIndex());
    return unitRepository.save(unit);
  }

  public Unit patchUnit(User actor, Long unitId, UnitPatchInput input) {
    requireRole(actor, Role.ADMIN, Role.MODERATOR);
    Unit unit = requireUnit(unitId);

    if (input.title() != null) {
      String title = sanitize(input.title());
      unit.setTitle(title);
      unit.setSlug(uniqueUnitSlugForTitle(title, unit.getId()));
    }

    if (input.description() != null) {
      unit.setDescription(trimToNull(input.description()));
    }

    if (input.orderIndex() != null) {
      reorderUnit(unit, input.orderIndex());
      return unit;
    }

    return unitRepository.save(unit);
  }

  public void deleteUnit(User actor, Long unitId) {
    requireRole(actor, Role.ADMIN, Role.MODERATOR);
    Unit unit = requireUnit(unitId);
    if (!lessonRepository.findByUnitIdOrderByOrderIndexAsc(unitId).isEmpty()) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "cannot delete a unit that still has lessons");
    }
    unitRepository.delete(unit);
    normalizeUnitOrder();
  }

  public Lesson createLesson(User actor, LessonDraftInput input) {
    requireRole(actor, Role.CONTRIBUTOR, Role.MODERATOR, Role.ADMIN);
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

  private String uniqueUnitSlugForTitle(String title, Long currentUnitId) {
    String base = slugify(title);
    String candidate = base;
    int suffix = 1;
    String currentSlug =
        currentUnitId == null
            ? null
            : unitRepository.findById(currentUnitId).map(Unit::getSlug).orElse(null);

    while (unitRepository.existsBySlug(candidate) && !candidate.equals(currentSlug)) {
      candidate = base + "-" + suffix;
      suffix++;
    }

    return candidate;
  }

  public Lesson patchLesson(User actor, Long lessonId, LessonPatchInput input) {
    Lesson lesson = requireLesson(lessonId);
    Unit originalUnit = lesson.getUnit();
    Unit targetUnit = originalUnit;

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
        targetUnit =
            unitRepository
                .findById(input.unitId())
                .orElseThrow(
                    () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "unit not found"));
        lesson.setUnit(targetUnit);
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
    }

    Lesson saved = lessonRepository.save(lesson);
    if (input.orderIndex() != null || !originalUnit.getId().equals(targetUnit.getId())) {
      int requestedOrderIndex =
          input.orderIndex() != null
              ? input.orderIndex()
              : lessonRepository.findByUnitIdOrderByOrderIndexAsc(targetUnit.getId()).size();
      reorderLesson(saved, originalUnit, targetUnit, requestedOrderIndex);
      return saved;
    }

    return saved;
  }

  public List<Lesson> listLessons(User actor, Long unitId, LessonStatus status, boolean mine) {
    if (mine) {
      requireRole(actor, Role.CONTRIBUTOR, Role.MODERATOR, Role.ADMIN);
      List<Lesson> ownLessons =
          status != null
              ? lessonRepository.findByCreatedByAndStatusOrderByUpdatedAtDescIdDesc(
                  actor.getId(), status)
              : lessonRepository.findByCreatedByOrderByUpdatedAtDescIdDesc(actor.getId());

      if (unitId != null) {
        return ownLessons.stream()
            .filter(lesson -> lesson.getUnit().getId().equals(unitId))
            .toList();
      }

      return ownLessons;
    }

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

    // Auto-assign orderIndex if not provided (similar to createLesson)
    int orderIndex = input.orderIndex();
    if (orderIndex <= 0) {
      List<LessonStep> existing = lessonStepRepository.findByLessonIdOrderByOrderIndexAsc(lessonId);
      int max =
          existing.stream()
              .map(LessonStep::getOrderIndex)
              .filter(i -> i != null && i > 0)
              .max(Comparator.naturalOrder())
              .orElse(0);
      orderIndex = max + 1;
      System.out.println(
          "[DEBUG] Auto-assigning step orderIndex for lesson " + lessonId + ": " + orderIndex);
    }

    int temporaryOrderIndex =
        lessonStepRepository.findByLessonIdOrderByOrderIndexAsc(lessonId).stream()
                .map(LessonStep::getOrderIndex)
                .filter(i -> i != null)
                .max(Comparator.naturalOrder())
                .orElse(0)
            + 1;

    LessonStep step = new LessonStep(lesson, temporaryOrderIndex, input.stepType());
    applyStepPayload(step, input);

    LessonStep saved = lessonStepRepository.saveAndFlush(step);
    reorderStep(saved, lessonId, orderIndex);
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

    step.setStepType(input.stepType());
    applyStepPayload(step, input);

    reorderStep(step, lessonId, input.orderIndex());
    return step;
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
        // Use provided payload if exists, otherwise build from vocab item
        if (input.payload() != null && !input.payload().isEmpty()) {
          step.setPayload(input.payload());
        } else {
          step.setPayload(
              lessonStepPayloadService.buildTeachPayload(
                  vocabItem.getTerm(),
                  vocabItem.getDefinition(),
                  vocabItem.getExampleSentence(),
                  vocabItem.getPartOfSpeech()));
        }
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

    applyStepOrder(steps);
  }

  private Lesson requireLesson(Long lessonId) {
    return lessonRepository
        .findById(lessonId)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "lesson not found"));
  }

  private Unit requireUnit(Long unitId) {
    return unitRepository
        .findById(unitId)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "unit not found"));
  }

  private int nextUnitOrderIndex() {
    return unitRepository.findAllByOrderByOrderIndexAsc().stream()
            .map(Unit::getOrderIndex)
            .filter(i -> i != null)
            .max(Comparator.naturalOrder())
            .orElse(0)
        + 1;
  }

  private void normalizeUnitOrder() {
    List<Unit> units =
        unitRepository.findAllByOrderByOrderIndexAsc().stream()
            .sorted(Comparator.comparing(Unit::getOrderIndex).thenComparing(Unit::getId))
            .toList();

    int i = 1;
    for (Unit unit : units) {
      if (!unit.getOrderIndex().equals(i)) {
        unit.setOrderIndex(i);
        unitRepository.save(unit);
      }
      i++;
    }
  }

  private void reorderUnit(Unit unit, int requestedOrderIndex) {
    List<Unit> units =
        unitRepository.findAllByOrderByOrderIndexAsc().stream()
            .sorted(Comparator.comparing(Unit::getOrderIndex).thenComparing(Unit::getId))
            .toList();

    List<Unit> reordered =
        units.stream().filter(existing -> !existing.getId().equals(unit.getId())).toList();
    int boundedIndex = Math.max(1, Math.min(requestedOrderIndex, reordered.size() + 1));

    java.util.ArrayList<Unit> mutable = new java.util.ArrayList<>(reordered);
    mutable.add(boundedIndex - 1, unit);

    // assign temporary negative slots first so we never trip the unique
    // constraint on order_index while reshuffling persisted rows.
    for (int index = 0; index < mutable.size(); index++) {
      Unit current = mutable.get(index);
      int temporaryOrderIndex = -1 * (index + 1);
      if (!current.getOrderIndex().equals(temporaryOrderIndex)) {
        current.setOrderIndex(temporaryOrderIndex);
      }
      unitRepository.saveAndFlush(current);
    }

    int finalOrderIndex = 1;
    for (Unit current : mutable) {
      current.setOrderIndex(finalOrderIndex);
      unitRepository.saveAndFlush(current);
      finalOrderIndex++;
    }
  }

  private void reorderLesson(
      Lesson lesson, Unit originalUnit, Unit targetUnit, int requestedOrderIndex) {
    List<Lesson> lessons =
        lessonRepository.findByUnitIdOrderByOrderIndexAsc(targetUnit.getId()).stream()
            .filter(existing -> !existing.getId().equals(lesson.getId()))
            .sorted(Comparator.comparing(Lesson::getOrderIndex).thenComparing(Lesson::getId))
            .toList();

    int boundedIndex = Math.max(1, Math.min(requestedOrderIndex, lessons.size() + 1));
    java.util.ArrayList<Lesson> mutable = new java.util.ArrayList<>(lessons);
    lesson.setUnit(targetUnit);
    mutable.add(boundedIndex - 1, lesson);

    applyLessonOrder(targetUnit, mutable);

    if (!originalUnit.getId().equals(targetUnit.getId())) {
      normalizeLessonOrder(originalUnit.getId());
    }
  }

  private void normalizeLessonOrder(Long unitId) {
    List<Lesson> lessons =
        lessonRepository.findByUnitIdOrderByOrderIndexAsc(unitId).stream()
            .sorted(Comparator.comparing(Lesson::getOrderIndex).thenComparing(Lesson::getId))
            .toList();
    Unit unit = requireUnit(unitId);
    applyLessonOrder(unit, lessons);
  }

  private void applyLessonOrder(Unit unit, List<Lesson> lessons) {
    for (int index = 0; index < lessons.size(); index++) {
      Lesson lesson = lessons.get(index);
      lesson.setUnit(unit);
      lesson.setOrderIndex(-1 * (index + 1));
      lessonRepository.saveAndFlush(lesson);
    }

    int orderIndex = 1;
    for (Lesson lesson : lessons) {
      lesson.setUnit(unit);
      lesson.setOrderIndex(orderIndex);
      lessonRepository.saveAndFlush(lesson);
      orderIndex++;
    }
  }

  private void reorderStep(LessonStep step, Long lessonId, int requestedOrderIndex) {
    List<LessonStep> steps =
        lessonStepRepository.findByLessonIdOrderByOrderIndexAsc(lessonId).stream()
            .filter(existing -> !existing.getId().equals(step.getId()))
            .sorted(
                Comparator.comparing(LessonStep::getOrderIndex).thenComparing(LessonStep::getId))
            .toList();

    int boundedIndex = Math.max(1, Math.min(requestedOrderIndex, steps.size() + 1));
    java.util.ArrayList<LessonStep> mutable = new java.util.ArrayList<>(steps);
    mutable.add(boundedIndex - 1, step);

    applyStepOrder(mutable);
  }

  private void applyStepOrder(List<LessonStep> steps) {
    for (int index = 0; index < steps.size(); index++) {
      LessonStep step = steps.get(index);
      step.setOrderIndex(-1 * (index + 1));
      lessonStepRepository.saveAndFlush(step);
    }

    int orderIndex = 1;
    for (LessonStep step : steps) {
      step.setOrderIndex(orderIndex);
      lessonStepRepository.saveAndFlush(step);
      orderIndex++;
    }
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
      Integer orderIndex) {}

  public record UnitCreateInput(String title, String description) {}

  public record UnitPatchInput(String title, String description, Integer orderIndex) {}

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
