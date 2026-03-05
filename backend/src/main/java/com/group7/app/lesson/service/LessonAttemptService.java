package com.group7.app.lesson.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.group7.app.lesson.model.Choice;
import com.group7.app.lesson.model.Lesson;
import com.group7.app.lesson.model.LessonAttempt;
import com.group7.app.lesson.model.LessonAttemptResult;
import com.group7.app.lesson.model.LessonQuestion;
import com.group7.app.lesson.model.LessonStatus;
import com.group7.app.lesson.model.LessonStep;
import com.group7.app.lesson.model.QuestionClozeAnswer;
import com.group7.app.lesson.model.QuestionMatchPair;
import com.group7.app.lesson.model.QuestionType;
import com.group7.app.lesson.model.StepType;
import com.group7.app.lesson.model.UserLessonProgress;
import com.group7.app.lesson.model.UserStepEvent;
import com.group7.app.lesson.model.UserVocabMemory;
import com.group7.app.lesson.model.VocabItem;
import com.group7.app.lesson.repository.ChoiceRepository;
import com.group7.app.lesson.repository.LessonAttemptRepository;
import com.group7.app.lesson.repository.LessonAttemptResultRepository;
import com.group7.app.lesson.repository.LessonRepository;
import com.group7.app.lesson.repository.LessonStepRepository;
import com.group7.app.lesson.repository.QuestionClozeAnswerRepository;
import com.group7.app.lesson.repository.QuestionMatchPairRepository;
import com.group7.app.lesson.repository.UserLessonProgressRepository;
import com.group7.app.lesson.repository.UserStepEventRepository;
import com.group7.app.lesson.repository.UserVocabMemoryRepository;
import com.group7.app.lesson.repository.VocabItemRepository;
import com.group7.app.user.User;
import jakarta.transaction.Transactional;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional
public class LessonAttemptService {

    private final LessonRepository lessonRepository;
    private final LessonStepRepository lessonStepRepository;
    private final ChoiceRepository choiceRepository;
    private final QuestionClozeAnswerRepository questionClozeAnswerRepository;
    private final QuestionMatchPairRepository questionMatchPairRepository;
    private final LessonAttemptRepository lessonAttemptRepository;
    private final LessonAttemptResultRepository lessonAttemptResultRepository;
    private final UserLessonProgressRepository userLessonProgressRepository;
    private final UserStepEventRepository userStepEventRepository;
    private final UserVocabMemoryRepository userVocabMemoryRepository;
    private final VocabItemRepository vocabItemRepository;
    private final ObjectMapper objectMapper;

    public LessonAttemptService(
            LessonRepository lessonRepository,
            LessonStepRepository lessonStepRepository,
            ChoiceRepository choiceRepository,
            QuestionClozeAnswerRepository questionClozeAnswerRepository,
            QuestionMatchPairRepository questionMatchPairRepository,
            LessonAttemptRepository lessonAttemptRepository,
            LessonAttemptResultRepository lessonAttemptResultRepository,
            UserLessonProgressRepository userLessonProgressRepository,
            UserStepEventRepository userStepEventRepository,
            UserVocabMemoryRepository userVocabMemoryRepository,
            VocabItemRepository vocabItemRepository,
            ObjectMapper objectMapper) {
        this.lessonRepository = lessonRepository;
        this.lessonStepRepository = lessonStepRepository;
        this.choiceRepository = choiceRepository;
        this.questionClozeAnswerRepository = questionClozeAnswerRepository;
        this.questionMatchPairRepository = questionMatchPairRepository;
        this.lessonAttemptRepository = lessonAttemptRepository;
        this.lessonAttemptResultRepository = lessonAttemptResultRepository;
        this.userLessonProgressRepository = userLessonProgressRepository;
        this.userStepEventRepository = userStepEventRepository;
        this.userVocabMemoryRepository = userVocabMemoryRepository;
        this.vocabItemRepository = vocabItemRepository;
        this.objectMapper = objectMapper;
    }

    public AttemptSubmissionResult submitAttempt(User actor, Long lessonId, List<AnswerInput> answers) {
        Lesson lesson = lessonRepository.findById(lessonId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "lesson not found"));

