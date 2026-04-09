package com.group7.app.forum.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.group7.app.forum.model.Question;
import com.group7.app.forum.repository.QuestionRepository;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;

@ExtendWith(MockitoExtension.class)
class QuestionServiceTest {

  @Mock private QuestionRepository repository;

  @Mock private ModerationService moderationService;

  private QuestionService questionService;

  @BeforeEach
  void setUp() {
    questionService = new QuestionService(repository, moderationService);
  }

  @Test
  void resolveQuestionRejectsLegacyQuestionWithoutAuthorId() {
    Question question = new Question("title", "content", "author");
    ReflectionTestUtils.setField(question, "id", 7L);
    when(repository.findById(7L)).thenReturn(Optional.of(question));

    assertThatThrownBy(() -> questionService.resolveQuestion(7L, UUID.randomUUID()))
        .isInstanceOfSatisfying(
            ResponseStatusException.class,
            ex -> {
              assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
              assertThat(ex.getReason()).contains("created before ownership tracking");
            });
  }

  @Test
  void resolveQuestionTogglesResolvedStateForOwner() {
    UUID userId = UUID.randomUUID();
    Question question = new Question("title", "content", "author");
    ReflectionTestUtils.setField(question, "id", 7L);
    question.setAuthorId(userId);
    question.setResolved(false);

    when(repository.findById(7L)).thenReturn(Optional.of(question));
    when(repository.save(question)).thenReturn(question);

    Question updated = questionService.resolveQuestion(7L, userId);

    assertThat(updated.isResolved()).isTrue();
    assertThat(updated.getResolvedAt()).isNotNull();
    verify(repository).save(question);
  }
}
