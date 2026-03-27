package com.group7.app.forum.repository;

import com.group7.app.forum.model.Answer;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AnswerRepository extends JpaRepository<Answer, Long> {
  List<Answer> findByQuestionIdOrderByCreatedAtAsc(Long questionId);
}
