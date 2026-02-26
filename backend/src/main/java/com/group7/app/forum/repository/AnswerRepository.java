package com.group7.app.forum.repository;

import com.group7.app.forum.model.Answer;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AnswerRepository extends JpaRepository<Answer, Long> {
    List<Answer> findByQuestionIdOrderByCreatedAtAsc(Long questionId);
}