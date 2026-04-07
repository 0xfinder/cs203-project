package com.group7.app.lesson.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
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
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;

@ExtendWith(MockitoExtension.class)
class LessonServiceTest {

  @Mock private UnitRepository unitRepository;

  @Mock private LessonRepository lessonRepository;

  @Mock private LessonStepRepository lessonStepRepository;

  @Mock private VocabItemRepository vocabItemRepository;

  private LessonService lessonService;

  @BeforeEach
  void setUp() {
    lessonService =
        new LessonService(
            unitRepository,
            lessonRepository,
            lessonStepRepository,
            vocabItemRepository,
            new LessonStepPayloadService(new ObjectMapper()));
  }

  @Test
  void createUnitAllowsModeratorAndAppendsOrder() {
    User moderator = user(Role.MODERATOR);
    Unit existing = new Unit("Existing", "existing", "desc", 2);
    when(unitRepository.findAllByOrderByOrderIndexAsc()).thenReturn(List.of(existing));
    when(unitRepository.save(any(Unit.class))).thenAnswer(invocation -> invocation.getArgument(0));
    when(unitRepository.existsBySlug("fresh-unit")).thenReturn(false);

    Unit created =
        lessonService.createUnit(
            moderator, new LessonService.UnitCreateInput("  Fresh Unit  ", "  new material  "));

    assertThat(created.getTitle()).isEqualTo("Fresh Unit");
    assertThat(created.getSlug()).isEqualTo("fresh-unit");
    assertThat(created.getDescription()).isEqualTo("new material");
    assertThat(created.getOrderIndex()).isEqualTo(3);
  }

  @Test
  void patchUnitRenamesAndReslugsUnit() {
    User admin = user(Role.ADMIN);
    Unit unit = new Unit("Old Unit", "old-unit", "desc", 1);
    ReflectionTestUtils.setField(unit, "id", 9L);
    when(unitRepository.findById(9L)).thenReturn(Optional.of(unit));
    when(unitRepository.existsBySlug("fresh-name")).thenReturn(false);
    when(unitRepository.save(unit)).thenReturn(unit);

    Unit updated =
        lessonService.patchUnit(
            admin, 9L, new LessonService.UnitPatchInput(" Fresh Name ", " sharper desc "));

    assertThat(updated.getTitle()).isEqualTo("Fresh Name");
    assertThat(updated.getSlug()).isEqualTo("fresh-name");
    assertThat(updated.getDescription()).isEqualTo("sharper desc");
  }

  @Test
  void deleteUnitRejectsUnitWithLessons() {
    Unit unit = new Unit("Unit", "unit", "desc", 1);
    ReflectionTestUtils.setField(unit, "id", 10L);
    when(unitRepository.findById(10L)).thenReturn(Optional.of(unit));
    when(lessonRepository.findByUnitIdOrderByOrderIndexAsc(10L))
        .thenReturn(List.of(lesson(LessonStatus.APPROVED, UUID.randomUUID())));

    assertThatThrownBy(() -> lessonService.deleteUnit(user(Role.ADMIN), 10L))
        .isInstanceOf(ResponseStatusException.class)
        .hasMessageContaining("cannot delete a unit that still has lessons");

    verify(unitRepository, never()).delete(any(Unit.class));
  }

  @Test
  void createLessonSanitizesFieldsAndGeneratesSlug() {
    User contributor = user(Role.CONTRIBUTOR);
    Unit unit = new Unit("Slang", "slang", "desc", 1);
    ReflectionTestUtils.setField(unit, "id", 10L);
    when(unitRepository.findById(10L)).thenReturn(Optional.of(unit));
    when(lessonRepository.save(any(Lesson.class)))
        .thenAnswer(invocation -> invocation.getArgument(0));

    Lesson lesson =
        lessonService.createLesson(
            contributor,
            new LessonService.LessonDraftInput(
                10L, "  Crème de la Rizz  ", "  Intro lesson  ", "  learn the basics  ", 7, 1));

    assertThat(lesson.getTitle()).isEqualTo("Crème de la Rizz");
    assertThat(lesson.getSlug()).isEqualTo("creme-de-la-rizz");
    assertThat(lesson.getDescription()).isEqualTo("Intro lesson");
    assertThat(lesson.getLearningObjective()).isEqualTo("learn the basics");
    assertThat(lesson.getStatus()).isEqualTo(LessonStatus.DRAFT);
  }

