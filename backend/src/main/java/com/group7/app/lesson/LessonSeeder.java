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
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

@Component
public class LessonSeeder implements CommandLineRunner {

    private static final List<LessonSeed> TARGET_LESSONS = List.of(
            new LessonSeed(
                    "The Basics",
                    "Learn essential Gen Alpha terms",
                    List.of(
                            new QuestionSeed(
                                    "rizz",
                                    "charisma or flirting ability",
                                    "He's got rizz.",
                                    "What does \"rizz\" mean?",
                                    List.of("Charisma or flirting ability", "Being tired", "A type of food", "Running fast"),
                                    0,
                                    "Rizz means charisma, especially in social situations."),
                            new QuestionSeed(
                                    "bussin",
                                    "really good, usually for food",
                                    "This pizza is bussin.",
                                    "If something is \"bussin\", it is...",
                                    List.of("Really good", "Broken", "Expensive", "Boring"),
                                    0,
                                    "Bussin means something is really good."),
                            new QuestionSeed(
                                    "cap",
                                    "a lie",
                                    "That's cap.",
                                    "What does \"cap\" mean?",
                                    List.of("A lie", "A hat", "The truth", "Money"),
                                    0,
                                    "Cap means a lie. No cap means truth."),
                            new QuestionSeed(
                                    "slay",
                                    "to do very well",
                                    "You slayed that presentation.",
                                    "When someone says you \"slay\", they mean you...",
                                    List.of("Did something really well", "Are being mean", "Need to sleep", "Are confused"),
                                    0,
                                    "Slay means doing something impressively well."),
                            new QuestionSeed(
                                    "mid",
                                    "average or mediocre",
                                    "That movie was mid.",
                                    "If something is \"mid\", it is...",
                                    List.of("Average or mediocre", "The best", "In the middle of the room", "Very expensive"),
                                    0,
                                    "Mid means average and not impressive."))),
            new LessonSeed(
                    "Slang Master",
                    "Advanced Gen Alpha vocabulary",
                    List.of(
                            new QuestionSeed(
                                    "gyat",
                                    "an exclamation of surprise or admiration",
                                    "Gyat, that was wild.",
                                    "What does \"gyat\" express?",
                                    List.of("Surprise or admiration", "Anger", "Hunger", "Confusion"),
                                    0,
                                    "Gyat is usually a surprise reaction."),
                            new QuestionSeed(
                                    "aura",
                                    "social presence or vibe",
                                    "That move gave you aura points.",
                                    "Someone with \"aura\" has...",
                                    List.of("A strong presence or vibe", "A halo", "Bad breath", "Lots of money"),
                                    0,
                                    "Aura refers to personal vibe and presence."),
                            new QuestionSeed(
                                    "fanum tax",
                                    "taking some of someone else's food",
                                    "He took a fanum tax from my fries.",
                                    "What is \"fanum tax\"?",
                                    List.of("Taking someone's food", "A type of tax", "A dance move", "Being late"),
                                    0,
                                    "Fanum tax is meme slang for food stealing."),
                            new QuestionSeed(
                                    "delulu",
                                    "delusional in a playful way",
                                    "I'm delulu about this ship.",
                                    "If you're \"delulu\", you are...",
                                    List.of("Delusional", "Delicious", "Delayed", "Deleted"),
                                    0,
                                    "Delulu is short for delusional."),
                            new QuestionSeed(
                                    "sigma",
                                    "independent and self-reliant",
                                    "He's on sigma mode.",
                                    "A \"sigma\" is someone who is...",
                                    List.of("Independent and self-reliant", "Always sleeping", "Very loud", "Afraid of everything"),
                                    0,
                                    "Sigma is meme slang for an independent person."))),
            new LessonSeed(
                    "Internet Culture",
                    "Master online Gen Alpha speak",
                    List.of(
                            new QuestionSeed(
                                    "ratio",
                                    "when a reply outperforms the original post",
                                    "That post got ratioed.",
                                    "What does it mean to \"ratio\" someone?",
                                    List.of("Your reply gets more likes than their post", "To measure something", "To block them", "To follow them"),
                                    0,
                                    "Ratio means the reply got more engagement than the original post."),
                            new QuestionSeed(
                                    "stan",
                                    "to be a devoted fan",
                                    "I stan that creator.",
                                    "If you \"stan\" someone, you...",
                                    List.of("Are a devoted fan", "Dislike them", "Stand near them", "Ignore them"),
                                    0,
                                    "Stan means being a strong supporter/fan."),
                            new QuestionSeed(
                                    "sus",
                                    "suspicious",
                                    "That sounds sus.",
                                    "Something \"sus\" is...",
                                    List.of("Suspicious", "Super", "Sustainable", "Successful"),
                                    0,
                                    "Sus is short for suspicious."),
                            new QuestionSeed(
                                    "lowkey",
                                    "subtly or somewhat",
                                    "I lowkey like this song.",
                                    "Saying something is \"lowkey\" means...",
                                    List.of("Subtly or somewhat", "Very loudly", "Not at all", "Extremely"),
                                    0,
                                    "Lowkey means mild, subtle, or somewhat."),
                            new QuestionSeed(
                                    "based",
                                    "authentic and confident in your stance",
                                    "That's a based take.",
                                    "If someone is \"based\", they are...",
                                    List.of("Authentic and admirable", "Basic", "In a basement", "Confused"),
                                    0,
                                    "Based means unapologetically authentic in context."))),
            new LessonSeed(
                    "Meme Legends",
                    "Understand viral Gen Alpha memes",
                    List.of(
                            new QuestionSeed(
                                    "skibidi",
                                    "a meme reference from Skibidi Toilet",
                                    "That is skibidi-level chaos.",
                                    "What does \"skibidi\" refer to?",
                                    List.of("A viral meme series", "A dance", "A food", "A place"),
                                    0,
                                    "Skibidi is a meme-series reference used as an intensifier."),
                            new QuestionSeed(
                                    "ohio",
                                    "weird or bizarre",
                                    "Only in Ohio.",
                                    "If something is \"Ohio\", it is...",
                                    List.of("Weird or bizarre", "From Ohio", "Perfect", "Fast"),
                                    0,
                                    "Ohio meme slang implies strange or absurd behavior."),
                            new QuestionSeed(
                                    "vibe check",
                                    "a quick mood/energy check",
                                    "Just doing a vibe check.",
                                    "What is a \"vibe check\"?",
                                    List.of("Assessing someone's mood or energy", "A health exam", "A test", "A video game"),
                                    0,
                                    "Vibe check means checking mood, energy, or social tone."),
                            new QuestionSeed(
                                    "era",
                                    "a current personal phase",
                                    "I'm in my study era.",
                                    "When you're in your \"___ era\", you're...",
                                    List.of("Going through a specific phase", "In a different time period", "Aging backwards", "Era means error"),
                                    0,
                                    "An era is a phase/vibe someone is currently in."),
                            new QuestionSeed(
                                    "ghosting",
                                    "suddenly stopping communication",
                                    "They ghosted me after one chat.",
                                    "What does \"ghosting\" mean?",
                                    List.of("Suddenly stopping communication", "Seeing ghosts", "Being invisible", "Playing a game"),
                                    0,
                                    "Ghosting means cutting off communication without explanation."))),
            new LessonSeed(
                    "Social Reactions",
                    "Read tone and social signals in fast chats",
                    List.of(
                            new QuestionSeed(
                                    "no cap",
                                    "for real / no lie",
                                    "No cap, that was great.",
                                    "When someone says \"no cap\", they mean...",
                                    List.of("They're being honest", "They're joking", "They're angry", "They're leaving"),
                                    0,
                                    "No cap means no lie, for real."),
                            new QuestionSeed(
                                    "cringe",
                                    "awkward in a bad way",
                                    "That comment was cringe.",
                                    "If something is \"cringe\", it is...",
                                    List.of("Awkward or embarrassing", "Perfect", "Expensive", "Fast"),
                                    0,
                                    "Cringe describes secondhand embarrassment."),
                            new QuestionSeed(
                                    "cooked",
                                    "in trouble / done for",
                                    "After that test, I'm cooked.",
                                    "If you're \"cooked\", you're...",
                                    List.of("In trouble", "Hungry", "Winning", "Relaxed"),
                                    0,
                                    "Cooked means you're done for in that situation."),
                            new QuestionSeed(
                                    "W",
                                    "a win",
                                    "Big W for the team.",
                                    "A \"W\" means...",
                                    List.of("A win", "A warning", "A website", "A wave"),
                                    0,
                                    "W is shorthand for a win."),
                            new QuestionSeed(
                                    "L",
                                    "a loss",
                                    "Taking an L happens.",
                                    "Taking an \"L\" means...",
                                    List.of("Taking a loss", "Getting lucky", "Learning a language", "Leaving early"),
                                    0,
                                    "L is shorthand for a loss."))),
            new LessonSeed(
                    "Messaging Moves",
                    "Handle DMs and group-chat etiquette",
                    List.of(
                            new QuestionSeed(
                                    "left on read",
                                    "message seen but not answered",
                                    "I got left on read.",
                                    "If you're \"left on read\", your message was...",
                                    List.of("Seen but not replied to", "Deleted", "Never delivered", "Forwarded"),
                                    0,
                                    "Left on read means the recipient saw it but didn't respond."),
                            new QuestionSeed(
                                    "hard launch",
                                    "publicly revealing a relationship",
                                    "They hard launched on Instagram.",
                                    "A \"hard launch\" usually means...",
                                    List.of("A clear public reveal", "A private message", "Deleting an account", "Taking a break"),
                                    0,
                                    "Hard launch is an explicit public reveal."),
                            new QuestionSeed(
                                    "soft launch",
                                    "hinting without full reveal",
                                    "They soft launched with a hand pic.",
                                    "A \"soft launch\" is...",
                                    List.of("A subtle hint", "A direct reveal", "A product update", "A game start"),
                                    0,
                                    "Soft launch means hinting without explicit confirmation."),
                            new QuestionSeed(
                                    "lurking",
                                    "watching without posting",
                                    "I was just lurking in chat.",
                                    "If someone is \"lurking\", they are...",
                                    List.of("Reading without posting", "Spamming messages", "Leaving the app", "Recording audio"),
                                    0,
                                    "Lurking means observing quietly."),
                            new QuestionSeed(
                                    "touch grass",
                                    "go offline and reset perspective",
                                    "You need to touch grass.",
                                    "\"Touch grass\" usually means...",
                                    List.of("Go outside / get offline", "Play sports online", "Start gardening content", "Win immediately"),
                                    0,
                                    "Touch grass is meme advice to step away from online intensity."))));

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
        List<Lesson> existingLessons = lessonRepository.findAllByOrderByOrderIndexAsc();

