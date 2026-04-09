package com.group7.app.forum.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.group7.app.forum.model.Question;
import com.group7.app.forum.repository.QuestionRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
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
  void getQuestionsUsesSearchRepositoryWhenSearchIsPresent() {
    PageRequest pageable = PageRequest.of(0, 10);
    Question question = new Question("title", "content", "author");
    when(repository.searchIncludingAnswers("rizz", pageable))
        .thenReturn(new PageImpl<>(List.of(question), pageable, 1));

    var result = questionService.getQuestions(pageable, "rizz");

    assertThat(result.getContent()).containsExactly(question);
    verify(repository).searchIncludingAnswers("rizz", pageable);
    verify(repository, never()).findAllByOrderByCreatedAtDesc(any());
  }

  @Test
  void getQuestionsFallsBackToDefaultListingWhenSearchIsBlank() {
    PageRequest pageable = PageRequest.of(0, 10);
    Question question = new Question("title", "content", "author");
    when(repository.findAllByOrderByCreatedAtDesc(pageable))
        .thenReturn(new PageImpl<>(List.of(question), pageable, 1));

    var result = questionService.getQuestions(pageable, "   ");

    assertThat(result.getContent()).containsExactly(question);
    verify(repository).findAllByOrderByCreatedAtDesc(pageable);
    verify(repository, never()).searchIncludingAnswers(any(), any());
  }

  @Test
  void getQuestionWithAnswersReturnsQuestionWhenPresent() {
    Question question = new Question("title", "content", "author");
    ReflectionTestUtils.setField(question, "id", 9L);
    when(repository.findWithAnswersById(9L)).thenReturn(Optional.of(question));

    Question result = questionService.getQuestionWithAnswers(9L);

    assertThat(result).isSameAs(question);
  }

  @Test
  void createQuestionRejectsMissingTitle() {
    assertThatThrownBy(() -> questionService.createQuestion(new Question(" ", "content", "Kai")))
        .isInstanceOfSatisfying(
            ResponseStatusException.class,
            ex -> {
              assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
              assertThat(ex.getReason()).isEqualTo("Title is required");
            });
  }

  @Test
  void createQuestionRejectsMissingContent() {
    assertThatThrownBy(() -> questionService.createQuestion(new Question("title", " ", "Kai")))
        .isInstanceOfSatisfying(
            ResponseStatusException.class,
            ex -> {
              assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
              assertThat(ex.getReason()).isEqualTo("Content is required");
            });
  }

  @Test
  void createQuestionTrimsFieldsDefaultsAnonymousAndModerates() {
    Question question = new Question("  what is aura?  ", "explain it", "   ");
    when(repository.save(question)).thenReturn(question);

    Question created = questionService.createQuestion(question);

    assertThat(created.getTitle()).isEqualTo("what is aura?");
    assertThat(created.getAuthor()).isEqualTo("Anonymous");
    verify(moderationService).moderateContent("what is aura?\nexplain it");
    verify(repository).save(question);
  }

  @Test
  void createQuestionTruncatesLongTitleAndAuthor() {
    String longText = "x".repeat(300);
    Question question = new Question(longText, "content", longText);
    when(repository.save(question)).thenReturn(question);

    Question created = questionService.createQuestion(question);

    assertThat(created.getTitle()).hasSize(255);
    assertThat(created.getAuthor()).hasSize(255);
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
  void resolveQuestionRejectsNonOwner() {
    UUID ownerId = UUID.randomUUID();
    UUID otherUserId = UUID.randomUUID();
    Question question = new Question("title", "content", "author");
    ReflectionTestUtils.setField(question, "id", 7L);
    question.setAuthorId(ownerId);

    when(repository.findById(7L)).thenReturn(Optional.of(question));

    assertThatThrownBy(() -> questionService.resolveQuestion(7L, otherUserId))
        .isInstanceOfSatisfying(
            ResponseStatusException.class,
            ex -> {
              assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
              assertThat(ex.getReason()).contains("Only the question author");
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

  @Test
  void resolveQuestionClearsResolvedAtWhenToggledOff() {
    UUID userId = UUID.randomUUID();
    Question question = new Question("title", "content", "author");
    ReflectionTestUtils.setField(question, "id", 7L);
    question.setAuthorId(userId);
    question.setResolved(true);

    when(repository.findById(7L)).thenReturn(Optional.of(question));
    when(repository.save(question)).thenReturn(question);

    Question updated = questionService.resolveQuestion(7L, userId);

    assertThat(updated.isResolved()).isFalse();
    assertThat(updated.getResolvedAt()).isNull();
  }

  @Test
  void deleteQuestionRejectsMissingQuestion() {
    when(repository.existsById(5L)).thenReturn(false);

    assertThatThrownBy(() -> questionService.deleteQuestion(5L))
        .isInstanceOfSatisfying(
            ResponseStatusException.class,
            ex -> {
              assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
              assertThat(ex.getReason()).contains("Question not found");
            });
  }

  @Test
  void deleteQuestionDeletesExistingQuestion() {
    when(repository.existsById(5L)).thenReturn(true);

    questionService.deleteQuestion(5L);

    verify(repository).deleteById(5L);
  }
}
