package com.group7.app.lesson.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.group7.app.lesson.model.Lesson;
import com.group7.app.lesson.model.LessonAttempt;
import com.group7.app.lesson.model.LessonAttemptResult;
import com.group7.app.lesson.model.LessonStatus;
import com.group7.app.lesson.model.LessonStep;
import com.group7.app.lesson.model.QuestionType;
import com.group7.app.lesson.model.StepType;
import com.group7.app.lesson.model.Unit;
import com.group7.app.lesson.model.UserLessonProgress;
import com.group7.app.lesson.model.UserStepEvent;
import com.group7.app.lesson.model.UserVocabMemory;
import com.group7.app.lesson.model.VocabItem;
import com.group7.app.lesson.repository.LessonAttemptRepository;
import com.group7.app.lesson.repository.LessonAttemptResultRepository;
import com.group7.app.lesson.repository.LessonRepository;
import com.group7.app.lesson.repository.LessonStepRepository;
import com.group7.app.lesson.repository.UserLessonProgressRepository;
import com.group7.app.lesson.repository.UserStepEventRepository;
import com.group7.app.lesson.repository.UserVocabMemoryRepository;
import com.group7.app.lesson.repository.VocabItemRepository;
import com.group7.app.user.Role;
import com.group7.app.user.User;
import com.group7.app.user.UserRepository;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Pageable;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;

@ExtendWith(MockitoExtension.class)
class LessonAttemptServiceTest {

  @Mock private LessonRepository lessonRepository;

  @Mock private LessonStepRepository lessonStepRepository;

  @Mock private LessonAttemptRepository lessonAttemptRepository;

  @Mock private LessonAttemptResultRepository lessonAttemptResultRepository;

  @Mock private UserLessonProgressRepository userLessonProgressRepository;

  @Mock private UserStepEventRepository userStepEventRepository;

  @Mock private UserVocabMemoryRepository userVocabMemoryRepository;

  @Mock private VocabItemRepository vocabItemRepository;

  @Mock private UserRepository userRepository;

  private LessonAttemptService lessonAttemptService;

  private LessonStepPayloadService payloadService;

  @BeforeEach
  void setUp() {
    payloadService = new LessonStepPayloadService(new ObjectMapper());
    lessonAttemptService =
        new LessonAttemptService(
            lessonRepository,
            lessonStepRepository,
            payloadService,
            lessonAttemptRepository,
            lessonAttemptResultRepository,
            userLessonProgressRepository,
            userStepEventRepository,
            userVocabMemoryRepository,
            vocabItemRepository,
            userRepository);
  }

