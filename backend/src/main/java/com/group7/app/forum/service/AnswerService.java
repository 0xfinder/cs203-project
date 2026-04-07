package com.group7.app.forum.service;

import com.group7.app.forum.model.Answer;
import com.group7.app.forum.model.Question;
import com.group7.app.forum.repository.AnswerRepository;
import com.group7.app.forum.repository.QuestionRepository;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AnswerService {

  private final AnswerRepository answerRepository;
  private final QuestionRepository questionRepository;
  private final ModerationService moderationService;

  public AnswerService(
      AnswerRepository answerRepository,
      QuestionRepository questionRepository,
      ModerationService moderationService) {
    this.answerRepository = answerRepository;
    this.questionRepository = questionRepository;
    this.moderationService = moderationService;
  }

  public List<Answer> getAnswersForQuestion(Long questionId) {
    return answerRepository.findByQuestionIdOrderByCreatedAtAsc(questionId);
  }

  public Map<Long, Long> getAnswerCounts(Collection<Long> questionIds) {
    if (questionIds.isEmpty()) {
      return Map.of();
    }

    Map<Long, Long> counts = new HashMap<>();
    for (var row : answerRepository.countByQuestionIds(questionIds)) {
      counts.put(row.getQuestionId(), row.getAnswerCount());
    }
    return counts;
  }

  public Answer getAnswer(Long answerId) {
    return answerRepository
        .findById(answerId)
        .orElseThrow(
            () ->
                new ResponseStatusException(
                    HttpStatus.NOT_FOUND, "Answer not found with id: " + answerId));
  }

  public Answer postAnswer(Long questionId, Answer answer) {
    if (answer.getContent() == null || answer.getContent().isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Answer content is required");
    }
    Question question =
        questionRepository
            .findById(questionId)
            .orElseThrow(
                () ->
                    new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Question not found with id: " + questionId));
    answer.setQuestion(question);
    moderationService.moderateContent(answer.getContent());
    return answerRepository.save(answer);
  }

  public void deleteAnswer(Long answerId) {
    if (!answerRepository.existsById(answerId)) {
      throw new ResponseStatusException(
          HttpStatus.NOT_FOUND, "Answer not found with id: " + answerId);
    }
    answerRepository.deleteById(answerId);
  }
}
