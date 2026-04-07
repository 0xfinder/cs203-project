package com.group7.app.forum.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.group7.app.config.DatabaseRoleJwtAuthenticationConverter;
import com.group7.app.config.SecurityConfig;
import com.group7.app.forum.dto.AuthorInfo;
import com.group7.app.forum.dto.QuestionResponse;
import com.group7.app.forum.dto.VoteSummary;
import com.group7.app.forum.model.Question;
import com.group7.app.forum.model.QuestionVote;
import com.group7.app.forum.service.AnswerService;
import com.group7.app.forum.service.ForumMappingService;
import com.group7.app.forum.service.ForumVoteService;
import com.group7.app.forum.service.ModerationService;
import com.group7.app.forum.service.QuestionService;
import com.group7.app.user.Role;
import com.group7.app.user.User;
import com.group7.app.user.UserService;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(ForumController.class)
@Import(SecurityConfig.class)
@ActiveProfiles("test")
class ForumControllerWebMvcTest {

  @Autowired private MockMvc mockMvc;

  @MockitoBean private QuestionService questionService;

  @MockitoBean private AnswerService answerService;

  @MockitoBean private ForumVoteService forumVoteService;

  @MockitoBean private ForumMappingService forumMappingService;

  @MockitoBean private UserService userService;

  @MockitoBean private ModerationService moderationService;

  @MockitoBean private JwtDecoder jwtDecoder;

  @MockitoBean
  private DatabaseRoleJwtAuthenticationConverter databaseRoleJwtAuthenticationConverter;

