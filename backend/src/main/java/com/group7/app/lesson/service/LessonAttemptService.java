package com.group7.app.lesson.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.group7.app.lesson.model.Lesson;
import com.group7.app.lesson.model.LessonAttempt;
import com.group7.app.lesson.model.LessonAttemptResult;
import com.group7.app.lesson.model.LessonStatus;
import com.group7.app.lesson.model.LessonStep;
import com.group7.app.lesson.model.StepType;
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
import com.group7.app.user.User;
import jakarta.transaction.Transactional;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional
public class LessonAttemptService {

  private static final JsonNodeFactory JSON = JsonNodeFactory.instance;
  private static final String REVISE_EVENT_TYPE = "REVISE_ANSWERED";

  private final LessonRepository lessonRepository;
  private final LessonStepRepository lessonStepRepository;
  private final LessonStepPayloadService lessonStepPayloadService;
  private final LessonAttemptRepository lessonAttemptRepository;
  private final LessonAttemptResultRepository lessonAttemptResultRepository;
  private final UserLessonProgressRepository userLessonProgressRepository;
  private final UserStepEventRepository userStepEventRepository;
  private final UserVocabMemoryRepository userVocabMemoryRepository;
  private final VocabItemRepository vocabItemRepository;

  public LessonAttemptService(
      LessonRepository lessonRepository,
      LessonStepRepository lessonStepRepository,
      LessonStepPayloadService lessonStepPayloadService,
      LessonAttemptRepository lessonAttemptRepository,
      LessonAttemptResultRepository lessonAttemptResultRepository,
      UserLessonProgressRepository userLessonProgressRepository,
      UserStepEventRepository userStepEventRepository,
      UserVocabMemoryRepository userVocabMemoryRepository,
      VocabItemRepository vocabItemRepository) {
    this.lessonRepository = lessonRepository;
    this.lessonStepRepository = lessonStepRepository;
    this.lessonStepPayloadService = lessonStepPayloadService;
    this.lessonAttemptRepository = lessonAttemptRepository;
    this.lessonAttemptResultRepository = lessonAttemptResultRepository;
    this.userLessonProgressRepository = userLessonProgressRepository;
    this.userStepEventRepository = userStepEventRepository;
    this.userVocabMemoryRepository = userVocabMemoryRepository;
    this.vocabItemRepository = vocabItemRepository;
  }

  public AttemptSubmissionResult submitAttempt(
      User actor, Long lessonId, List<AnswerInput> answers) {
    Lesson lesson = requireApprovedLesson(lessonId);

    List<LessonStep> questionSteps =
        lessonStepRepository.findByLessonIdAndStepTypeOrderByOrderIndexAsc(
            lessonId, StepType.QUESTION);
    List<LessonStep> lessonSteps =
        lessonStepRepository.findByLessonIdOrderByOrderIndexAsc(lessonId);
    Map<Long, AnswerInput> answersByStep = new HashMap<>();
    for (AnswerInput answer : answers) {
      answersByStep.put(answer.stepId(), answer);
    }

    int correctCount = 0;
    List<ResultItem> resultItems = new ArrayList<>();
    for (LessonStep step : questionSteps) {
      AnswerInput input = answersByStep.get(step.getId());
      LessonStepPayloadService.Evaluation evaluation = evaluateAnswer(step, input);
      if (evaluation.correct()) {
        correctCount++;
      }
      resultItems.add(
          new ResultItem(
              step.getId(),
              evaluation.correct(),
              evaluation.correctAnswerText(),
              evaluation.explanation()));
    }

    int totalQuestions = questionSteps.size();
    int score = totalQuestions == 0 ? 0 : (int) Math.round((correctCount * 100.0) / totalQuestions);
    boolean passed = score >= 60;

    LessonAttempt attempt =
        lessonAttemptRepository.save(
            new LessonAttempt(actor.getId(), lesson, score, totalQuestions, correctCount, passed));

    List<LessonAttemptResult> attemptResults = new ArrayList<>();
    for (ResultItem resultItem : resultItems) {
      AnswerInput input = answersByStep.get(resultItem.stepId());
      LessonStep step =
          questionSteps.stream()
              .filter(s -> s.getId().equals(resultItem.stepId()))
              .findFirst()
              .orElseThrow();

      JsonNode submittedAnswer = input == null ? null : input.answer();
      LessonStepPayloadService.Evaluation evaluation = evaluateAnswer(step, input);
      attemptResults.add(
          new LessonAttemptResult(
              attempt,
              step,
              lessonId,
              resultItem.correct(),
              submittedAnswer,
              evaluation.evaluatedAnswer(),
              resultItem.explanation()));
    }
    lessonAttemptResultRepository.saveAll(attemptResults);

    LessonStep lastLessonStep =
        lessonSteps.isEmpty() ? null : lessonSteps.get(lessonSteps.size() - 1);
    upsertProgress(actor.getId(), lesson, lastLessonStep, score, passed);
    updateLessonVocabMemory(actor.getId(), lessonId, passed);

    return new AttemptSubmissionResult(
        attempt.getId(), score, totalQuestions, correctCount, passed, resultItems);
  }