  @Test
  @SuppressWarnings("unchecked")
  void submitAttemptGradesAnswersAndUpdatesProgressAndMemory() {
    User learner = learner();
    Lesson lesson = approvedLesson();
    VocabItem vocabItem = vocabItem();
    LessonStep teachStep = teachStep(lesson, vocabItem, 100L, 1);
    LessonStep questionStep = mcqQuestionStep(lesson, 101L, 2);

    when(userRepository.findById(learner.getId())).thenReturn(Optional.of(learner));
    when(lessonRepository.findById(55L)).thenReturn(Optional.of(lesson));
    when(lessonStepRepository.findByLessonIdAndStepTypeOrderByOrderIndexAsc(55L, StepType.QUESTION))
        .thenReturn(List.of(questionStep));
    when(lessonStepRepository.findByLessonIdOrderByOrderIndexAsc(55L))
        .thenReturn(List.of(teachStep, questionStep));
    when(lessonAttemptRepository.save(any(LessonAttempt.class)))
        .thenAnswer(
            invocation -> {
              LessonAttempt attempt = invocation.getArgument(0);
              ReflectionTestUtils.setField(attempt, "id", 77L);
              ReflectionTestUtils.setField(attempt, "startedAt", Instant.now());
              ReflectionTestUtils.setField(attempt, "submittedAt", Instant.now());
              return attempt;
            });
    when(userLessonProgressRepository.findByUserIdAndLessonId(learner.getId(), 55L))
        .thenReturn(Optional.empty());
    when(userLessonProgressRepository.save(any(UserLessonProgress.class)))
        .thenAnswer(invocation -> invocation.getArgument(0));
    when(vocabItemRepository.findById(vocabItem.getId())).thenReturn(Optional.of(vocabItem));
    when(userVocabMemoryRepository.findByUserIdAndVocabItemId(learner.getId(), vocabItem.getId()))
        .thenReturn(Optional.empty());

    var result =
        lessonAttemptService.submitAttempt(
            learner,
            55L,
            List.of(
                new LessonAttemptService.AnswerInput(
                    101L, JsonNodeFactory.instance.textNode("Charisma"))),
            Instant.now().minusSeconds(30));

    assertThat(result.attemptId()).isEqualTo(77L);
    assertThat(result.score()).isEqualTo(100);
    assertThat(result.correctCount()).isEqualTo(1);
    assertThat(result.passed()).isTrue();
    assertThat(result.results())
        .singleElement()
        .satisfies(
            item -> {
              assertThat(item.stepId()).isEqualTo(101L);
              assertThat(item.correct()).isTrue();
              assertThat(item.submittedAnswer().asText()).isEqualTo("Charisma");
              assertThat(item.correctAnswer()).isEqualTo("Charisma");
            });

    ArgumentCaptor<UserLessonProgress> progressCaptor =
        ArgumentCaptor.forClass(UserLessonProgress.class);
    verify(userLessonProgressRepository).save(progressCaptor.capture());
    assertThat(progressCaptor.getValue().getAttemptCount()).isEqualTo(1);
    assertThat(progressCaptor.getValue().getBestScore()).isEqualTo(100);
    assertThat(progressCaptor.getValue().getCompletedAt()).isNotNull();
    assertThat(progressCaptor.getValue().getLastStep().getId()).isEqualTo(101L);

    ArgumentCaptor<Iterable<LessonAttemptResult>> resultCaptor =
        ArgumentCaptor.forClass(Iterable.class);
    verify(lessonAttemptResultRepository).saveAll(resultCaptor.capture());
    assertThat(resultCaptor.getValue())
        .singleElement()
        .satisfies(
            savedResult -> {
              assertThat(savedResult.getAttempt().getId()).isEqualTo(77L);
              assertThat(savedResult.getLessonStep().getId()).isEqualTo(101L);
              assertThat(savedResult.getLessonId()).isEqualTo(55L);
              assertThat(savedResult.isCorrect()).isTrue();
              assertThat(savedResult.getSubmittedAnswer().asText()).isEqualTo("Charisma");
              assertThat(savedResult.getEvaluatedAnswer().path("text").asText())
                  .isEqualTo("Charisma");
              assertThat(savedResult.getExplanation()).isEqualTo("Because it means charisma.");
            });

    ArgumentCaptor<UserVocabMemory> memoryCaptor = ArgumentCaptor.forClass(UserVocabMemory.class);
    verify(userVocabMemoryRepository).save(memoryCaptor.capture());
    UserVocabMemory savedMemory = memoryCaptor.getValue();
    assertThat(savedMemory.getUserId()).isEqualTo(learner.getId());
    assertThat(savedMemory.getVocabItem()).isSameAs(vocabItem);
    assertThat(savedMemory.getStrength()).isEqualTo(1);
    assertThat(savedMemory.getCorrectStreak()).isEqualTo(1);
    assertThat(savedMemory.getLastSeenAt()).isNotNull();
    assertThat(savedMemory.getNextDueAt())
        .isEqualTo(savedMemory.getLastSeenAt().plus(1, ChronoUnit.DAYS));
  }

  @Test
  void submitAttemptRejectsUnapprovedLesson() {
    Lesson draft = approvedLesson();
    draft.setStatus(LessonStatus.DRAFT);
    when(lessonRepository.findById(55L)).thenReturn(Optional.of(draft));

    assertThatThrownBy(
            () -> lessonAttemptService.submitAttempt(learner(), 55L, List.of(), Instant.now()))
        .isInstanceOf(ResponseStatusException.class)
        .hasMessageContaining("only approved lessons can be accessed by learners");
  }

  @Test
  void getAttemptRendersStoredAnswerFormats() {
    User learner = learner();
    Lesson lesson = approvedLesson();
    LessonAttempt attempt =
        new LessonAttempt(learner.getId(), lesson, 100, 3, 3, true, Instant.now(), Instant.now());
    ReflectionTestUtils.setField(attempt, "id", 88L);

    LessonAttemptResult mcq =
        result(
            attempt,
            questionStep(lesson, 1L),
            JsonNodeFactory.instance.objectNode().put("text", "Charisma"));
    LessonAttemptResult shortAnswer =
        result(attempt, questionStep(lesson, 2L), acceptedAnswerNode("no cap"));
    LessonAttemptResult match =
        result(attempt, questionStep(lesson, 3L), matchPairsNode("rizz", "charisma"));

    when(lessonAttemptRepository.findByIdAndUserId(88L, learner.getId()))
        .thenReturn(Optional.of(attempt));
    when(lessonAttemptResultRepository.findByAttemptIdOrderByIdAsc(88L))
        .thenReturn(List.of(mcq, shortAnswer, match));

    var response = lessonAttemptService.getAttempt(learner, 88L);

    assertThat(response.results())
        .extracting(LessonAttemptService.ResultItem::correctAnswer)
        .containsExactly("Charisma", "no cap", "rizz = charisma");
    assertThat(response.results())
        .extracting(item -> item.submittedAnswer().toString())
        .containsExactly(
            "{\"text\":\"Charisma\"}",
            "{\"acceptedAnswers\":[\"no cap\"]}",
            "{\"pairs\":[{\"left\":\"rizz\",\"right\":\"charisma\"}]}");
  }

