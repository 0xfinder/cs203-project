package com.group7.app.lesson;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.group7.app.lesson.model.Unit;
import com.group7.app.lesson.model.VocabItem;
import com.group7.app.lesson.repository.LessonAttemptRepository;
import com.group7.app.lesson.repository.LessonAttemptResultRepository;
import com.group7.app.lesson.repository.LessonRepository;
import com.group7.app.lesson.repository.LessonStepRepository;
import com.group7.app.lesson.repository.UnitRepository;
import com.group7.app.lesson.repository.UserLessonProgressRepository;
import com.group7.app.lesson.repository.UserStepEventRepository;
import com.group7.app.lesson.repository.UserVocabMemoryRepository;
import com.group7.app.lesson.repository.VocabItemRepository;
import com.group7.app.user.Role;
import com.group7.app.user.User;
import com.group7.app.user.UserRepository;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class LessonSchemaV2E2ETest {

  @Autowired private MockMvc mockMvc;

  @Autowired private ObjectMapper objectMapper;

  @Autowired private LessonAttemptResultRepository lessonAttemptResultRepository;

  @Autowired private LessonAttemptRepository lessonAttemptRepository;

  @Autowired private UserLessonProgressRepository userLessonProgressRepository;

  @Autowired private UserStepEventRepository userStepEventRepository;

  @Autowired private UserVocabMemoryRepository userVocabMemoryRepository;

  @Autowired private LessonStepRepository lessonStepRepository;

  @Autowired private LessonRepository lessonRepository;

  @Autowired private VocabItemRepository vocabItemRepository;

  @Autowired private UnitRepository unitRepository;

  @Autowired private UserRepository userRepository;

  @BeforeEach
  void cleanDatabase() {
    lessonAttemptResultRepository.deleteAll();
    lessonAttemptRepository.deleteAll();
    userStepEventRepository.deleteAll();
    userLessonProgressRepository.deleteAll();
    userVocabMemoryRepository.deleteAll();
    lessonStepRepository.deleteAll();
    lessonRepository.deleteAll();
    vocabItemRepository.deleteAll();
    unitRepository.deleteAll();
    userRepository.deleteAll();
  }

  @Test
  void lessonSchemaV2SupportsAuthoringPlaybackAndGrading() throws Exception {
    Unit unit =
        unitRepository.save(
            new Unit(
                "Slang Foundations",
                "slang-foundations",
                "Core Gen Alpha slang used in everyday chat.",
                1));

    VocabItem rizz =
        vocabItemRepository.save(
            new VocabItem("rizz", "charisma or flirting ability", "He has rizz.", "noun"));

    User contributor = saveUser("contributor@example.com", Role.CONTRIBUTOR);
    User moderator = saveUser("moderator@example.com", Role.MODERATOR);
    User learner = saveUser("learner@example.com", Role.LEARNER);

    ObjectNode createLesson = objectMapper.createObjectNode();
    createLesson.put("unitId", unit.getId());
    createLesson.put("title", "Rizz and Cap Basics");
    createLesson.put("description", "Introductory slang for charm and calling out lies.");
    createLesson.put("learningObjective", "Understand and apply rizz, cap, and no cap in context.");
    createLesson.put("estimatedMinutes", 5);
    createLesson.put("orderIndex", 1);

    MvcResult createLessonResult =
        mockMvc
            .perform(
                post("/api/lessons")
                    .with(auth(contributor))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsBytes(createLesson)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.title").value("Rizz and Cap Basics"))
            .andReturn();

    long lessonId =
        objectMapper
            .readTree(createLessonResult.getResponse().getContentAsByteArray())
            .path("id")
            .asLong();

    mockMvc
        .perform(
            post("/api/lessons/{lessonId}/steps", lessonId)
                .with(auth(contributor))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    objectMapper.writeValueAsBytes(
                        stepRequest(1, "TEACH").put("vocabItemId", rizz.getId()))))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.payload.title").value("rizz"));

    mockMvc
        .perform(
            post("/api/lessons/{lessonId}/steps", lessonId)
                .with(auth(contributor))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    objectMapper.writeValueAsBytes(
                        mcqStepRequest(
                            2,
                            "What does \"rizz\" mean?",
                            "Rizz means charisma, especially in social situations.",
                            0,
                            "Charisma or flirting ability",
                            "A type of food",
                            "Being sleepy"))))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.question.choices[0].isCorrect").value(true))
        .andExpect(jsonPath("$.payload.answerKey.choiceId").value(1));

    mockMvc
        .perform(
            post("/api/lessons/{lessonId}/steps", lessonId)
                .with(auth(contributor))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    objectMapper.writeValueAsBytes(
                        dialogueStepRequest(
                            3,
                            "A: I finished everything in five minutes.\nB: That sounds like cap."))))
        .andExpect(status().isCreated())
        .andExpect(
            jsonPath("$.dialogueText")
                .value("A: I finished everything in five minutes.\nB: That sounds like cap."));

    mockMvc
        .perform(
            post("/api/lessons/{lessonId}/steps", lessonId)
                .with(auth(contributor))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsBytes(matchStepRequest(4))))
        .andExpect(status().isCreated())
        .andExpect(
            jsonPath("$.question.matchPairs[0].right").value("charisma or flirting ability"));

    mockMvc
        .perform(
            post("/api/lessons/{lessonId}/steps", lessonId)
                .with(auth(contributor))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsBytes(shortAnswerStepRequest(5))))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.question.acceptedAnswers[0]").value("no cap"));

    mockMvc
        .perform(
            post("/api/lessons/{lessonId}/steps", lessonId)
                .with(auth(contributor))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsBytes(recapStepRequest(6))))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.stepType").value("RECAP"))
        .andExpect(jsonPath("$.payload.headline").value("quick recap"));

    ObjectNode submitForReview = objectMapper.createObjectNode();
    submitForReview.put("status", "PENDING_REVIEW");
    mockMvc
        .perform(
            patch("/api/lessons/{lessonId}", lessonId)
                .with(auth(contributor))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsBytes(submitForReview)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("PENDING_REVIEW"));

    ObjectNode approveLesson = objectMapper.createObjectNode();
    approveLesson.put("status", "APPROVED");
    mockMvc
        .perform(
            patch("/api/lessons/{lessonId}", lessonId)
                .with(auth(moderator))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsBytes(approveLesson)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("APPROVED"));

    mockMvc
        .perform(get("/api/units").with(auth(learner)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].title").value("Slang Foundations"))
        .andExpect(jsonPath("$[0].slug").value("slang-foundations"))
        .andExpect(
            jsonPath("$[0].description").value("Core Gen Alpha slang used in everyday chat."))
        .andExpect(jsonPath("$[0].lessons[0].title").value("Rizz and Cap Basics"))
        .andExpect(jsonPath("$[0].lessons[0].slug").value("rizz-and-cap-basics"))
        .andExpect(
            jsonPath("$[0].lessons[0].learningObjective")
                .value("Understand and apply rizz, cap, and no cap in context."))
        .andExpect(jsonPath("$[0].lessons[0].estimatedMinutes").value(5));

    mockMvc
        .perform(get("/api/lessons/{lessonId}", lessonId).with(auth(contributor)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.steps[1].payload.answerKey.choiceId").value(1))
        .andExpect(jsonPath("$.steps[5].payload.headline").value("quick recap"));

    MvcResult playResult =
        mockMvc
            .perform(get("/api/lessons/{lessonId}/content", lessonId).with(auth(learner)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.steps[1].payload.answerKey").doesNotExist())
            .andExpect(jsonPath("$.steps[1].question.choices[0].isCorrect").isEmpty())
            .andExpect(jsonPath("$.steps[3].question.matchPairs[0].right").isEmpty())
            .andExpect(jsonPath("$.steps[5].stepType").value("RECAP"))
            .andReturn();

    JsonNode playJson = objectMapper.readTree(playResult.getResponse().getContentAsByteArray());
    long mcqStepId = playJson.path("steps").get(1).path("id").asLong();
    long matchStepId = playJson.path("steps").get(3).path("id").asLong();
    long shortAnswerStepId = playJson.path("steps").get(4).path("id").asLong();
    long recapStepId = playJson.path("steps").get(5).path("id").asLong();

    ObjectNode submission = objectMapper.createObjectNode();
    submission.put("lessonId", lessonId);
    ArrayNode answers = submission.putArray("answers");
    answers.addObject().put("stepId", mcqStepId).put("answer", "Charisma or flirting ability");
    ObjectNode matchAnswer = answers.addObject();
    matchAnswer.put("stepId", matchStepId);
    matchAnswer.set(
        "answer",
        objectMapper
            .createObjectNode()
            .put("rizz", "charisma or flirting ability")
            .put("cap", "a lie"));
    answers.addObject().put("stepId", shortAnswerStepId).put("answer", "No cap");

    mockMvc
        .perform(
            post("/api/lesson-attempts")
                .with(auth(learner))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsBytes(submission)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.score").value(100))
        .andExpect(jsonPath("$.correctCount").value(3))
        .andExpect(jsonPath("$.passed").value(true))
        .andExpect(
            jsonPath("$.results[1].correctAnswer")
                .value("rizz = charisma or flirting ability; cap = a lie"));

    mockMvc
        .perform(get("/api/user-lesson-progress").with(auth(learner)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].lessonId").value(lessonId))
        .andExpect(jsonPath("$[0].attempts").value(1))
        .andExpect(jsonPath("$[0].bestScore").value(100))
        .andExpect(jsonPath("$[0].completedAt").isNotEmpty())
        .andExpect(jsonPath("$[0].lastStepId").value(recapStepId));

    mockMvc
        .perform(
            get("/api/vocab-memory").with(auth(learner)).param("due", "false").param("limit", "10"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].term").value("rizz"))
        .andExpect(jsonPath("$[0].strength").value(1));

    mockMvc
        .perform(get("/api/revise-queue").with(auth(learner)).param("limit", "5"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items[0].stepId").value(mcqStepId))
        .andExpect(jsonPath("$.items[0].lessonTitle").value("Rizz and Cap Basics"))
        .andExpect(jsonPath("$.items[0].question.prompt").value("What does \"rizz\" mean?"))
        .andExpect(jsonPath("$.items[0].payload.answerKey").doesNotExist());

    ObjectNode reviseSubmission = objectMapper.createObjectNode();
    ArrayNode reviseAnswers = reviseSubmission.putArray("answers");
    reviseAnswers.addObject().put("stepId", mcqStepId).put("answer", "A type of food");

    mockMvc
        .perform(
            post("/api/revise-attempts")
                .with(auth(learner))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsBytes(reviseSubmission)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.score").value(0))
        .andExpect(jsonPath("$.correctCount").value(0))
        .andExpect(jsonPath("$.results[0].correct").value(false))
        .andExpect(jsonPath("$.results[0].correctAnswer").value("Charisma or flirting ability"))
        .andExpect(jsonPath("$.dueCount").value(0));
  }

  @Test
  void recapStepRequiresPayloadObject() throws Exception {
    Unit unit =
        unitRepository.save(
            new Unit(
                "Internet Culture",
                "internet-culture",
                "Culture references and meme literacy.",
                1));
    User contributor = saveUser("writer@example.com", Role.CONTRIBUTOR);

    ObjectNode createLesson = objectMapper.createObjectNode();
    createLesson.put("unitId", unit.getId());
    createLesson.put("title", "Vibe Check");
    createLesson.put("description", "Test lesson");
    createLesson.put("orderIndex", 1);

    MvcResult createLessonResult =
        mockMvc
            .perform(
                post("/api/lessons")
                    .with(auth(contributor))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsBytes(createLesson)))
            .andExpect(status().isCreated())
            .andReturn();

    long lessonId =
        objectMapper
            .readTree(createLessonResult.getResponse().getContentAsByteArray())
            .path("id")
            .asLong();

    ObjectNode invalidRecap = objectMapper.createObjectNode();
    invalidRecap.put("orderIndex", 1);
    invalidRecap.put("stepType", "RECAP");
    invalidRecap.put("dialogueText", "not enough");

    mockMvc
        .perform(
            post("/api/lessons/{lessonId}/steps", lessonId)
                .with(auth(contributor))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsBytes(invalidRecap)))
        .andExpect(status().isBadRequest());
  }

  private User saveUser(String email, Role role) {
    User user = new User(UUID.randomUUID(), email);
    user.setDisplayName(email.substring(0, email.indexOf('@')));
    user.setRole(role);
    return userRepository.save(user);
  }

  private JwtRequestPostProcessor auth(User user) {
    return jwt().jwt(jwt -> jwt.subject(user.getId().toString()).claim("email", user.getEmail()));
  }

  private ObjectNode stepRequest(int orderIndex, String stepType) {
    ObjectNode node = objectMapper.createObjectNode();
    node.put("orderIndex", orderIndex);
    node.put("stepType", stepType);
    return node;
  }

  private ObjectNode mcqStepRequest(
      int orderIndex,
      String prompt,
      String explanation,
      int correctOptionIndex,
      String... options) {
    ObjectNode node = stepRequest(orderIndex, "QUESTION");
    node.put("questionType", "MCQ");
    node.put("prompt", prompt);
    node.put("explanation", explanation);
    node.put("correctOptionIndex", correctOptionIndex);
    ArrayNode choices = node.putArray("options");
    for (String option : options) {
      choices.add(option);
    }
    return node;
  }

  private ObjectNode dialogueStepRequest(int orderIndex, String dialogueText) {
    ObjectNode node = stepRequest(orderIndex, "DIALOGUE");
    node.put("dialogueText", dialogueText);
    return node;
  }

  private ObjectNode matchStepRequest(int orderIndex) {
    ObjectNode node = stepRequest(orderIndex, "QUESTION");
    node.put("questionType", "MATCH");
    node.put("prompt", "Match each term to the correct meaning.");
    node.put("explanation", "Pair slang terms with their definitions.");
    ArrayNode pairs = node.putArray("matchPairs");
    pairs.addObject().put("left", "rizz").put("right", "charisma or flirting ability");
    pairs.addObject().put("left", "cap").put("right", "a lie");
    return node;
  }

  private ObjectNode shortAnswerStepRequest(int orderIndex) {
    ObjectNode node = stepRequest(orderIndex, "QUESTION");
    node.put("questionType", "SHORT_ANSWER");
    node.put("prompt", "Which phrase means \"for real\"?");
    node.put("explanation", "No cap means someone is being honest.");
    node.putArray("acceptedAnswers").add("no cap");
    return node;
  }

  private ObjectNode recapStepRequest(int orderIndex) {
    ObjectNode node = stepRequest(orderIndex, "RECAP");
    ObjectNode payload = node.putObject("payload");
    payload.put("headline", "quick recap");
    payload
        .putArray("bullets")
        .add("rizz means charisma")
        .add("cap means lie")
        .add("no cap means for real");
    return node;
  }
}
