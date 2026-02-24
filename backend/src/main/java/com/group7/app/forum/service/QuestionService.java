package com.group7.app.forum.service;

import com.group7.app.forum.model.Question;
import com.group7.app.forum.repository.QuestionRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
public class QuestionService {

    private final QuestionRepository repository;

    public QuestionService(QuestionRepository repository) {
        this.repository = repository;
    }

    public List<Question> getAllQuestions() {
        return repository.findAllByOrderByCreatedAtDesc();   // newest first
    }

    public Question getQuestion(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Question not found with id: " + id));
    }

    public Question createQuestion(Question question) {
        if (question.getTitle() == null || question.getTitle().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Title is required");
        }
        if (question.getContent() == null || question.getContent().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Content is required");
        }
        return repository.save(question);
    }

    public void deleteQuestion(Long id) {
        if (!repository.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND,
                    "Question not found with id: " + id);
        }
        repository.deleteById(id);
    }
}