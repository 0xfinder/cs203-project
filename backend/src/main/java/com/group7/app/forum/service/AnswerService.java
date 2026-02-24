package com.group7.app.forum.service;

import com.group7.app.forum.model.Answer;
import com.group7.app.forum.model.Question;
import com.group7.app.forum.repository.AnswerRepository;
import com.group7.app.forum.repository.QuestionRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
public class AnswerService {

    private final AnswerRepository answerRepository;
    private final QuestionRepository questionRepository;

    public AnswerService(AnswerRepository answerRepository, QuestionRepository questionRepository) {
        this.answerRepository = answerRepository;
        this.questionRepository = questionRepository;
    }

    public List<Answer> getAnswersForQuestion(Long questionId) {
        return answerRepository.findByQuestionIdOrderByCreatedAtAsc(questionId);
    }

    public Answer postAnswer(Long questionId, Answer answer) {
        if (answer.getContent() == null || answer.getContent().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Answer content is required");
        }
        Question question = questionRepository.findById(questionId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Question not found with id: " + questionId));
        answer.setQuestion(question);
        return answerRepository.save(answer);
    }

    public void deleteAnswer(Long answerId) {
        if (!answerRepository.existsById(answerId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND,
                    "Answer not found with id: " + answerId);
        }
        answerRepository.deleteById(answerId);
    }
}