  @Test
  void listDueVocabMemoryClampsLimitToFifty() {
    User learner = learner();
    when(userVocabMemoryRepository.findByUserIdAndNextDueAtLessThanEqualOrderByNextDueAtAsc(
            any(UUID.class), any(Instant.class), any(Pageable.class)))
        .thenReturn(List.of());

    lessonAttemptService.listDueVocabMemory(learner, 99, false);

    ArgumentCaptor<Pageable> pageableCaptor = ArgumentCaptor.forClass(Pageable.class);
    verify(userVocabMemoryRepository)
        .findByUserIdAndNextDueAtLessThanEqualOrderByNextDueAtAsc(
            any(UUID.class), any(Instant.class), pageableCaptor.capture());
    assertThat(pageableCaptor.getValue().getPageSize()).isEqualTo(50);
  }

  @Test
  void updateProgressPositionCreatesProgressWhenMissing() {
    User learner = learner();
    Lesson lesson = approvedLesson();
    LessonStep step = questionStep(lesson, 101L);

    when(lessonRepository.findById(55L)).thenReturn(Optional.of(lesson));
    when(lessonStepRepository.findByIdAndLessonId(101L, 55L)).thenReturn(Optional.of(step));
    when(userLessonProgressRepository.findByUserIdAndLessonId(learner.getId(), 55L))
        .thenReturn(Optional.empty());
    when(userLessonProgressRepository.save(any(UserLessonProgress.class)))
        .thenAnswer(invocation -> invocation.getArgument(0));

    var progress = lessonAttemptService.updateProgressPosition(learner, 55L, 101L);

    assertThat(progress.lessonId()).isEqualTo(55L);
    assertThat(progress.lastStepId()).isEqualTo(101L);
  }

  @Test
  void getReviseQueuePrioritizesDueMistakesBeforeFallback() {
    User learner = learner();
    Lesson lesson = approvedLesson();
    LessonStep weakStep = mcqQuestionStep(lesson, 101L, 1);
    LessonStep fallbackStep = mcqQuestionStep(lesson, 102L, 2);
    LessonAttempt lessonAttempt =
        new LessonAttempt(learner.getId(), lesson, 0, 1, 0, false, Instant.now(), Instant.now());
    ReflectionTestUtils.setField(lessonAttempt, "id", 99L);

    LessonAttemptResult wrongResult =
        new LessonAttemptResult(
            lessonAttempt,
            weakStep,
            55L,
            false,
            JsonNodeFactory.instance.textNode("Food"),
            JsonNodeFactory.instance.objectNode().put("text", "Charisma"),
            "Because it means charisma.");
    ReflectionTestUtils.setField(
        wrongResult, "createdAt", Instant.now().minus(5, ChronoUnit.HOURS));

    when(lessonStepRepository.findByStepTypeAndLessonStatusOrderByLessonOrderIndexAsc(
            StepType.QUESTION, LessonStatus.APPROVED))
        .thenReturn(List.of(weakStep, fallbackStep));
    when(lessonAttemptResultRepository.findByAttemptUserIdOrderByCreatedAtAsc(learner.getId()))
        .thenReturn(List.of(wrongResult));
    when(userStepEventRepository.findByUserIdAndEventTypeOrderByCreatedAtAsc(
            learner.getId(), "REVISE_ANSWERED"))
        .thenReturn(List.of());
    when(userLessonProgressRepository.findByUserId(learner.getId())).thenReturn(List.of());

    var queue = lessonAttemptService.getReviseQueue(learner, 2);

    assertThat(queue.dueCount()).isEqualTo(1);
    assertThat(queue.items()).hasSize(2);
    assertThat(queue.items().getFirst().stepId()).isEqualTo(101L);
    assertThat(queue.items().getFirst().priorityReason()).isEqualTo("recent_mistake");
    assertThat(queue.items().get(1).stepId()).isEqualTo(102L);
  }

