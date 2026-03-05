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
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

@Component
public class LessonSeeder implements CommandLineRunner {

    private static final List<LessonTemplate> DEFAULT_LESSONS = List.of(
            new LessonTemplate("The Basics", "Learn essential Gen Alpha terms"),
            new LessonTemplate("Slang Master", "Advanced Gen Alpha vocabulary"),
            new LessonTemplate("Internet Culture", "Master online Gen Alpha speak"),
            new LessonTemplate("Meme Legends", "Understand viral Gen Alpha memes"));

    private static final List<LessonPack> LESSON_PACKS = List.of(
            new LessonPack(
                    "rizz",
                    "charisma or flirting ability",
                    "he has rizz in every convo",
                    "What does \"rizz\" mean?",
                    "Rizz means charisma, especially in social situations.",
                    List.of("charisma or flirting ability", "being tired", "a kind of food", "a dance move"),
                    0),
            new LessonPack(
                    "aura",
                    "overall social vibe or presence",
                    "that move gave you +1000 aura",
                    "If someone has aura, they have...",
                    "Aura refers to presence and vibe.",
                    List.of("strong presence or vibe", "lots of money", "a halo", "perfect grades"),
                    0),
            new LessonPack(
                    "cap",
                    "a lie or false statement",
                    "that story is cap",
                    "What does \"cap\" mean?",
                    "Cap means a lie; no cap means truth.",
                    List.of("a lie", "a compliment", "a dance", "a game"),
                    0),
            new LessonPack(
                    "bussin",
                    "really good, often for food",
                    "this burger is bussin",
                    "If something is bussin, it is...",
                    "Bussin means really good.",
                    List.of("really good", "broken", "expensive", "boring"),
                    0));

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
        Unit defaultUnit = ensureDefaultUnit();

        List<Lesson> lessons = lessonRepository.findAllByOrderByOrderIndexAsc();
        if (lessons.isEmpty()) {
            lessons = createDefaultLessons(defaultUnit);
        }

        List<Lesson> normalized = lessons.stream()
                .sorted(Comparator
                        .comparing((Lesson lesson) -> lesson.getOrderIndex() == null ? Integer.MAX_VALUE : lesson.getOrderIndex())
                        .thenComparing(Lesson::getId))
                .toList();

        int index = 0;
        for (Lesson lesson : normalized) {
            index++;
            boolean changed = false;

            if (lesson.getUnit() == null) {
                lesson.setUnit(defaultUnit);
                changed = true;
            }

            if (lesson.getOrderIndex() == null || !lesson.getOrderIndex().equals(index)) {
                lesson.setOrderIndex(index);
                changed = true;
            }

            if (isBlank(lesson.getDescription())) {
                lesson.setDescription(defaultDescriptionForLesson(lesson.getTitle(), index));
                changed = true;
            }

            if (lesson.getStatus() != LessonStatus.APPROVED) {
                lesson.setStatus(LessonStatus.APPROVED);
                changed = true;
            }

            if (lesson.getPublishedAt() == null) {
                lesson.setPublishedAt(Instant.now());
                changed = true;
            }

            if (changed) {
                lessonRepository.save(lesson);
            }

            ensureStarterSteps(lesson, index - 1);
        }
    }

    private Unit ensureDefaultUnit() {
        return unitRepository.findAllByOrderByOrderIndexAsc().stream().findFirst()
                .orElseGet(() -> unitRepository.save(new Unit("internet slang", 1)));
    }

    private List<Lesson> createDefaultLessons(Unit unit) {
        int order = 1;
        List<Lesson> lessons = new ArrayList<>();
        for (LessonTemplate template : DEFAULT_LESSONS) {
            Lesson lesson = new Lesson(unit, template.title(), template.description(), order, null);
            lesson.setStatus(LessonStatus.APPROVED);
            lesson.setPublishedAt(Instant.now());
            lessons.add(lessonRepository.save(lesson));
            order++;
        }
        return lessons;
    }

    private void ensureStarterSteps(Lesson lesson, int seedIndex) {
        if (!lessonStepRepository.findByLessonIdOrderByOrderIndexAsc(lesson.getId()).isEmpty()) {
            return;
        }

        LessonPack pack = LESSON_PACKS.get(Math.floorMod(seedIndex, LESSON_PACKS.size()));
        VocabItem vocabItem = ensureVocab(pack);
        LessonQuestion question = createQuestion(pack);

        LessonStep teachStep = new LessonStep(lesson, 1, StepType.TEACH);
        teachStep.setVocabItem(vocabItem);
        lessonStepRepository.save(teachStep);

        LessonStep questionStep = new LessonStep(lesson, 2, StepType.QUESTION);
        questionStep.setQuestion(question);
        lessonStepRepository.save(questionStep);
    }

    private VocabItem ensureVocab(LessonPack pack) {
        Optional<VocabItem> existing = vocabItemRepository.findByTermIgnoreCase(pack.term());
        if (existing.isPresent()) {
            return existing.get();
        }

        return vocabItemRepository.save(new VocabItem(
                pack.term(),
                pack.definition(),
                pack.example(),
                "noun"));
    }

    private LessonQuestion createQuestion(LessonPack pack) {
        LessonQuestion question = lessonQuestionRepository.save(new LessonQuestion(
                QuestionType.MCQ,
                pack.prompt(),
                pack.explanation()));

        int order = 1;
        for (String option : pack.options()) {
            choiceRepository.save(new Choice(question, option, order - 1 == pack.correctIndex(), order));
            order++;
        }

        return question;
    }

    private static boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    private static String defaultDescriptionForLesson(String title, int index) {
        if (title == null) {
            return "learn gen alpha terms through short teach-and-quiz steps";
        }

        String normalized = title.trim().toLowerCase(Locale.ROOT);
        Map<String, String> known = Map.of(
                "intro to gen-alpha culture", "learn the core ideas behind gen alpha culture",
                "gen-alpha lingo", "pick up the slang terms used online and in chats",
                "tiktok trends explained", "understand trend references and social context",
                "the basics", "learn essential gen alpha terms",
                "slang master", "advanced gen alpha vocabulary",
                "internet culture", "master online gen alpha speak",
                "meme legends", "understand viral gen alpha memes");

        if (known.containsKey(normalized)) {
            return known.get(normalized);
        }

        return "lesson " + index + ": short teach-and-quiz flow";
    }

    private record LessonTemplate(String title, String description) {
    }

    private record LessonPack(
            String term,
            String definition,
            String example,
            String prompt,
            String explanation,
            List<String> options,
            int correctIndex) {
    }
}
