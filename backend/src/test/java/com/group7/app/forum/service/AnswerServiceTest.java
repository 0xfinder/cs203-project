package com.group7.app.forum.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.group7.app.forum.model.Answer;
import com.group7.app.forum.model.Question;
import com.group7.app.forum.repository.AnswerRepository;
import com.group7.app.forum.repository.QuestionRepository;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;

@ExtendWith(MockitoExtension.class)
class AnswerServiceTest {

  @Mock private AnswerRepository answerRepository;

  @Mock private QuestionRepository questionRepository;

  @Mock private ModerationService moderationService;

  private AnswerService answerService;

  @BeforeEach
  void setUp() {
    answerService = new AnswerService(answerRepository, questionRepository, moderationService);
  }

  @Test
  void getAnswerCountsReturnsEmptyMapForEmptyInput() {
    assertThat(answerService.getAnswerCounts(List.of())).isEmpty();
  }

  @Test
  void getAnswerCountsReturnsProjectionValues() {
    when(answerRepository.countByQuestionIds(List.of(1L, 2L)))
        .thenReturn(List.of(countView(1L, 3L), countView(2L, 5L)));

    var result = answerService.getAnswerCounts(List.of(1L, 2L));

    assertThat(result).containsEntry(1L, 3L).containsEntry(2L, 5L);
  }

  @Test
  void getAnswerRejectsMissingAnswer() {
    when(answerRepository.findById(4L)).thenReturn(Optional.empty());

    assertThatThrownBy(() -> answerService.getAnswer(4L))
        .isInstanceOfSatisfying(
            ResponseStatusException.class,
            ex -> {
              assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
              assertThat(ex.getReason()).contains("Answer not found");
            });
  }

  @Test
  void postAnswerRejectsBlankContent() {
    Answer answer = new Answer();
    answer.setContent(" ");

    assertThatThrownBy(() -> answerService.postAnswer(2L, answer))
        .isInstanceOfSatisfying(
            ResponseStatusException.class,
            ex -> {
              assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
              assertThat(ex.getReason()).isEqualTo("Answer content is required");
            });
  }

  @Test
  void postAnswerRejectsMissingQuestion() {
    Answer answer = new Answer();
    answer.setContent("answer");
    when(questionRepository.findById(2L)).thenReturn(Optional.empty());

    assertThatThrownBy(() -> answerService.postAnswer(2L, answer))
        .isInstanceOfSatisfying(
            ResponseStatusException.class,
            ex -> {
              assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
              assertThat(ex.getReason()).contains("Question not found");
            });
  }

  @Test
  void postAnswerAssociatesQuestionModeratesAndSaves() {
    Question question = new Question("title", "content", "author");
    ReflectionTestUtils.setField(question, "id", 2L);
    Answer answer = new Answer();
    answer.setContent("new answer");

    when(questionRepository.findById(2L)).thenReturn(Optional.of(question));
    when(answerRepository.save(answer)).thenReturn(answer);

    Answer saved = answerService.postAnswer(2L, answer);

    assertThat(saved.getQuestion()).isSameAs(question);
    verify(moderationService).moderateContent("new answer");
    verify(answerRepository).save(answer);
  }

  @Test
  void deleteAnswerRejectsMissingAnswer() {
    when(answerRepository.existsById(3L)).thenReturn(false);

    assertThatThrownBy(() -> answerService.deleteAnswer(3L))
        .isInstanceOfSatisfying(
            ResponseStatusException.class,
            ex -> {
              assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
              assertThat(ex.getReason()).contains("Answer not found");
            });
  }

  @Test
  void deleteAnswerDeletesExistingAnswer() {
    when(answerRepository.existsById(3L)).thenReturn(true);

    answerService.deleteAnswer(3L);

    verify(answerRepository).deleteById(3L);
  }

  private AnswerRepository.QuestionAnswerCountView countView(Long questionId, long answerCount) {
    return new AnswerRepository.QuestionAnswerCountView() {
      @Override
      public Long getQuestionId() {
        return questionId;
      }

      @Override
      public long getAnswerCount() {
        return answerCount;
      }
    };
  }
}