        for (Lesson lesson : existingLessons) {
            lesson.setOrderIndex((lesson.getOrderIndex() == null ? 0 : lesson.getOrderIndex()) + 1000);
            if (lesson.getUnit() == null) {
                lesson.setUnit(defaultUnit);
            }
            lessonRepository.save(lesson);
        }

        Map<String, Lesson> byTitle = new HashMap<>();
        for (Lesson lesson : lessonRepository.findAllByOrderByOrderIndexAsc()) {
            byTitle.put(normalizeTitle(lesson.getTitle()), lesson);
        }

        List<Lesson> targetLessonEntities = new ArrayList<>();
        for (LessonSeed seed : TARGET_LESSONS) {
            String key = normalizeTitle(seed.title());
            Lesson lesson = byTitle.get(key);
            if (lesson == null) {
                lesson = new Lesson(defaultUnit, seed.title(), seed.description(), 10_000, null);
            }

            lesson.setUnit(defaultUnit);
            lesson.setTitle(seed.title());
            lesson.setDescription(seed.description());
            lesson.setStatus(LessonStatus.APPROVED);
            if (lesson.getPublishedAt() == null) {
                lesson.setPublishedAt(Instant.now());
            }
            lesson = lessonRepository.save(lesson);
            targetLessonEntities.add(lesson);

            ensureLessonFlow(lesson, seed.questions());
        }