  @Test
  void createLessonAllowsModerator() {
    User moderator = user(Role.MODERATOR);
    Unit unit = new Unit("Core", "core", "desc", 1);
    when(unitRepository.findById(10L)).thenReturn(Optional.of(unit));
    when(lessonRepository.existsBySlug("mod-lesson")).thenReturn(false);
    when(lessonRepository.save(any(Lesson.class)))
        .thenAnswer(invocation -> invocation.getArgument(0));

    Lesson lesson =
        lessonService.createLesson(
            moderator, new LessonService.LessonDraftInput(10L, "Mod Lesson", "Desc", null, 5, 1));

    assertThat(lesson.getCreatedBy()).isEqualTo(moderator.getId());
    assertThat(lesson.getStatus()).isEqualTo(LessonStatus.DRAFT);
  }

  @Test
  void createLessonRejectsInsufficientRole() {
    assertThatThrownBy(
            () ->
                lessonService.createLesson(
                    user(Role.LEARNER),
                    new LessonService.LessonDraftInput(1L, "Title", "Desc", null, 5, 1)))
        .isInstanceOf(ResponseStatusException.class)
        .hasMessageContaining("insufficient role permissions");
  }

  @Test
  void patchLessonSubmitsDraftLessonForReview() {
    User contributor = user(Role.CONTRIBUTOR);
    Lesson lesson = lesson(LessonStatus.DRAFT, contributor.getId());
    lesson.setReviewComment("old comment");
    when(lessonRepository.findById(55L)).thenReturn(Optional.of(lesson));
    when(lessonRepository.save(lesson)).thenReturn(lesson);

    Lesson updated =
        lessonService.patchLesson(
            contributor,
            55L,
            new LessonService.LessonPatchInput(
                null, null, null, null, null, null, LessonStatus.PENDING_REVIEW, null));

    assertThat(updated.getStatus()).isEqualTo(LessonStatus.PENDING_REVIEW);
    assertThat(updated.getReviewComment()).isNull();
    assertThat(updated.getReviewedBy()).isNull();
  }

  @Test
  void patchLessonApprovesPendingLessonForModerator() {
    User moderator = user(Role.MODERATOR);
    Lesson lesson = lesson(LessonStatus.PENDING_REVIEW, user(Role.CONTRIBUTOR).getId());
    when(lessonRepository.findById(55L)).thenReturn(Optional.of(lesson));
    when(lessonRepository.save(lesson)).thenReturn(lesson);

    Lesson updated =
        lessonService.patchLesson(
            moderator,
            55L,
            new LessonService.LessonPatchInput(
                null, null, null, null, null, null, LessonStatus.APPROVED, null));

    assertThat(updated.getStatus()).isEqualTo(LessonStatus.APPROVED);
    assertThat(updated.getReviewedBy()).isEqualTo(moderator.getId());
    assertThat(updated.getPublishedAt()).isNotNull();
  }

  @Test
  void patchLessonBlocksContributorApproval() {
    User contributor = user(Role.CONTRIBUTOR);
    Lesson lesson = lesson(LessonStatus.PENDING_REVIEW, contributor.getId());
    when(lessonRepository.findById(55L)).thenReturn(Optional.of(lesson));

    assertThatThrownBy(
            () ->
                lessonService.patchLesson(
                    contributor,
                    55L,
                    new LessonService.LessonPatchInput(
                        null, null, null, null, null, null, LessonStatus.APPROVED, null)))
        .isInstanceOf(ResponseStatusException.class)
        .hasMessageContaining("only moderators/admin can review lessons");

    verify(lessonRepository, never()).save(any(Lesson.class));
  }

  @Test
  void patchLessonRequiresReviewCommentWhenRejecting() {
    Lesson lesson = lesson(LessonStatus.PENDING_REVIEW, user(Role.CONTRIBUTOR).getId());
    when(lessonRepository.findById(55L)).thenReturn(Optional.of(lesson));

    assertThatThrownBy(
            () ->
                lessonService.patchLesson(
                    user(Role.MODERATOR),
                    55L,
                    new LessonService.LessonPatchInput(
                        null, null, null, null, null, null, LessonStatus.REJECTED, "  ")))
        .isInstanceOf(ResponseStatusException.class)
        .hasMessageContaining("reviewComment is required when rejecting");
  }

  @Test
  void patchLessonReturnsRejectedLessonToDraft() {
    User contributor = user(Role.CONTRIBUTOR);
    Lesson lesson = lesson(LessonStatus.REJECTED, contributor.getId());
    lesson.setReviewComment("needs work");
    when(lessonRepository.findById(55L)).thenReturn(Optional.of(lesson));
    when(lessonRepository.save(lesson)).thenReturn(lesson);

    Lesson updated =
        lessonService.patchLesson(
            contributor,
            55L,
            new LessonService.LessonPatchInput(
                null, null, null, null, null, null, LessonStatus.DRAFT, null));

    assertThat(updated.getStatus()).isEqualTo(LessonStatus.DRAFT);
    assertThat(updated.getReviewComment()).isNull();
  }

