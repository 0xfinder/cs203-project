package com.group7.app.forum.repository;

import com.group7.app.forum.model.Question;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface QuestionRepository extends JpaRepository<Question, Long> {
  Page<Question> findAllByOrderByCreatedAtDesc(Pageable pageable);

  @EntityGraph(attributePaths = "answers")
  Optional<Question> findWithAnswersById(Long id);
}