        if (lesson.getStatus() != LessonStatus.APPROVED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "only approved lessons can be attempted");
        }

        List<LessonStep> questionSteps = lessonStepRepository.findByLessonIdAndQuestionIsNotNullOrderByOrderIndexAsc(lessonId);
        Map<Long, AnswerInput> answersByStep = new HashMap<>();
        for (AnswerInput answer : answers) {
            answersByStep.put(answer.stepId(), answer);
        }

        int correctCount = 0;
        List<ResultItem> resultItems = new ArrayList<>();
        for (LessonStep step : questionSteps) {
            AnswerInput input = answersByStep.get(step.getId());
            Evaluation evaluation = evaluateAnswer(step, input);
            if (evaluation.correct()) {
                correctCount++;
            }
            resultItems.add(new ResultItem(
                    step.getId(),
                    evaluation.correct(),
                    evaluation.correctAnswer(),
                    evaluation.explanation()));
        }

        int totalQuestions = questionSteps.size();
        int score = totalQuestions == 0 ? 0 : (int) Math.round((correctCount * 100.0) / totalQuestions);
        boolean passed = score >= 60;

        LessonAttempt attempt = lessonAttemptRepository.save(
                new LessonAttempt(actor.getId(), lesson, score, totalQuestions, correctCount, passed));

        List<LessonAttemptResult> attemptResults = new ArrayList<>();
        List<UserStepEvent> userEvents = new ArrayList<>();
        for (ResultItem resultItem : resultItems) {
            AnswerInput input = answersByStep.get(resultItem.stepId());
            LessonStep step = questionSteps.stream()
                    .filter(s -> s.getId().equals(resultItem.stepId()))
                    .findFirst()
                    .orElseThrow();

            String submittedAnswer = input == null ? null : asResponseJson(input.answer());
            attemptResults.add(new LessonAttemptResult(
                    attempt,
                    step,
                    resultItem.correct(),
                    submittedAnswer,
                    resultItem.correctAnswer(),
                    resultItem.explanation()));
            userEvents.add(new UserStepEvent(
                    actor.getId(),
                    step,
                    submittedAnswer == null ? "{}" : submittedAnswer,
                    resultItem.correct()));
        }
        lessonAttemptResultRepository.saveAll(attemptResults);
        userStepEventRepository.saveAll(userEvents);

        upsertProgress(actor.getId(), lesson, questionSteps, score, passed);
        updateLessonVocabMemory(actor.getId(), lessonId, passed);

        return new AttemptSubmissionResult(attempt.getId(), score, totalQuestions, correctCount, passed, resultItems);
    }

    public AttemptSubmissionResult getAttempt(User actor, Long attemptId) {
        LessonAttempt attempt = lessonAttemptRepository.findByIdAndUserId(attemptId, actor.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "attempt not found"));

        List<ResultItem> results = lessonAttemptResultRepository.findByAttemptIdOrderByIdAsc(attempt.getId()).stream()
                .map(result -> new ResultItem(
                        result.getLessonStep().getId(),
                        result.isCorrect(),
                        result.getCorrectAnswer(),
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
                .map(progress -> new ProgressItem(
                        progress.getLesson().getId(),
                        progress.getLesson().getTitle(),
                        progress.getBestScore(),
                        progress.getAttemptCount(),
                        progress.getCompletedAt()))
                .toList();
    }

    public List<VocabMemoryItem> listDueVocabMemory(User actor, int limit, boolean dueOnly) {
        int safeLimit = Math.max(1, Math.min(limit, 50));
        Instant now = Instant.now();

        List<UserVocabMemory> memories;
        if (dueOnly) {
            memories = userVocabMemoryRepository.findByUserIdAndNextDueAtLessThanEqualOrderByNextDueAtAsc(
                    actor.getId(),
                    now,
                    PageRequest.of(0, safeLimit));
        } else {
            memories = userVocabMemoryRepository.findByUserIdAndNextDueAtLessThanEqualOrderByNextDueAtAsc(
                    actor.getId(),
                    Instant.ofEpochSecond(Long.MAX_VALUE),
                    PageRequest.of(0, safeLimit));
        }

        return memories.stream()
                .map(memory -> new VocabMemoryItem(
                        memory.getVocabItem().getId(),
                        memory.getVocabItem().getTerm(),
                        memory.getVocabItem().getDefinition(),
                        memory.getStrength(),
                        memory.getCorrectStreak(),
                        memory.getNextDueAt()))
                .toList();
    }

    public List<VocabMemoryItem> submitVocabMemoryAttempt(User actor, List<VocabMemoryAnswerInput> answers) {
        Instant now = Instant.now();

        for (VocabMemoryAnswerInput input : answers) {
            VocabItem vocabItem = vocabItemRepository.findById(input.vocabItemId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "vocab item not found"));

            UserVocabMemory memory = userVocabMemoryRepository
                    .findByUserIdAndVocabItemId(actor.getId(), vocabItem.getId())
                    .orElseGet(() -> new UserVocabMemory(actor.getId(), vocabItem, now));

            updateMemory(memory, input.correct(), now);
            userVocabMemoryRepository.save(memory);
        }

        return listDueVocabMemory(actor, 20, true);
    }

    private void upsertProgress(
            java.util.UUID userId,
            Lesson lesson,
            List<LessonStep> questionSteps,
            int score,
            boolean passed) {
        UserLessonProgress progress = userLessonProgressRepository
                .findByUserIdAndLessonId(userId, lesson.getId())
                .orElseGet(() -> new UserLessonProgress(userId, lesson));

        progress.setAttemptCount(progress.getAttemptCount() + 1);
        progress.setBestScore(Math.max(progress.getBestScore(), score));
        if (!questionSteps.isEmpty()) {
            progress.setLastStep(questionSteps.get(questionSteps.size() - 1));
        }
        if (passed && progress.getCompletedAt() == null) {
            progress.setCompletedAt(Instant.now());
        }

        userLessonProgressRepository.save(progress);
    }

    private void updateLessonVocabMemory(java.util.UUID userId, Long lessonId, boolean passed) {
        Instant now = Instant.now();
        Set<Long> vocabIds = new HashSet<>();
        for (LessonStep step : lessonStepRepository.findByLessonIdOrderByOrderIndexAsc(lessonId)) {
            if (step.getStepType() == StepType.TEACH && step.getVocabItem() != null) {
                vocabIds.add(step.getVocabItem().getId());
            }
        }

        for (Long vocabId : vocabIds) {
            VocabItem vocabItem = vocabItemRepository.findById(vocabId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "vocab item not found"));
            UserVocabMemory memory = userVocabMemoryRepository
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

    private Evaluation evaluateAnswer(LessonStep step, AnswerInput input) {
        LessonQuestion question = step.getQuestion();
        if (question == null) {
            return new Evaluation(false, null, null);
        }

        JsonNode submitted = input == null ? null : input.answer();
        QuestionType type = question.getQuestionType();

        if (type == QuestionType.MCQ) {
            List<Choice> choices = choiceRepository.findByQuestionIdOrderByOrderIndexAsc(question.getId());
            Choice correctChoice = choices.stream()
                    .filter(Choice::isCorrect)
                    .findFirst()
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "question has no correct choice"));
            boolean correct = normalize(extractStringAnswer(submitted)).equals(normalize(correctChoice.getText()));
            return new Evaluation(correct, correctChoice.getText(), question.getExplanation());
        }

        if (type == QuestionType.CLOZE || type == QuestionType.SHORT_ANSWER) {
            List<QuestionClozeAnswer> acceptedAnswers =
                    questionClozeAnswerRepository.findByQuestionIdOrderByOrderIndexAsc(question.getId());
            String normalizedSubmitted = normalize(extractStringAnswer(submitted));
            boolean correct = acceptedAnswers.stream()
                    .anyMatch(answer -> normalize(answer.getAnswerText()).equals(normalizedSubmitted));
            String expected = acceptedAnswers.stream().map(QuestionClozeAnswer::getAnswerText).findFirst().orElse("");
            return new Evaluation(correct, expected, question.getExplanation());
        }

        if (type == QuestionType.MATCH) {
            List<QuestionMatchPair> expectedPairs =
                    questionMatchPairRepository.findByQuestionIdOrderByOrderIndexAsc(question.getId());
            Map<String, String> expectedMap = new HashMap<>();
            for (QuestionMatchPair pair : expectedPairs) {
                expectedMap.put(normalize(pair.getLeftText()), normalize(pair.getRightText()));
            }

            Map<String, String> submittedMap = parseMatchAnswer(submitted);
            boolean correct = expectedMap.equals(submittedMap);
            String expected = expectedPairs.stream()
                    .map(pair -> pair.getLeftText() + " = " + pair.getRightText())
                    .reduce((a, b) -> a + "; " + b)
                    .orElse("");
            return new Evaluation(correct, expected, question.getExplanation());
        }

        return new Evaluation(false, null, question.getExplanation());
    }

    private Map<String, String> parseMatchAnswer(JsonNode raw) {
        if (raw == null || !raw.isObject()) {
            return Map.of();
        }

        Map<String, String> normalized = new HashMap<>();
        raw.fields().forEachRemaining(entry -> {
            if (entry.getValue().isTextual()) {
                normalized.put(normalize(entry.getKey()), normalize(entry.getValue().asText()));
            }
        });
        return normalized;
    }

    private String extractStringAnswer(JsonNode answer) {
        if (answer == null || answer.isNull()) {
            return null;
        }

        if (answer.isTextual()) {
            return answer.asText();
        }

        if (answer.isObject()) {
            JsonNode nestedAnswer = answer.get("answer");
            if (nestedAnswer != null && nestedAnswer.isTextual()) {
                return nestedAnswer.asText();
            }
        }

        return answer.toString();
    }

    private String asResponseJson(JsonNode answer) {
        if (answer == null || answer.isNull()) {
            return "{}";
        }
        try {
            return objectMapper.writeValueAsString(answer);
        } catch (JsonProcessingException e) {
            return "{}";
        }
    }

    private String normalize(String value) {
        if (value == null) {
            return "";
        }
        return value.trim().toLowerCase();
    }

    private record Evaluation(boolean correct, String correctAnswer, String explanation) {
    }

    public record AnswerInput(Long stepId, JsonNode answer) {
    }

    public record ResultItem(Long stepId, boolean correct, String correctAnswer, String explanation) {
    }

    public record AttemptSubmissionResult(
            Long attemptId,
            int score,
            int totalQuestions,
            int correctCount,
            boolean passed,
            List<ResultItem> results) {
    }

    public record ProgressItem(Long lessonId, String lessonTitle, int bestScore, int attempts, Instant completedAt) {
    }

    public record VocabMemoryItem(
            Long vocabItemId,
            String term,
            String definition,
            int strength,
            int correctStreak,
            Instant nextDueAt) {
    }

    public record VocabMemoryAnswerInput(Long vocabItemId, boolean correct) {
    }
}
