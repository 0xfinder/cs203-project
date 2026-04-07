package com.group7.app.forum.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.group7.app.forum.model.AnswerVote;
import com.group7.app.forum.model.Question;
import com.group7.app.forum.model.QuestionVote;
import com.group7.app.forum.repository.AnswerRepository;
import com.group7.app.forum.repository.AnswerVoteRepository;
import com.group7.app.forum.repository.QuestionRepository;
import com.group7.app.forum.repository.QuestionVoteRepository;
import com.group7.app.user.User;
import com.group7.app.user.UserRepository;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

@ExtendWith(MockitoExtension.class)
class ForumVoteServiceTest {

  @Mock private QuestionVoteRepository questionVoteRepository;

  @Mock private AnswerVoteRepository answerVoteRepository;

  @Mock private QuestionRepository questionRepository;

  @Mock private AnswerRepository answerRepository;

  @Mock private UserRepository userRepository;

  private ForumVoteService forumVoteService;

  @BeforeEach
  void setUp() {
    forumVoteService =
        new ForumVoteService(
            questionVoteRepository,
            answerVoteRepository,
            questionRepository,
            answerRepository,
            userRepository);
  }

  @Test
  void castQuestionVoteUpdatesExistingVoteAndReturnsSummary() {
    UUID userId = UUID.randomUUID();
    Question question = new Question("title", "content", "author");
    org.springframework.test.util.ReflectionTestUtils.setField(question, "id", 7L);
    User user = new User(userId, "user@example.com");
    QuestionVote existingVote = new QuestionVote(question, user, QuestionVote.VoteType.THUMBS_DOWN);

    when(questionRepository.findById(7L)).thenReturn(Optional.of(question));
    when(userRepository.findById(userId)).thenReturn(Optional.of(user));
    when(questionVoteRepository.findByQuestionIdAndUserId(7L, userId))
        .thenReturn(Optional.of(existingVote));
    when(questionVoteRepository.save(any(QuestionVote.class)))
        .thenAnswer(invocation -> invocation.getArgument(0));
    QuestionVoteRepository.QuestionVoteCountView upCount =
        org.mockito.Mockito.mock(QuestionVoteRepository.QuestionVoteCountView.class);
    when(upCount.getQuestionId()).thenReturn(7L);
    when(upCount.getVoteType()).thenReturn(QuestionVote.VoteType.THUMBS_UP);
    when(upCount.getVoteCount()).thenReturn(4L);
    QuestionVoteRepository.QuestionVoteCountView downCount =
        org.mockito.Mockito.mock(QuestionVoteRepository.QuestionVoteCountView.class);
    when(downCount.getQuestionId()).thenReturn(7L);
    when(downCount.getVoteType()).thenReturn(QuestionVote.VoteType.THUMBS_DOWN);
    when(downCount.getVoteCount()).thenReturn(1L);
    when(questionVoteRepository.summarizeByQuestionIds(java.util.List.of(7L)))
        .thenReturn(java.util.List.of(upCount, downCount));
    when(questionVoteRepository.findAllByQuestionIdInAndUserId(java.util.List.of(7L), userId))
        .thenReturn(java.util.List.of(existingVote));

    var summary = forumVoteService.castQuestionVote(7L, userId, QuestionVote.VoteType.THUMBS_UP);

    assertThat(existingVote.getVoteType()).isEqualTo(QuestionVote.VoteType.THUMBS_UP);
    assertThat(summary.thumbsUp()).isEqualTo(4L);
    assertThat(summary.userVote()).isEqualTo("THUMBS_UP");
    verify(questionVoteRepository).save(existingVote);
  }

  @Test
  void clearAnswerVoteReturnsSummaryWithoutUserVote() {
    UUID userId = UUID.randomUUID();
    AnswerVoteRepository.AnswerVoteCountView upCount =
        org.mockito.Mockito.mock(AnswerVoteRepository.AnswerVoteCountView.class);
    when(upCount.getAnswerId()).thenReturn(9L);
    when(upCount.getVoteType()).thenReturn(AnswerVote.VoteType.THUMBS_UP);
    when(upCount.getVoteCount()).thenReturn(2L);
    when(answerVoteRepository.summarizeByAnswerIds(java.util.List.of(9L)))
        .thenReturn(java.util.List.of(upCount));
    when(answerVoteRepository.findAllByAnswerIdInAndUserId(java.util.List.of(9L), userId))
        .thenReturn(java.util.List.of());

    var summary = forumVoteService.clearAnswerVote(9L, userId);

    assertThat(summary.thumbsUp()).isEqualTo(2L);
    assertThat(summary.userVote()).isNull();
    verify(answerVoteRepository).deleteByAnswerIdAndUserId(9L, userId);
  }

  @Test
  void castAnswerVoteRejectsMissingAnswer() {
    when(answerRepository.findById(99L)).thenReturn(Optional.empty());

    assertThatThrownBy(
            () ->
                forumVoteService.castAnswerVote(
                    99L, UUID.randomUUID(), AnswerVote.VoteType.THUMBS_UP))
        .isInstanceOf(ResponseStatusException.class)
        .hasMessageContaining("Answer not found");
  }

  @Test
  void castQuestionVoteRejectsMissingUser() {
    when(questionRepository.findById(7L))
        .thenReturn(Optional.of(new Question("title", "content", "author")));
    when(userRepository.findById(any(UUID.class))).thenReturn(Optional.empty());

    assertThatThrownBy(
            () ->
                forumVoteService.castQuestionVote(
                    7L, UUID.randomUUID(), QuestionVote.VoteType.THUMBS_UP))
        .isInstanceOf(ResponseStatusException.class)
        .hasMessageContaining("User not found");
  }
}
