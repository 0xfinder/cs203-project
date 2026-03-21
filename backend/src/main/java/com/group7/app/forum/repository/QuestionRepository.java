package com.group7.app.forum.repository;

import com.group7.app.forum.model.Question;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface QuestionRepository extends JpaRepository<Question, Long> {
  // Returns questions sorted newest-first (no @Query needed — Spring Data derives it)
  List<Question> findAllByOrderByCreatedAtDesc();
}
