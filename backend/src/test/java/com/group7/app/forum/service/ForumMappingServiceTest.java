package com.group7.app.forum.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.group7.app.forum.dto.VoteSummary;
import com.group7.app.forum.model.Answer;
import com.group7.app.forum.model.Question;
import com.group7.app.user.Role;
import com.group7.app.user.User;
import com.group7.app.user.UserRepository;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ForumMappingServiceTest {

  @Mock private UserRepository userRepository;

  @Mock private ForumVoteService forumVoteService;

  private ForumMappingService forumMappingService;

  @BeforeEach
  void setUp() {
    forumMappingService = new ForumMappingService(userRepository, forumVoteService);
  }

  @Test
  void toQuestionResponseUsesUserProfileAndNestedAnswerMappings() {
    UUID questionAuthorId = UUID.randomUUID();
    UUID answerAuthorId = UUID.randomUUID();
    UUID viewerId = UUID.randomUUID();

    User questionAuthor = new User(questionAuthorId, "question@example.com");
    questionAuthor.setDisplayName("Kai");
    questionAuthor.setAvatarPath("uploads/kai.png");
    questionAuthor.setAvatarColor("#123456");
    questionAuthor.setRole(Role.CONTRIBUTOR);

    User answerAuthor = new User(answerAuthorId, "answer@example.com");
    answerAuthor.setDisplayName("Luna");
    answerAuthor.setRole(Role.LEARNER);

    Question question = new Question("What is rizz?", "Explain it", "fallback");
    org.springframework.test.util.ReflectionTestUtils.setField(question, "id", 1L);
    question.setAuthorId(questionAuthorId);
    question.setCreatedAt(LocalDateTime.of(2026, 1, 1, 10, 0));

    Answer answer = new Answer();
    org.springframework.test.util.ReflectionTestUtils.setField(answer, "id", 2L);
    answer.setAuthor("fallback answer");
    answer.setAuthorId(answerAuthorId);
    answer.setContent("charisma");
    answer.setCreatedAt(LocalDateTime.of(2026, 1, 1, 10, 5));
    question.setAnswers(List.of(answer));

    when(userRepository.findAllById(org.mockito.ArgumentMatchers.anyIterable()))
        .thenReturn(List.of(questionAuthor, answerAuthor));
    when(forumVoteService.getQuestionVoteSummaries(List.of(1L), viewerId))
        .thenReturn(Map.of(1L, new VoteSummary(3, 1, "THUMBS_UP")));
    when(forumVoteService.getAnswerVoteSummaries(List.of(2L), viewerId))
        .thenReturn(Map.of(2L, new VoteSummary(1, 0, null)));

    var response = forumMappingService.toQuestionResponse(question, viewerId);

    assertThat(response.authorInfo().displayName()).isEqualTo("Kai");
    assertThat(response.authorInfo().avatarPath()).isEqualTo("uploads/kai.png");
    assertThat(response.authorInfo().role()).isEqualTo("CONTRIBUTOR");
    assertThat(response.answerCount()).isEqualTo(1);
    assertThat(response.answers()).hasSize(1);
    assertThat(response.answers().get(0).authorInfo().displayName()).isEqualTo("Luna");
    assertThat(response.votes().thumbsUp()).isEqualTo(3);
  }

  @Test
  void toQuestionResponseFallsBackToLegacyDisplayNameLookup() {
    UUID viewerId = UUID.randomUUID();
    User legacyUser = new User(UUID.randomUUID(), "legacy@example.com");
    legacyUser.setDisplayName("OldName");

    Question question = new Question("title", "content", "OldName");
    org.springframework.test.util.ReflectionTestUtils.setField(question, "id", 5L);

    when(userRepository.findFirstByDisplayNameIgnoreCase("OldName"))
        .thenReturn(Optional.of(legacyUser));
    when(forumVoteService.getQuestionVoteSummaries(List.of(5L), viewerId))
        .thenReturn(Map.of(5L, new VoteSummary(0, 0, null)));

    var response = forumMappingService.toQuestionResponse(question, viewerId);

    assertThat(response.authorInfo().displayName()).isEqualTo("OldName");
    assertThat(response.authorInfo().id()).isEqualTo(legacyUser.getId().toString());
  }
}