  public AttemptSubmissionResult getAttempt(User actor, Long attemptId) {
    LessonAttempt attempt =
        lessonAttemptRepository
            .findByIdAndUserId(attemptId, actor.getId())
            .orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "attempt not found"));

    List<ResultItem> results =
        lessonAttemptResultRepository.findByAttemptIdOrderByIdAsc(attempt.getId()).stream()
            .map(
                result ->
                    new ResultItem(
                        result.getLessonStep().getId(),
                        result.isCorrect(),
                        renderEvaluatedAnswer(result.getEvaluatedAnswer()),
                        result.getExplanation()))
            .toList();

    return new AttemptSubmissionResult(
        attempt.getId(),
        attempt.getScore(),
        attempt.getTotalQuestions(),
        attempt.getCorrectCount(),
        attempt.isPassed(),
        results);
  }

  public List<ProgressItem> getProgress(User actor) {
    return userLessonProgressRepository.findByUserId(actor.getId()).stream()
        .map(this::toProgressItem)
        .toList();
  }

  public ReviseQueueResponse getReviseQueue(User actor, int limit) {
    int safeLimit = Math.max(1, Math.min(limit, 20));
    Instant now = Instant.now();
    List<LessonStep> approvedQuestionSteps =
        lessonStepRepository.findByStepTypeAndLessonStatusOrderByLessonOrderIndexAsc(
            StepType.QUESTION, LessonStatus.APPROVED);

    if (approvedQuestionSteps.isEmpty()) {
      return new ReviseQueueResponse(List.of(), 0);
    }

    Map<Long, ReviewState> reviewStateByStepId =
        buildReviewState(actor.getId(), approvedQuestionSteps);
    Set<Long> startedLessonIds = findStartedLessonIds(actor.getId());

    List<ReviseQueueItem> dueItems = new ArrayList<>();
    List<ReviseQueueItem> weakItems = new ArrayList<>();
    List<ReviseQueueItem> seenItems = new ArrayList<>();
    List<ReviseQueueItem> startedLessonFallbackItems = new ArrayList<>();
    List<ReviseQueueItem> approvedFallbackItems = new ArrayList<>();

    for (LessonStep step : approvedQuestionSteps) {
      ReviewState state = reviewStateByStepId.get(step.getId());
      if (state != null && state.seen) {
        ReviseQueueItem item = toReviseQueueItem(step, state, now);
        if (state.isDue(now)) {
          dueItems.add(item);
        } else if (state.isWeak()) {
          weakItems.add(item);
        } else {
          seenItems.add(item);
        }
        continue;
      }

      ReviseQueueItem fallbackItem =
          new ReviseQueueItem(
              step.getId(),
              step.getLesson().getId(),
              step.getLesson().getTitle(),
              "fallback",
              step);
      if (startedLessonIds.contains(step.getLesson().getId())) {
        startedLessonFallbackItems.add(fallbackItem);
      } else {
        approvedFallbackItems.add(fallbackItem);
      }
    }

    dueItems.sort(compareReviseItems(reviewStateByStepId, true));
    weakItems.sort(compareReviseItems(reviewStateByStepId, false));
    seenItems.sort(compareReviseItems(reviewStateByStepId, false));
    startedLessonFallbackItems.sort(compareFallbackItems(actor.getId()));
    approvedFallbackItems.sort(compareFallbackItems(actor.getId()));

    List<ReviseQueueItem> queue = new ArrayList<>();
    appendUntilLimit(queue, dueItems, safeLimit);
    appendUntilLimit(queue, weakItems, safeLimit);
    appendUntilLimit(queue, seenItems, safeLimit);
    appendUntilLimit(queue, startedLessonFallbackItems, safeLimit);
    appendUntilLimit(queue, approvedFallbackItems, safeLimit);

    return new ReviseQueueResponse(queue, dueItems.size());
  }

  public ReviseAttemptResult submitReviseAttempt(User actor, List<AnswerInput> answers) {
    if (answers.isEmpty()) {
      return new ReviseAttemptResult(0, 0, 0, List.of(), getReviseQueue(actor, 20).dueCount());
    }

    List<Long> stepIds = answers.stream().map(AnswerInput::stepId).distinct().toList();
    Map<Long, LessonStep> stepsById = new HashMap<>();
    for (LessonStep step : lessonStepRepository.findByIdInWithLesson(stepIds)) {
      stepsById.put(step.getId(), step);
    }

    List<ResultItem> results = new ArrayList<>();
    List<UserStepEvent> events = new ArrayList<>();
    int correctCount = 0;

    for (AnswerInput answer : answers) {
      LessonStep step = stepsById.get(answer.stepId());
      if (step == null || step.getStepType() != StepType.QUESTION) {
        throw new ResponseStatusException(HttpStatus.NOT_FOUND, "lesson step not found");
      }
      if (step.getLesson().getStatus() != LessonStatus.APPROVED) {
        throw new ResponseStatusException(
            HttpStatus.BAD_REQUEST, "only approved lessons can be accessed by learners");
      }

      LessonStepPayloadService.Evaluation evaluation = evaluateAnswer(step, answer);
      if (evaluation.correct()) {
        correctCount++;
      }

      results.add(
          new ResultItem(
              step.getId(),
              evaluation.correct(),
              evaluation.correctAnswerText(),
              evaluation.explanation()));
      events.add(
          new UserStepEvent(
              actor.getId(),
              step.getLesson(),
              step,
              null,
              REVISE_EVENT_TYPE,
              buildReviseEventPayload(answer.answer(), evaluation)));
    }

    userStepEventRepository.saveAll(events);

    int totalQuestions = answers.size();
    int score = totalQuestions == 0 ? 0 : (int) Math.round((correctCount * 100.0) / totalQuestions);
    int dueCount = getReviseQueue(actor, 20).dueCount();

    return new ReviseAttemptResult(score, totalQuestions, correctCount, results, dueCount);
  }

  public List<VocabMemoryItem> listDueVocabMemory(User actor, int limit, boolean dueOnly) {
    int safeLimit = Math.max(1, Math.min(limit, 50));
    Instant now = Instant.now();

    List<UserVocabMemory> memories;
    if (dueOnly) {
      memories =
          userVocabMemoryRepository.findByUserIdAndNextDueAtLessThanEqualOrderByNextDueAtAsc(
              actor.getId(), now, PageRequest.of(0, safeLimit));
    } else {
      memories =
          userVocabMemoryRepository.findByUserIdAndNextDueAtLessThanEqualOrderByNextDueAtAsc(
              actor.getId(), Instant.parse("9999-12-31T23:59:59Z"), PageRequest.of(0, safeLimit));
    }

    return memories.stream()
        .map(
            memory ->
                new VocabMemoryItem(
                    memory.getVocabItem().getId(),
                    memory.getVocabItem().getTerm(),
                    memory.getVocabItem().getDefinition(),
                    memory.getStrength(),
                    memory.getCorrectStreak(),
                    memory.getNextDueAt()))
        .toList();
  }

  public List<VocabMemoryItem> submitVocabMemoryAttempt(
      User actor, List<VocabMemoryAnswerInput> answers) {
    Instant now = Instant.now();

    for (VocabMemoryAnswerInput input : answers) {
      VocabItem vocabItem =
          vocabItemRepository
              .findById(input.vocabItemId())
              .orElseThrow(
                  () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "vocab item not found"));

      UserVocabMemory memory =
          userVocabMemoryRepository
              .findByUserIdAndVocabItemId(actor.getId(), vocabItem.getId())
              .orElseGet(() -> new UserVocabMemory(actor.getId(), vocabItem, now));

      updateMemory(memory, input.correct(), now);
      userVocabMemoryRepository.save(memory);
    }

    return listDueVocabMemory(actor, 20, true);
  }

  public ProgressItem updateProgressPosition(User actor, Long lessonId, Long lastStepId) {
    Lesson lesson = requireApprovedLesson(lessonId);
    LessonStep lastStep =
        lessonStepRepository
            .findByIdAndLessonId(lastStepId, lessonId)
            .orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "lesson step not found"));

    UserLessonProgress progress =
        userLessonProgressRepository
            .findByUserIdAndLessonId(actor.getId(), lesson.getId())
            .orElseGet(() -> new UserLessonProgress(actor.getId(), lesson));

    progress.setLastStep(lastStep);
    UserLessonProgress saved = userLessonProgressRepository.save(progress);
    return toProgressItem(saved);
  }

  private Map<Long, ReviewState> buildReviewState(UUID userId, List<LessonStep> approvedSteps) {
    Set<Long> approvedStepIds =
        approvedSteps.stream().map(LessonStep::getId).collect(java.util.stream.Collectors.toSet());
    Map<Long, ReviewState> reviewStateByStepId = new HashMap<>();

    for (LessonAttemptResult result :
        lessonAttemptResultRepository.findByAttemptUserIdOrderByCreatedAtAsc(userId)) {
      Long stepId = result.getLessonStep().getId();
      if (!approvedStepIds.contains(stepId)) {
        continue;
      }

      reviewStateByStepId
          .computeIfAbsent(stepId, ignored -> new ReviewState())
          .recordResult(result.isCorrect(), result.getCreatedAt());
    }

    for (UserStepEvent event :
        userStepEventRepository.findByUserIdAndEventTypeOrderByCreatedAtAsc(
            userId, REVISE_EVENT_TYPE)) {
      Long stepId = event.getLessonStep().getId();
      if (!approvedStepIds.contains(stepId)) {
        continue;
      }

      reviewStateByStepId
          .computeIfAbsent(stepId, ignored -> new ReviewState())
          .recordResult(event.getPayload().path("correct").asBoolean(false), event.getCreatedAt());
    }

    return reviewStateByStepId;
  }

  private Set<Long> findStartedLessonIds(UUID userId) {
    Set<Long> startedLessonIds = new HashSet<>();
    for (UserLessonProgress progress : userLessonProgressRepository.findByUserId(userId)) {
      if (progress.getAttemptCount() > 0
          || progress.getCompletedAt() != null
          || progress.getLastStep() != null) {
        startedLessonIds.add(progress.getLesson().getId());
      }
    }
    return startedLessonIds;
  }

  private ReviseQueueItem toReviseQueueItem(LessonStep step, ReviewState state, Instant now) {
    return new ReviseQueueItem(
        step.getId(),
        step.getLesson().getId(),
        step.getLesson().getTitle(),
        state.priorityReason(now),
        step);
  }

  private Comparator<ReviseQueueItem> compareReviseItems(
      Map<Long, ReviewState> reviewStateByStepId, boolean dueOnly) {
    return Comparator.comparing(
            (ReviseQueueItem item) ->
                reviewStateByStepId.getOrDefault(item.stepId(), new ReviewState()).nextDueAt,
            Comparator.nullsLast(Comparator.naturalOrder()))
        .thenComparing(
            (ReviseQueueItem item) ->
                reviewStateByStepId.getOrDefault(item.stepId(), new ReviewState()).timesWrong,
            Comparator.reverseOrder())
        .thenComparing(
            (ReviseQueueItem item) ->
                reviewStateByStepId.getOrDefault(item.stepId(), new ReviewState()).strength)
        .thenComparing(
            (ReviseQueueItem item) ->
                reviewStateByStepId.getOrDefault(item.stepId(), new ReviewState()).lastSeenAt,
            Comparator.nullsFirst(Comparator.naturalOrder()))
        .thenComparing(ReviseQueueItem::lessonTitle)
        .thenComparing(ReviseQueueItem::stepId);
  }

  private Comparator<ReviseQueueItem> compareFallbackItems(UUID userId) {
    return Comparator.comparingInt(
            (ReviseQueueItem item) -> stableFallbackOrder(userId, item.stepId()))
        .thenComparing(ReviseQueueItem::lessonTitle)
        .thenComparing(ReviseQueueItem::stepId);
  }

  private int stableFallbackOrder(UUID userId, Long stepId) {
    return Math.abs(Objects.hash(userId, stepId));
  }

  private void appendUntilLimit(
      List<ReviseQueueItem> queue, List<ReviseQueueItem> candidates, int limit) {
    if (queue.size() >= limit) {
      return;
    }

    Set<Long> existingStepIds =
        queue.stream().map(ReviseQueueItem::stepId).collect(java.util.stream.Collectors.toSet());
    for (ReviseQueueItem candidate : candidates) {
      if (queue.size() >= limit) {
        return;
      }
      if (existingStepIds.add(candidate.stepId())) {
        queue.add(candidate);
      }
    }
  }

  private ObjectNode buildReviseEventPayload(
      JsonNode submittedAnswer, LessonStepPayloadService.Evaluation evaluation) {
    ObjectNode payload = JSON.objectNode();
    payload.put("source", "revise");
    payload.put("correct", evaluation.correct());
    payload.set(
        "submittedAnswer", submittedAnswer == null ? JSON.nullNode() : submittedAnswer.deepCopy());
    payload.set(
        "evaluatedAnswer",
        evaluation.evaluatedAnswer() == null
            ? JSON.nullNode()
            : evaluation.evaluatedAnswer().deepCopy());
    if (evaluation.explanation() != null) {
      payload.put("explanation", evaluation.explanation());
    }
    if (evaluation.correctAnswerText() != null) {
      payload.put("correctAnswer", evaluation.correctAnswerText());
    }
    return payload;
  }

  private void upsertProgress(
      UUID userId, Lesson lesson, LessonStep lastLessonStep, int score, boolean passed) {
    UserLessonProgress progress =
        userLessonProgressRepository
            .findByUserIdAndLessonId(userId, lesson.getId())
            .orElseGet(() -> new UserLessonProgress(userId, lesson));

    progress.setAttemptCount(progress.getAttemptCount() + 1);
    progress.setBestScore(Math.max(progress.getBestScore(), score));
    progress.setLastAttemptAt(Instant.now());
    if (lastLessonStep != null) {
      progress.setLastStep(lastLessonStep);
    }
    if (passed && progress.getCompletedAt() == null) {
      progress.setCompletedAt(Instant.now());
    }

    userLessonProgressRepository.save(progress);
  }

  private Lesson requireApprovedLesson(Long lessonId) {
    Lesson lesson =
        lessonRepository
            .findById(lessonId)
            .orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "lesson not found"));
    if (lesson.getStatus() != LessonStatus.APPROVED) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "only approved lessons can be accessed by learners");
    }
    return lesson;
  }

  private ProgressItem toProgressItem(UserLessonProgress progress) {
    return new ProgressItem(
        progress.getLesson().getId(),
        progress.getLesson().getTitle(),
        progress.getBestScore(),
        progress.getAttemptCount(),
        progress.getCompletedAt(),
        progress.getLastStep() == null ? null : progress.getLastStep().getId());
  }

  private void updateLessonVocabMemory(UUID userId, Long lessonId, boolean passed) {
    Instant now = Instant.now();
    Set<Long> vocabIds = new HashSet<>();
    for (LessonStep step : lessonStepRepository.findByLessonIdOrderByOrderIndexAsc(lessonId)) {
      if (step.getStepType() == StepType.TEACH && step.getVocabItem() != null) {
        vocabIds.add(step.getVocabItem().getId());
      }
    }

    for (Long vocabId : vocabIds) {
      VocabItem vocabItem =
          vocabItemRepository
              .findById(vocabId)
              .orElseThrow(
                  () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "vocab item not found"));
      UserVocabMemory memory =
          userVocabMemoryRepository
              .findByUserIdAndVocabItemId(userId, vocabId)
              .orElseGet(() -> new UserVocabMemory(userId, vocabItem, now));
      updateMemory(memory, passed, now);
      userVocabMemoryRepository.save(memory);
    }
  }

  private void updateMemory(UserVocabMemory memory, boolean correct, Instant now) {
    if (correct) {
      int nextStrength = Math.min(10, memory.getStrength() + 1);
      memory.setStrength(nextStrength);
      memory.setCorrectStreak(memory.getCorrectStreak() + 1);
      int intervalDays = Math.min(60, (int) Math.pow(2, Math.max(0, nextStrength - 1)));
      memory.setNextDueAt(now.plus(intervalDays, ChronoUnit.DAYS));
    } else {
      memory.setStrength(Math.max(0, memory.getStrength() - 2));
      memory.setCorrectStreak(0);
      memory.setNextDueAt(now.plus(1, ChronoUnit.DAYS));
    }
    memory.setLastSeenAt(now);
  }

  private LessonStepPayloadService.Evaluation evaluateAnswer(LessonStep step, AnswerInput input) {
    JsonNode submitted = input == null ? null : input.answer();
    return lessonStepPayloadService.evaluate(step, submitted);
  }

  private String renderEvaluatedAnswer(JsonNode evaluatedAnswer) {
    if (evaluatedAnswer == null || evaluatedAnswer.isNull()) {
      return null;
    }
    JsonNode text = evaluatedAnswer.get("text");
    if (text != null && text.isTextual()) {
      return text.asText();
    }
    JsonNode answers = evaluatedAnswer.get("acceptedAnswers");
    if (answers != null && answers.isArray() && !answers.isEmpty() && answers.get(0).isTextual()) {
      return answers.get(0).asText();
    }
    JsonNode pairs = evaluatedAnswer.get("pairs");
    if (pairs != null && pairs.isArray()) {
      List<String> rendered = new ArrayList<>();
      for (JsonNode pair : pairs) {
        String left = pair.path("left").asText("");
        String right = pair.path("right").asText("");
        rendered.add(left + " = " + right);
      }
      return String.join("; ", rendered);
    }
    return evaluatedAnswer.toString();
  }

  public record AnswerInput(Long stepId, JsonNode answer) {}

  public record ResultItem(
      Long stepId, boolean correct, String correctAnswer, String explanation) {}

  public record AttemptSubmissionResult(
      Long attemptId,
      int score,
      int totalQuestions,
      int correctCount,
      boolean passed,
      List<ResultItem> results) {}

  public record ProgressItem(
      Long lessonId,
      String lessonTitle,
      int bestScore,
      int attempts,
      Instant completedAt,
      Long lastStepId) {}

  public record ReviseQueueItem(
      Long stepId, Long lessonId, String lessonTitle, String priorityReason, LessonStep step) {}

  public record ReviseQueueResponse(List<ReviseQueueItem> items, int dueCount) {}

  public record ReviseAttemptResult(
      int score, int totalQuestions, int correctCount, List<ResultItem> results, int dueCount) {}

  public record VocabMemoryItem(
      Long vocabItemId,
      String term,
      String definition,
      int strength,
      int correctStreak,
      Instant nextDueAt) {}

  public record VocabMemoryAnswerInput(Long vocabItemId, boolean correct) {}

  private static final class ReviewState {
    private int strength;
    private int correctStreak;
    private int timesWrong;
    private Instant lastSeenAt;
    private Instant nextDueAt;
    private boolean seen;

    private void recordResult(boolean correct, Instant seenAt) {
      seen = true;
      lastSeenAt = seenAt;
      if (correct) {
        strength = Math.min(10, strength + 1);
        correctStreak++;
        int intervalDays = Math.min(60, (int) Math.pow(2, Math.max(0, strength - 1)));
        nextDueAt = seenAt.plus(intervalDays, ChronoUnit.DAYS);
        return;
      }

      strength = Math.max(0, strength - 2);
      correctStreak = 0;
      timesWrong++;
      nextDueAt = seenAt.plus(4, ChronoUnit.HOURS);
    }

    private boolean isDue(Instant now) {
      return seen && nextDueAt != null && !nextDueAt.isAfter(now);
    }

    private boolean isWeak() {
      return timesWrong > 0 || strength <= 2;
    }

    private String priorityReason(Instant now) {
      if (timesWrong > 0 && (correctStreak == 0 || isDue(now))) {
        return "recent_mistake";
      }
      if (isDue(now)) {
        return "due";
      }
      if (isWeak()) {
        return "weak";
      }
      return "review";
    }
  }
}