        Set<Long> targetIds = new HashSet<>();
        for (Lesson lesson : targetLessonEntities) {
            targetIds.add(lesson.getId());
        }

        int order = 1;
        for (Lesson lesson : targetLessonEntities) {
            lesson.setOrderIndex(order++);
            lessonRepository.save(lesson);
        }

        List<Lesson> remaining = lessonRepository.findAllByOrderByOrderIndexAsc().stream()
                .filter(lesson -> !targetIds.contains(lesson.getId()))
                .sorted(Comparator
                        .comparing((Lesson lesson) -> lesson.getOrderIndex() == null ? Integer.MAX_VALUE : lesson.getOrderIndex())
                        .thenComparing(Lesson::getId))
                .toList();

        for (Lesson lesson : remaining) {
            lesson.setOrderIndex(order++);
            if (lesson.getStatus() == null) {
                lesson.setStatus(LessonStatus.APPROVED);
            }
            if (lesson.getPublishedAt() == null) {
                lesson.setPublishedAt(Instant.now());
            }
            if (isBlank(lesson.getDescription())) {
                lesson.setDescription("learn gen alpha terms through short teach-and-quiz steps");
            }
            lessonRepository.save(lesson);
        }
    }

    private Unit ensureDefaultUnit() {
        return unitRepository.findAllByOrderByOrderIndexAsc().stream().findFirst()
                .orElseGet(() -> unitRepository.save(new Unit("internet slang", 1)));
    }

    private void ensureLessonFlow(Lesson lesson, List<QuestionSeed> questionSeeds) {
        List<LessonStep> existingSteps = lessonStepRepository.findByLessonIdOrderByOrderIndexAsc(lesson.getId());
        if (existingSteps.size() >= questionSeeds.size() * 2) {
            return;
        }

        if (!existingSteps.isEmpty()) {
            lessonStepRepository.deleteAll(existingSteps);
        }

        int order = 1;
        for (QuestionSeed questionSeed : questionSeeds) {
            VocabItem vocabItem = ensureVocab(questionSeed);
            LessonQuestion question = createQuestion(questionSeed);

            LessonStep teachStep = new LessonStep(lesson, order++, StepType.TEACH);
            teachStep.setVocabItem(vocabItem);
            lessonStepRepository.save(teachStep);

            LessonStep quizStep = new LessonStep(lesson, order++, StepType.QUESTION);
            quizStep.setQuestion(question);
            lessonStepRepository.save(quizStep);
        }
    }

    private VocabItem ensureVocab(QuestionSeed questionSeed) {
        Optional<VocabItem> existing = vocabItemRepository.findByTermIgnoreCase(questionSeed.term());
        if (existing.isPresent()) {
            VocabItem vocab = existing.get();
            if (isBlank(vocab.getDefinition())) {
                vocab.setDefinition(questionSeed.definition());
            }
            if (isBlank(vocab.getExampleSentence())) {
                vocab.setExampleSentence(questionSeed.exampleSentence());
            }
            if (isBlank(vocab.getPartOfSpeech())) {
                vocab.setPartOfSpeech("noun");
            }
            return vocabItemRepository.save(vocab);
        }

        return vocabItemRepository.save(new VocabItem(
                questionSeed.term(),
                questionSeed.definition(),
                questionSeed.exampleSentence(),
                "noun"));
    }

    private LessonQuestion createQuestion(QuestionSeed questionSeed) {
        LessonQuestion question = lessonQuestionRepository.save(new LessonQuestion(
                QuestionType.MCQ,
                questionSeed.prompt(),
                questionSeed.explanation()));

        int order = 1;
        for (String option : questionSeed.options()) {
            choiceRepository.save(new Choice(
                    question,
                    option,
                    order - 1 == questionSeed.correctOptionIndex(),
                    order));
            order++;
        }

        return question;
    }

    private static boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    private static String normalizeTitle(String title) {
        if (title == null) {
            return "";
        }
        return title.trim().toLowerCase(Locale.ROOT);
    }

    private record LessonSeed(String title, String description, List<QuestionSeed> questions) {
    }

    private record QuestionSeed(
            String term,
            String definition,
            String exampleSentence,
            String prompt,
            List<String> options,
            int correctOptionIndex,
            String explanation) {
    }
}
