package com.group7.app.forum.service;

import com.group7.app.forum.model.Question;
import com.group7.app.forum.repository.QuestionRepository;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class QuestionService {

  private final QuestionRepository repository;
  private static final Logger log = LoggerFactory.getLogger(QuestionService.class);

  public QuestionService(QuestionRepository repository) {
    this.repository = repository;
  }

  public List<Question> getAllQuestions() {
    return repository.findAllByOrderByCreatedAtDesc(); // newest first
  }

  public Question getQuestion(Long id) {
    return repository
        .findById(id)
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
    // Defensive normalization: trim and enforce DB column limits to avoid
    // DataIntegrityViolationException
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

    // Ensure non-null author (use fallback)
    if (author.isBlank()) {
      author = "Anonymous";
    }

    question.setTitle(title);
    question.setAuthor(author);

    // log lengths for debugging
    log.debug(
        "Saving question: titleLen={} authorLen={} contentLen={}",
        title.length(),
        author.length(),
        question.getContent() == null ? 0 : question.getContent().length());

    return repository.save(question);
  }

  public void deleteQuestion(Long id) {
    if (!repository.existsById(id)) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Question not found with id: " + id);
    }
    repository.deleteById(id);
  }
}
