package com.group7.app.lesson.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.group7.app.lesson.model.Lesson;
import com.group7.app.lesson.model.LessonStep;
import com.group7.app.lesson.model.QuestionType;
import com.group7.app.lesson.model.StepType;
import com.group7.app.lesson.model.Unit;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;

class LessonStepPayloadServiceTest {

  private final ObjectMapper objectMapper = new ObjectMapper();

  private LessonStepPayloadService service;

  @BeforeEach
  void setUp() {
    service = new LessonStepPayloadService(objectMapper);
  }

  @Test
  void buildQuestionPayloadCreatesMcqChoicesAndAnswerKey() {
    var payload =
        service.buildQuestionPayload(
            QuestionType.MCQ,
            "What does rizz mean?",
            "charisma",
            List.of("charisma", "food"),
            0,
            null,
            null);

    assertThat(payload.path("questionType").asText()).isEqualTo("MCQ");
    assertThat(payload.path("choices")).hasSize(2);
    assertThat(payload.path("choices").get(0).path("id").asLong()).isEqualTo(1L);
    assertThat(payload.path("answerKey").path("choiceId").asLong()).isEqualTo(1L);
  }

  @Test
  void buildQuestionPayloadRejectsOutOfBoundsMcqAnswerKey() {
    assertThatThrownBy(
            () ->
                service.buildQuestionPayload(
                    QuestionType.MCQ, "prompt", null, List.of("one", "two"), 5, null, null))
        .isInstanceOf(ResponseStatusException.class)
        .hasMessageContaining("correctOptionIndex out of bounds");
  }

  @Test
  void buildQuestionPayloadRequiresAtLeastTwoMcqOptions() {
    assertThatThrownBy(
            () ->
                service.buildQuestionPayload(
                    QuestionType.MCQ, "prompt", null, List.of("one"), 0, null, null))
        .isInstanceOf(ResponseStatusException.class)
        .hasMessageContaining("mcq requires at least two options");
  }

  @Test
  void buildQuestionPayloadRequiresAcceptedAnswersForShortAnswer() {
    assertThatThrownBy(
            () ->
                service.buildQuestionPayload(
                    QuestionType.SHORT_ANSWER, "prompt", null, null, null, List.of(), null))
        .isInstanceOf(ResponseStatusException.class)
        .hasMessageContaining("acceptedAnswers is required");
  }

  @Test
  void buildQuestionPayloadRequiresMatchPairsForMatchQuestion() {
    assertThatThrownBy(
            () ->
                service.buildQuestionPayload(
                    QuestionType.MATCH, "prompt", null, null, null, null, List.of()))
        .isInstanceOf(ResponseStatusException.class)
        .hasMessageContaining("matchPairs is required");
  }

  @Test
  void buildRecapPayloadRejectsNonObjectPayload() {
    assertThatThrownBy(() -> service.buildRecapPayload(JsonNodeFactory.instance.textNode("nope")))
        .isInstanceOf(ResponseStatusException.class)
        .hasMessageContaining("payload is required for recap step");
  }

  @Test
  void readQuestionTreatsLegacyClozeAsShortAnswer() {
    var payload =
        objectMapper
            .createObjectNode()
            .put("questionType", "CLOZE")
            .put("prompt", "Fill the blank");
    payload.putArray("acceptedAnswers").add("rizz");
    LessonStep step = questionStep(payload);

    var question = service.readQuestion(step);

    assertThat(question.questionType()).isEqualTo(QuestionType.SHORT_ANSWER);
    assertThat(question.acceptedAnswers()).containsExactly("rizz");
  }

  @Test
  void evaluateReturnsCorrectMatchResult() {
    LessonStep step =
        questionStep(
            service.buildQuestionPayload(
                QuestionType.MATCH,
                "Match them",
                "explanation",
                null,
                null,
                null,
                List.of(
                    new LessonStepPayloadService.MatchPairWrite("rizz", "charisma"),
                    new LessonStepPayloadService.MatchPairWrite("cap", "a lie"))));

    var evaluation =
        service.evaluate(
            step, objectMapper.createObjectNode().put("RIZZ", " charisma ").put("cap", "a lie"));

    assertThat(evaluation.correct()).isTrue();
    assertThat(evaluation.correctAnswerText()).isEqualTo("rizz = charisma; cap = a lie");
    assertThat(evaluation.evaluatedAnswer().path("pairs")).hasSize(2);
  }

