package com.group7.app.lesson;

import com.group7.app.lesson.model.Choice;
import com.group7.app.lesson.model.Lesson;
import com.group7.app.lesson.model.LessonQuestion;
import com.group7.app.lesson.model.LessonStatus;
import com.group7.app.lesson.model.LessonStep;
import com.group7.app.lesson.model.QuestionType;
import com.group7.app.lesson.model.StepType;
import com.group7.app.lesson.model.Unit;
import com.group7.app.lesson.model.VocabItem;
import com.group7.app.lesson.repository.ChoiceRepository;
import com.group7.app.lesson.repository.LessonQuestionRepository;
import com.group7.app.lesson.repository.LessonRepository;
import com.group7.app.lesson.repository.LessonStepRepository;
import com.group7.app.lesson.repository.UnitRepository;
import com.group7.app.lesson.repository.VocabItemRepository;
import java.time.Instant;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

@Component
public class LessonSeeder implements CommandLineRunner {

    private final UnitRepository unitRepository;
    private final LessonRepository lessonRepository;
    private final VocabItemRepository vocabItemRepository;
    private final LessonQuestionRepository lessonQuestionRepository;
    private final ChoiceRepository choiceRepository;
    private final LessonStepRepository lessonStepRepository;

    public LessonSeeder(
            UnitRepository unitRepository,
            LessonRepository lessonRepository,
            VocabItemRepository vocabItemRepository,
            LessonQuestionRepository lessonQuestionRepository,
            ChoiceRepository choiceRepository,
            LessonStepRepository lessonStepRepository) {
        this.unitRepository = unitRepository;
        this.lessonRepository = lessonRepository;
        this.vocabItemRepository = vocabItemRepository;
        this.lessonQuestionRepository = lessonQuestionRepository;
        this.choiceRepository = choiceRepository;
        this.lessonStepRepository = lessonStepRepository;
    }

    @Override
    public void run(String... args) {
        if (lessonRepository.count() > 0) {
            return;
        }

        Unit unit = unitRepository.save(new Unit("internet slang", 1));

        Lesson lesson = new Lesson(
                unit,
                "main character energy",
                "learn rizz, aura, and W through short teaching and quiz steps",
                1,
                null);
        lesson.setStatus(LessonStatus.APPROVED);
        lesson.setPublishedAt(Instant.now());
        lesson = lessonRepository.save(lesson);

        VocabItem rizz = vocabItemRepository.save(new VocabItem(
                "rizz",
                "charisma or flirting skill",
                "he has rizz in every convo",
                "noun"));
        VocabItem aura = vocabItemRepository.save(new VocabItem(
                "aura",
                "overall vibe or presence",
                "that move gave you +1000 aura",
                "noun"));

        LessonQuestion q1 = lessonQuestionRepository.save(new LessonQuestion(
                QuestionType.MCQ,
                "what does rizz mean?",
                "rizz means charisma, especially in social situations"));

        choiceRepository.save(new Choice(q1, "charisma or flirting ability", true, 1));
        choiceRepository.save(new Choice(q1, "being tired", false, 2));
        choiceRepository.save(new Choice(q1, "a kind of food", false, 3));
        choiceRepository.save(new Choice(q1, "a dance move", false, 4));

        LessonQuestion q2 = lessonQuestionRepository.save(new LessonQuestion(
                QuestionType.MCQ,
                "if someone has aura, they have...",
                "aura refers to social presence and vibe"));

        choiceRepository.save(new Choice(q2, "strong presence or vibe", true, 1));
        choiceRepository.save(new Choice(q2, "lots of money", false, 2));
        choiceRepository.save(new Choice(q2, "a halo", false, 3));
        choiceRepository.save(new Choice(q2, "perfect grades", false, 4));

        LessonStep teachRizz = new LessonStep(lesson, 1, StepType.TEACH);
        teachRizz.setVocabItem(rizz);
        lessonStepRepository.save(teachRizz);

        LessonStep quizRizz = new LessonStep(lesson, 2, StepType.QUESTION);
        quizRizz.setQuestion(q1);
        lessonStepRepository.save(quizRizz);

        LessonStep teachAura = new LessonStep(lesson, 3, StepType.TEACH);
        teachAura.setVocabItem(aura);
        lessonStepRepository.save(teachAura);

        LessonStep quizAura = new LessonStep(lesson, 4, StepType.QUESTION);
        quizAura.setQuestion(q2);
        lessonStepRepository.save(quizAura);
    }
}
