package com.group7.app.forum.service;

import com.group7.app.forum.model.Question;
import com.group7.app.forum.repository.QuestionRepository;
import java.time.LocalDateTime;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class QuestionService {

  private final QuestionRepository repository;
  private static final Logger log = LoggerFactory.getLogger(QuestionService.class);
  private final ModerationService moderationService;

  public QuestionService(QuestionRepository repository, ModerationService moderationService) {
    this.repository = repository;
    this.moderationService = moderationService;
  }

  public Page<Question> getQuestions(Pageable pageable, String search) {
    if (search != null && !search.isBlank()) {
      return repository.searchIncludingAnswers(search, pageable);
    }
    return repository.findAllByOrderByCreatedAtDesc(pageable);
  }

  public Question getQuestion(Long id) {
    return repository
        .findById(id)
        .orElseThrow(
            () ->
                new ResponseStatusException(
                    HttpStatus.NOT_FOUND, "Question not found with id: " + id));
  }

  public Question getQuestionWithAnswers(Long id) {
    return repository
        .findWithAnswersById(id)
        .orElseThrow(
            () ->
                new ResponseStatusException(
                    HttpStatus.NOT_FOUND, "Question not found with id: " + id));
  }

  public Question createQuestion(Question question) {
    if (question.getTitle() == null || question.getTitle().isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Title is required");
    }
    if (question.getContent() == null || question.getContent().isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Content is required");
    }
    String title = question.getTitle() != null ? question.getTitle().trim() : "";
    String author = question.getAuthor() != null ? question.getAuthor().trim() : "";

    if (title.length() > 255) {
      log.warn("Truncating title from length {} to 255", title.length());
      title = title.substring(0, 255);
    }
    if (author.length() > 255) {
      log.warn("Truncating author from length {} to 255", author.length());
      author = author.substring(0, 255);
    }

    if (author.isBlank()) {
      author = "Anonymous";
    }

    question.setTitle(title);
    question.setAuthor(author);

    log.debug(
        "Saving question: titleLen={} authorLen={} contentLen={}",
        title.length(),
        author.length(),
        question.getContent() == null ? 0 : question.getContent().length());

    moderationService.moderateContent(question.getTitle() + "\n" + question.getContent());
    return repository.save(question);
  }

  public Question resolveQuestion(Long id, UUID requestingUserId) {
    Question question = getQuestion(id);
    if (question.getAuthorId() == null) {
      throw new ResponseStatusException(
          HttpStatus.CONFLICT,
          "This question was created before ownership tracking and cannot be marked resolved.");
    }
    if (!question.getAuthorId().equals(requestingUserId)) {
      throw new ResponseStatusException(
          HttpStatus.FORBIDDEN, "Only the question author can mark it as resolved");
    }
    question.setResolved(!question.isResolved());
    question.setResolvedAt(question.isResolved() ? LocalDateTime.now() : null);
    return repository.save(question);
  }

  public void deleteQuestion(Long id) {
    if (!repository.existsById(id)) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Question not found with id: " + id);
    }
    repository.deleteById(id);
  }
}