  @Test
  void patchLessonBlocksContributorEditsOnApprovedLesson() {
    User contributor = user(Role.CONTRIBUTOR);
    Lesson lesson = lesson(LessonStatus.APPROVED, contributor.getId());
    when(lessonRepository.findById(55L)).thenReturn(Optional.of(lesson));

    assertThatThrownBy(
            () ->
                lessonService.patchLesson(
                    contributor,
                    55L,
                    new LessonService.LessonPatchInput(
                        null, "New title", null, null, null, null, null, null)))
        .isInstanceOf(ResponseStatusException.class)
        .hasMessageContaining("approved lessons can only be edited");

    verify(lessonRepository, never()).save(any(Lesson.class));
  }

  @Test
  void listLessonsForLearnerAlwaysUsesApprovedStatus() {
    User learner = user(Role.LEARNER);
    Lesson approved = lesson(LessonStatus.APPROVED, UUID.randomUUID());
    when(lessonRepository.findByStatusOrderByOrderIndexAsc(LessonStatus.APPROVED))
        .thenReturn(List.of(approved));

    List<Lesson> lessons = lessonService.listLessons(learner, null, LessonStatus.DRAFT);

    assertThat(lessons).containsExactly(approved);
    verify(lessonRepository).findByStatusOrderByOrderIndexAsc(LessonStatus.APPROVED);
  }

  @Test
  void getLessonRejectsNonOwnerForDraftLesson() {
    Lesson draftLesson = lesson(LessonStatus.DRAFT, UUID.randomUUID());
    when(lessonRepository.findById(55L)).thenReturn(Optional.of(draftLesson));

    assertThatThrownBy(() -> lessonService.getLesson(user(Role.LEARNER), 55L))
        .isInstanceOf(ResponseStatusException.class)
        .hasMessageContaining("lesson is not available");
  }

  @Test
  void createTeachStepBuildsPayloadFromVocabItem() {
    User contributor = user(Role.CONTRIBUTOR);
    Lesson lesson = lesson(LessonStatus.DRAFT, contributor.getId());
    VocabItem vocabItem = new VocabItem("rizz", "charisma", "example", "noun");
    ReflectionTestUtils.setField(vocabItem, "id", 77L);

    when(lessonRepository.findById(55L)).thenReturn(Optional.of(lesson));
    when(vocabItemRepository.findById(77L)).thenReturn(Optional.of(vocabItem));
    when(lessonStepRepository.save(any(LessonStep.class)))
        .thenAnswer(invocation -> invocation.getArgument(0));
    when(lessonStepRepository.findByLessonIdOrderByOrderIndexAsc(55L)).thenReturn(List.of());

    LessonStep step =
        lessonService.createStep(
            contributor,
            55L,
            new LessonService.StepWriteInput(
                1,
                StepType.TEACH,
                77L,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null));

    assertThat(step.getPayload().path("title").asText()).isEqualTo("rizz");
    assertThat(step.getPayload().path("partOfSpeech").asText()).isEqualTo("noun");
    assertThat(step.getVocabItem()).isSameAs(vocabItem);
  }

  @Test
  void createQuestionStepRequiresPrompt() {
    User contributor = user(Role.CONTRIBUTOR);
    Lesson lesson = lesson(LessonStatus.DRAFT, contributor.getId());
    when(lessonRepository.findById(55L)).thenReturn(Optional.of(lesson));

    assertThatThrownBy(
            () ->
                lessonService.createStep(
                    contributor,
                    55L,
                    new LessonService.StepWriteInput(
                        1,
                        StepType.QUESTION,
                        null,
                        null,
                        QuestionType.MCQ,
                        " ",
                        null,
                        List.of("a", "b"),
                        0,
                        null,
                        null,
                        null,
                        null)))
        .isInstanceOf(ResponseStatusException.class)
        .hasMessageContaining("questionType and prompt are required");
  }

  private User user(Role role) {
    User user = new User(UUID.randomUUID(), role.name().toLowerCase() + "@example.com");
    user.setRole(role);
    return user;
  }

  private Lesson lesson(LessonStatus status, UUID createdBy) {
    Unit unit = new Unit("Unit", "unit", "desc", 1);
    ReflectionTestUtils.setField(unit, "id", 10L);
    Lesson lesson = new Lesson(unit, "Lesson", "lesson", "desc", null, 5, 1, createdBy);
    ReflectionTestUtils.setField(lesson, "id", 55L);
    lesson.setStatus(status);
    lesson.setCreatedBy(createdBy);
    return lesson;
  }
}