  @Test
  void submitReviseAttemptEvaluatesAnswersAndLogsEvents() {
    User learner = learner();
    Lesson lesson = approvedLesson();
    LessonStep step = mcqQuestionStep(lesson, 101L, 1);

    when(lessonStepRepository.findByIdInWithLesson(List.of(101L))).thenReturn(List.of(step));
    when(userStepEventRepository.saveAll(any()))
        .thenAnswer(invocation -> invocation.getArgument(0));
    when(lessonStepRepository.findByStepTypeAndLessonStatusOrderByLessonOrderIndexAsc(
            StepType.QUESTION, LessonStatus.APPROVED))
        .thenReturn(List.of(step));
    when(lessonAttemptResultRepository.findByAttemptUserIdOrderByCreatedAtAsc(learner.getId()))
        .thenReturn(List.of());
    when(userStepEventRepository.findByUserIdAndEventTypeOrderByCreatedAtAsc(
            learner.getId(), "REVISE_ANSWERED"))
        .thenReturn(List.of());
    when(userLessonProgressRepository.findByUserId(learner.getId())).thenReturn(List.of());

    var result =
        lessonAttemptService.submitReviseAttempt(
            learner,
            List.of(
                new LessonAttemptService.AnswerInput(
                    101L, JsonNodeFactory.instance.textNode("Charisma"))));

    assertThat(result.score()).isEqualTo(100);
    assertThat(result.correctCount()).isEqualTo(1);
    assertThat(result.results())
        .singleElement()
        .satisfies(item -> assertThat(item.correct()).isTrue());

    ArgumentCaptor<Iterable<UserStepEvent>> eventCaptor = ArgumentCaptor.forClass(Iterable.class);
    verify(userStepEventRepository).saveAll(eventCaptor.capture());
    assertThat(eventCaptor.getValue())
        .singleElement()
        .satisfies(
            event -> {
              assertThat(event.getUserId()).isEqualTo(learner.getId());
              assertThat(event.getLessonStep().getId()).isEqualTo(101L);
              assertThat(event.getEventType()).isEqualTo("REVISE_ANSWERED");
              assertThat(event.getPayload().path("correct").asBoolean()).isTrue();
            });
  }

  private User learner() {
    User learner = new User(UUID.randomUUID(), "learner@example.com");
    learner.setRole(Role.LEARNER);
    return learner;
  }

  private Lesson approvedLesson() {
    Unit unit = new Unit("Unit", "unit", "desc", 1);
    ReflectionTestUtils.setField(unit, "id", 10L);
    Lesson lesson = new Lesson(unit, "Lesson", "lesson", "desc", null, 5, 1, UUID.randomUUID());
    ReflectionTestUtils.setField(lesson, "id", 55L);
    lesson.setStatus(LessonStatus.APPROVED);
    return lesson;
  }

  private VocabItem vocabItem() {
    VocabItem vocabItem = new VocabItem("rizz", "charisma", "example", "noun");
    ReflectionTestUtils.setField(vocabItem, "id", 5L);
    return vocabItem;
  }

  private LessonStep teachStep(Lesson lesson, VocabItem vocabItem, Long id, int orderIndex) {
    LessonStep step = new LessonStep(lesson, orderIndex, StepType.TEACH);
    ReflectionTestUtils.setField(step, "id", id);
    step.setVocabItem(vocabItem);
    step.setPayload(payloadService.buildTeachPayload("rizz", "charisma", "example", "noun"));
    return step;
  }

  private LessonStep mcqQuestionStep(Lesson lesson, Long id, int orderIndex) {
    LessonStep step = new LessonStep(lesson, orderIndex, StepType.QUESTION);
    ReflectionTestUtils.setField(step, "id", id);
    step.setPayload(
        payloadService.buildQuestionPayload(
            QuestionType.MCQ,
            "What does rizz mean?",
            "Because it means charisma.",
            List.of("Charisma", "Food"),
            0,
            null,
            null));
    return step;
  }

  private LessonStep questionStep(Lesson lesson, Long id) {
    LessonStep step = new LessonStep(lesson, 1, StepType.QUESTION);
    ReflectionTestUtils.setField(step, "id", id);
    step.setPayload(JsonNodeFactory.instance.objectNode());
    return step;
  }

  private LessonAttemptResult result(
      LessonAttempt attempt,
      LessonStep step,
      com.fasterxml.jackson.databind.JsonNode evaluatedAnswer) {
    return new LessonAttemptResult(
        attempt, step, 55L, true, evaluatedAnswer, evaluatedAnswer, "explanation");
  }

  private com.fasterxml.jackson.databind.JsonNode acceptedAnswerNode(String answer) {
    ObjectMapper objectMapper = new ObjectMapper();
    var node = objectMapper.createObjectNode();
    node.putArray("acceptedAnswers").add(answer);
    return node;
  }

  private com.fasterxml.jackson.databind.JsonNode matchPairsNode(String left, String right) {
    ObjectMapper objectMapper = new ObjectMapper();
    var node = objectMapper.createObjectNode();
    node.putArray("pairs").addObject().put("left", left).put("right", right);
    return node;
  }
}
