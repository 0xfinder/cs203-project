package com.group7.app.forum.repository;

import com.group7.app.forum.model.Question;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface QuestionRepository extends JpaRepository<Question, Long> {
  Page<Question> findAllByOrderByCreatedAtDesc(Pageable pageable);

  @Query(
      value =
          """
          SELECT DISTINCT q FROM Question q
          LEFT JOIN q.answers a
          WHERE LOWER(q.title)   LIKE LOWER(CONCAT('%', :search, '%'))
             OR LOWER(q.content) LIKE LOWER(CONCAT('%', :search, '%'))
             OR LOWER(a.content) LIKE LOWER(CONCAT('%', :search, '%'))
          ORDER BY q.createdAt DESC
          """,
      countQuery =
          """
          SELECT COUNT(DISTINCT q) FROM Question q
          LEFT JOIN q.answers a
          WHERE LOWER(q.title)   LIKE LOWER(CONCAT('%', :search, '%'))
             OR LOWER(q.content) LIKE LOWER(CONCAT('%', :search, '%'))
             OR LOWER(a.content) LIKE LOWER(CONCAT('%', :search, '%'))
          """)
  Page<Question> searchIncludingAnswers(@Param("search") String search, Pageable pageable);

  @EntityGraph(attributePaths = "answers")
  Optional<Question> findWithAnswersById(Long id);
}
