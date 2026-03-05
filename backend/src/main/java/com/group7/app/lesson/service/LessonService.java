package com.group7.app.lesson.service;

import com.group7.app.lesson.model.Choice;
import com.group7.app.lesson.model.Lesson;
import com.group7.app.lesson.model.LessonQuestion;
import com.group7.app.lesson.model.LessonStatus;
import com.group7.app.lesson.model.LessonStep;
import com.group7.app.lesson.model.QuestionClozeAnswer;
import com.group7.app.lesson.model.QuestionMatchPair;
import com.group7.app.lesson.model.QuestionType;
import com.group7.app.lesson.model.StepType;
import com.group7.app.lesson.model.Unit;
import com.group7.app.lesson.model.VocabItem;
import com.group7.app.lesson.repository.ChoiceRepository;
import com.group7.app.lesson.repository.LessonQuestionRepository;
import com.group7.app.lesson.repository.LessonRepository;
import com.group7.app.lesson.repository.LessonStepRepository;
import com.group7.app.lesson.repository.QuestionClozeAnswerRepository;
import com.group7.app.lesson.repository.QuestionMatchPairRepository;
import com.group7.app.lesson.repository.UnitRepository;
import com.group7.app.lesson.repository.VocabItemRepository;
import com.group7.app.user.Role;
import com.group7.app.user.User;
import jakarta.transaction.Transactional;
import java.time.Instant;
import java.util.ArrayList;
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
    private final LessonQuestionRepository lessonQuestionRepository;
    private final ChoiceRepository choiceRepository;
    private final QuestionClozeAnswerRepository questionClozeAnswerRepository;
    private final QuestionMatchPairRepository questionMatchPairRepository;

    public LessonService(
            UnitRepository unitRepository,
            LessonRepository lessonRepository,
            LessonStepRepository lessonStepRepository,
            VocabItemRepository vocabItemRepository,
            LessonQuestionRepository lessonQuestionRepository,
            ChoiceRepository choiceRepository,
            QuestionClozeAnswerRepository questionClozeAnswerRepository,
            QuestionMatchPairRepository questionMatchPairRepository) {
        this.unitRepository = unitRepository;
        this.lessonRepository = lessonRepository;
        this.lessonStepRepository = lessonStepRepository;
        this.vocabItemRepository = vocabItemRepository;
        this.lessonQuestionRepository = lessonQuestionRepository;
        this.choiceRepository = choiceRepository;
        this.questionClozeAnswerRepository = questionClozeAnswerRepository;
        this.questionMatchPairRepository = questionMatchPairRepository;
    }

    public List<Unit> listUnits() {
        return unitRepository.findAllByOrderByOrderIndexAsc();
    }

    public Lesson createLesson(User actor, LessonDraftInput input) {
        requireRole(actor, Role.CONTRIBUTOR, Role.ADMIN);
        Unit unit = unitRepository.findById(input.unitId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "unit not found"));

        Lesson lesson = new Lesson(unit, sanitize(input.title()), sanitize(input.description()), input.orderIndex(), actor.getId());
        lesson.setStatus(LessonStatus.DRAFT);
        return lessonRepository.save(lesson);
    }

    public Lesson patchLesson(User actor, Long lessonId, LessonPatchInput input) {
        Lesson lesson = requireLesson(lessonId);

        if (input.status() != null && input.status() != lesson.getStatus()) {
            applyStatusTransition(actor, lesson, input.status(), input.reviewComment());
        }

        if (input.unitId() != null || input.title() != null || input.description() != null || input.orderIndex() != null) {
            if (lesson.getStatus() == LessonStatus.APPROVED && !isAdminOrModerator(actor)) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "approved lessons can only be edited by moderators/admin");
            }

            requireOwnerOrAdmin(actor, lesson);

            if (input.unitId() != null) {
                Unit unit = unitRepository.findById(input.unitId())
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "unit not found"));
                lesson.setUnit(unit);
            }
            if (input.title() != null) {
                lesson.setTitle(sanitize(input.title()));
            }
            if (input.description() != null) {
                lesson.setDescription(sanitize(input.description()));
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

        LessonStep step = lessonStepRepository.findByIdAndLessonId(stepId, lessonId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "lesson step not found"));

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

        LessonStep step = lessonStepRepository.findByIdAndLessonId(stepId, lessonId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "lesson step not found"));
        lessonStepRepository.delete(step);
        normalizeStepOrder(lessonId);
    }

    public LessonQuestion getQuestionForStep(LessonStep step) {
        if (step.getQuestion() == null) {
            return null;
        }
        return step.getQuestion();
    }

    public List<Choice> getChoices(Long questionId) {
        return choiceRepository.findByQuestionIdOrderByOrderIndexAsc(questionId);
    }

    public List<QuestionClozeAnswer> getClozeAnswers(Long questionId) {
        return questionClozeAnswerRepository.findByQuestionIdOrderByOrderIndexAsc(questionId);
    }

    public List<QuestionMatchPair> getMatchPairs(Long questionId) {
        return questionMatchPairRepository.findByQuestionIdOrderByOrderIndexAsc(questionId);
    }

    public List<LessonStep> getQuestionSteps(Long lessonId) {
        return lessonStepRepository.findByLessonIdAndQuestionIsNotNullOrderByOrderIndexAsc(lessonId);
    }

    private void applyStatusTransition(User actor, Lesson lesson, LessonStatus targetStatus, String reviewComment) {
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
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "only moderators/admin can review lessons");
            }
            if (targetStatus == LessonStatus.REJECTED && isBlank(reviewComment)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "reviewComment is required when rejecting");
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

        throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "invalid status transition: " + current + " -> " + targetStatus);
    }

    private void applyStepPayload(LessonStep step, StepWriteInput input) {
        switch (input.stepType()) {
            case TEACH -> {
                if (input.vocabItemId() == null) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "vocabItemId is required for teach step");
                }
                VocabItem vocabItem = vocabItemRepository.findById(input.vocabItemId())
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "vocab item not found"));
                step.setVocabItem(vocabItem);
                step.setQuestion(null);
                step.setDialogueText(null);
            }
            case DIALOGUE -> {
                if (isBlank(input.dialogueText())) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "dialogueText is required for dialogue step");
                }
                step.setDialogueText(input.dialogueText().trim());
                step.setVocabItem(null);
                step.setQuestion(null);
            }
            case QUESTION -> {
                LessonQuestion question;
                if (input.questionId() != null) {
                    question = lessonQuestionRepository.findById(input.questionId())
                            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "question not found"));
                } else {
                    if (input.questionType() == null || isBlank(input.prompt())) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                                "questionType and prompt are required when questionId is not provided");
                    }
                    question = new LessonQuestion(input.questionType(), input.prompt().trim(), trimToNull(input.explanation()));
                    question = lessonQuestionRepository.save(question);
                    writeQuestionPayload(question, input);
                }
                step.setQuestion(question);
                step.setVocabItem(null);
                step.setDialogueText(null);
            }
        }
    }

    private void writeQuestionPayload(LessonQuestion question, StepWriteInput input) {
        if (question.getQuestionType() == QuestionType.MCQ) {
            if (input.options() == null || input.options().size() < 2 || input.correctOptionIndex() == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "mcq requires at least two options and correctOptionIndex");
            }
            if (input.correctOptionIndex() < 0 || input.correctOptionIndex() >= input.options().size()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "correctOptionIndex out of bounds");
            }
            List<Choice> choices = new ArrayList<>();
            for (int i = 0; i < input.options().size(); i++) {
                String text = sanitize(input.options().get(i));
                choices.add(new Choice(question, text, i == input.correctOptionIndex(), i + 1));
            }
            choiceRepository.saveAll(choices);
            return;
        }

        if (question.getQuestionType() == QuestionType.CLOZE || question.getQuestionType() == QuestionType.SHORT_ANSWER) {
            if (input.acceptedAnswers() == null || input.acceptedAnswers().isEmpty()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "acceptedAnswers is required for cloze/short answer");
            }
            List<QuestionClozeAnswer> answers = new ArrayList<>();
            for (int i = 0; i < input.acceptedAnswers().size(); i++) {
                answers.add(new QuestionClozeAnswer(question, sanitize(input.acceptedAnswers().get(i)), i + 1));
            }
            questionClozeAnswerRepository.saveAll(answers);
            return;
        }

        if (question.getQuestionType() == QuestionType.MATCH) {
            if (input.matchPairs() == null || input.matchPairs().isEmpty()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "matchPairs is required for match type");
            }
            List<QuestionMatchPair> pairs = new ArrayList<>();
            for (int i = 0; i < input.matchPairs().size(); i++) {
                MatchPairInput pair = input.matchPairs().get(i);
                pairs.add(new QuestionMatchPair(question, sanitize(pair.left()), sanitize(pair.right()), i + 1));
            }
            questionMatchPairRepository.saveAll(pairs);
        }
    }

    private void normalizeStepOrder(Long lessonId) {
        List<LessonStep> steps = lessonStepRepository.findByLessonIdOrderByOrderIndexAsc(lessonId).stream()
                .sorted(Comparator.comparing(LessonStep::getOrderIndex).thenComparing(LessonStep::getId))
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
        return lessonRepository.findById(lessonId)
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
        if (lesson.getStatus() != LessonStatus.DRAFT && lesson.getStatus() != LessonStatus.REJECTED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "steps can only be edited when lesson is in DRAFT or REJECTED");
        }
        requireOwnerOrAdmin(actor, lesson);
    }

    private void requireOwnerOrAdmin(User actor, Lesson lesson) {
        if (isAdminOrModerator(actor)) {
            return;
        }
        if (lesson.getCreatedBy() != null && lesson.getCreatedBy().equals(actor.getId())) {
            return;
        }
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "you do not have permission for this lesson");
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

    public record LessonDraftInput(Long unitId, String title, String description, Integer orderIndex) {
    }

    public record LessonPatchInput(
            Long unitId,
            String title,
            String description,
            Integer orderIndex,
            LessonStatus status,
            String reviewComment) {
    }

    public record MatchPairInput(String left, String right) {
    }

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
            String dialogueText) {
    }
}