  @Test
  void evaluateRejectsMcqWithoutValidAnswerKey() {
    var payload =
        objectMapper.createObjectNode().put("questionType", "MCQ").put("prompt", "Pick one");
    payload
        .putArray("choices")
        .addObject()
        .put("id", 1L)
        .put("text", "charisma")
        .put("orderIndex", 1);
    LessonStep step = questionStep(payload);

    assertThatThrownBy(() -> service.evaluate(step, JsonNodeFactory.instance.textNode("charisma")))
        .isInstanceOf(ResponseStatusException.class)
        .hasMessageContaining("question has no answer key");
  }

  @Test
  void evaluateReturnsCorrectShortAnswerResultAfterNormalization() {
    LessonStep step =
        questionStep(
            service.buildQuestionPayload(
                QuestionType.SHORT_ANSWER,
                "Say it",
                "explanation",
                null,
                null,
                List.of("no cap", "No Cap"),
                null));

    var evaluation = service.evaluate(step, JsonNodeFactory.instance.textNode(" NO CAP "));

    assertThat(evaluation.correct()).isTrue();
    assertThat(evaluation.correctAnswerText()).isEqualTo("no cap");
    assertThat(evaluation.evaluatedAnswer().path("acceptedAnswers")).hasSize(2);
  }

  @Test
  void shuffledRightsReturnsOnlyNonBlankRights() {
    var rights =
        service.shuffledRights(
            new LessonStepPayloadService.QuestionContent(
                QuestionType.MATCH,
                "prompt",
                null,
                List.of(),
                List.of(
                    new LessonStepPayloadService.MatchPairOption(1L, "rizz", "charisma", 1),
                    new LessonStepPayloadService.MatchPairOption(2L, "cap", " ", 2),
                    new LessonStepPayloadService.MatchPairOption(3L, "bet", null, 3)),
                List.of()));

    assertThat(rights).containsExactly("charisma");
  }

  @Test
  void sanitizePayloadForPlayRemovesAnswerKeyOnlyForQuestionSteps() {
    LessonStep questionStep =
        questionStep(
            service.buildQuestionPayload(
                QuestionType.MCQ,
                "What does rizz mean?",
                null,
                List.of("charisma", "food"),
                0,
                null,
                null));
    LessonStep teachStep =
        new LessonStep(
            new Lesson(
                new Unit("Unit", "unit", "desc", 1),
                "Lesson",
                "lesson",
                "desc",
                null,
                5,
                1,
                UUID.randomUUID()),
            2,
            StepType.TEACH);
    teachStep.setPayload(service.buildTeachPayload("rizz", "charisma", "he has rizz", "noun"));

    assertThat(service.sanitizePayloadForPlay(questionStep).has("answerKey")).isFalse();
    assertThat(service.sanitizePayloadForPlay(teachStep).path("title").asText()).isEqualTo("rizz");
  }

  @Test
  void readDialogueTextReturnsStoredText() {
    LessonStep dialogueStep =
        new LessonStep(
            new Lesson(
                new Unit("Unit", "unit", "desc", 1),
                "Lesson",
                "lesson",
                "desc",
                null,
                5,
                1,
                UUID.randomUUID()),
            1,
            StepType.DIALOGUE);
    dialogueStep.setPayload(service.buildDialoguePayload("a: no cap"));

    assertThat(service.readDialogueText(dialogueStep)).isEqualTo("a: no cap");
  }

  private LessonStep questionStep(com.fasterxml.jackson.databind.JsonNode payload) {
    Lesson lesson =
        new Lesson(
            new Unit("Unit", "unit", "desc", 1),
            "Lesson",
            "lesson",
            "desc",
            null,
            5,
            1,
            UUID.randomUUID());
    LessonStep step = new LessonStep(lesson, 1, StepType.QUESTION);
    ReflectionTestUtils.setField(step, "id", 101L);
    step.setPayload(payload);
    return step;
  }
}