  @Test
  void getQuestionsAllowsAnonymousAccess() throws Exception {
    Question question = new Question("What is skibidi?", "Explain it", "Kai");
    ReflectionTestUtils.setField(question, "id", 1L);
    QuestionResponse response =
        new QuestionResponse(
            1L,
            "What is skibidi?",
            "Explain it",
            "Kai",
            new AuthorInfo(null, "Kai", null, null, null),
            "2026-01-01T10:00:00",
            List.of(),
            new VoteSummary(0, 0, null));

    when(questionService.getAllQuestions()).thenReturn(List.of(question));
    when(forumMappingService.toQuestionResponse(question, null)).thenReturn(response);

    mockMvc
        .perform(get("/api/forum/questions"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].title").value("What is skibidi?"));
  }

  @Test
  void postQuestionRequiresAuthentication() throws Exception {
    mockMvc
        .perform(
            post("/api/forum/questions")
                .with(csrf())
                .contentType("application/json")
                .content(
                    """
                                {
                                  "title": "What is rizz?",
                                  "content": "Explain it"
                                }
                                """))
        .andExpect(status().isUnauthorized());

    verifyNoInteractions(questionService, userService, forumMappingService);
  }

  @Test
  void postQuestionCreatesQuestionFromResolvedUser() throws Exception {
    UUID userId = UUID.randomUUID();
    User user = new User(userId, "user@example.com");
    user.setDisplayName("Kai");
    user.setRole(Role.LEARNER);

    Question created = new Question("What is rizz?", "Explain it", "Kai");
    ReflectionTestUtils.setField(created, "id", 2L);
    created.setAuthorId(userId);

    QuestionResponse response =
        new QuestionResponse(
            2L,
            "What is rizz?",
            "Explain it",
            "Kai",
            new AuthorInfo(userId.toString(), "Kai", null, null, "LEARNER"),
            "2026-01-01T10:00:00",
            List.of(),
            new VoteSummary(0, 0, null));

    when(userService.findById(userId)).thenReturn(Optional.of(user));
    when(userService.isOnboardingCompleted(user)).thenReturn(true);
    when(questionService.createQuestion(any(Question.class))).thenReturn(created);
    when(forumMappingService.toQuestionResponse(created, userId)).thenReturn(response);

    mockMvc
        .perform(
            post("/api/forum/questions")
                .with(csrf())
                .with(
                    jwt()
                        .jwt(
                            token ->
                                token
                                    .subject(userId.toString())
                                    .claim("email", "user@example.com")))
                .contentType("application/json")
                .content(
                    """
                                {
                                  "title": "  What is rizz?  ",
                                  "content": "  Explain it  "
                                }
                                """))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.id").value(2))
        .andExpect(jsonPath("$.authorInfo.displayName").value("Kai"));

    ArgumentCaptor<Question> questionCaptor = ArgumentCaptor.forClass(Question.class);
    verify(questionService).createQuestion(questionCaptor.capture());
    Question submittedQuestion = questionCaptor.getValue();
    org.assertj.core.api.Assertions.assertThat(submittedQuestion).isNotNull();
    org.assertj.core.api.Assertions.assertThat(submittedQuestion.getTitle())
        .isEqualTo("What is rizz?");
    org.assertj.core.api.Assertions.assertThat(submittedQuestion.getContent())
        .isEqualTo("Explain it");
    org.assertj.core.api.Assertions.assertThat(submittedQuestion.getAuthor()).isEqualTo("Kai");
    org.assertj.core.api.Assertions.assertThat(submittedQuestion.getAuthorId()).isEqualTo(userId);
    verify(forumMappingService).toQuestionResponse(created, userId);
  }

  @Test
  void postQuestionRejectsUserWithIncompleteOnboarding() throws Exception {
    UUID userId = UUID.randomUUID();
    User user = new User(userId, "user@example.com");
    user.setRole(Role.LEARNER);
    user.setDisplayName(null);

    when(userService.findById(userId)).thenReturn(Optional.of(user));

    mockMvc
        .perform(
            post("/api/forum/questions")
                .with(csrf())
                .with(
                    jwt()
                        .jwt(
                            token ->
                                token
                                    .subject(userId.toString())
                                    .claim("email", "user@example.com")))
                .contentType("application/json")
                .content(
                    """
                                {
                                  "title": "What is rizz?",
                                  "content": "Explain it"
                                }
                                """))
        .andExpect(status().isForbidden());

    verifyNoInteractions(questionService, forumMappingService);
  }

  @Test
  void deleteQuestionRejectsNonOwnerWhoIsNotModeratorOrAdmin() throws Exception {
    UUID userId = UUID.randomUUID();
    User user = new User(userId, "user@example.com");
    user.setRole(Role.LEARNER);

    Question question = new Question("title", "content", "owner");
    question.setAuthorId(UUID.randomUUID());

    when(userService.findById(userId)).thenReturn(Optional.of(user));
    when(questionService.getQuestion(7L)).thenReturn(question);

    mockMvc
        .perform(
            delete("/api/forum/questions/7")
                .with(csrf())
                .with(
                    jwt()
                        .jwt(
                            token ->
                                token
                                    .subject(userId.toString())
                                    .claim("email", "user@example.com"))))
        .andExpect(status().isForbidden());
  }

  @Test
  void postQuestionRejectsInvalidJwtSubject() throws Exception {
    mockMvc
        .perform(
            post("/api/forum/questions")
                .with(csrf())
                .with(
                    jwt()
                        .jwt(
                            token ->
                                token.subject("bad-subject").claim("email", "user@example.com")))
                .contentType("application/json")
                .content(
                    """
                                {
                                  "title": "What is rizz?",
                                  "content": "Explain it"
                                }
                                """))
        .andExpect(status().isUnauthorized());

    verifyNoInteractions(questionService, userService, forumMappingService);
  }

  @Test
  void voteQuestionUsesResolvedUser() throws Exception {
    UUID userId = UUID.randomUUID();
    User user = new User(userId, "user@example.com");
    user.setRole(Role.LEARNER);

    when(userService.findById(userId)).thenReturn(Optional.of(user));
    when(userService.isOnboardingCompleted(user)).thenReturn(true);
    when(forumVoteService.castQuestionVote(7L, userId, QuestionVote.VoteType.THUMBS_UP))
        .thenReturn(new VoteSummary(5, 1, "THUMBS_UP"));

    mockMvc
        .perform(
            post("/api/forum/questions/7/votes")
                .with(csrf())
                .with(
                    jwt()
                        .jwt(
                            token ->
                                token
                                    .subject(userId.toString())
                                    .claim("email", "user@example.com")))
                .contentType("application/json")
                .content(
                    """
                                {
                                  "voteType": "THUMBS_UP"
                                }
                                """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.thumbsUp").value(5))
        .andExpect(jsonPath("$.userVote").value("THUMBS_UP"));

    verify(forumVoteService).castQuestionVote(7L, userId, QuestionVote.VoteType.THUMBS_UP);
  }

  @Test
  void voteQuestionRejectsUserWithIncompleteOnboarding() throws Exception {
    UUID userId = UUID.randomUUID();
    User user = new User(userId, "user@example.com");
    user.setRole(Role.LEARNER);
    user.setDisplayName("   ");

    when(userService.findById(userId)).thenReturn(Optional.of(user));

    mockMvc
        .perform(
            post("/api/forum/questions/7/votes")
                .with(csrf())
                .with(
                    jwt()
                        .jwt(
                            token ->
                                token
                                    .subject(userId.toString())
                                    .claim("email", "user@example.com")))
                .contentType("application/json")
                .content(
                    """
                                {
                                  "voteType": "THUMBS_UP"
                                }
                                """))
        .andExpect(status().isForbidden());

    verifyNoInteractions(forumVoteService);
  }
}
