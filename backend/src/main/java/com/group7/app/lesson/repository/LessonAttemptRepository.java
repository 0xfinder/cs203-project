package com.group7.app.lesson.repository;

import com.group7.app.lesson.model.LessonAttempt;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LessonAttemptRepository extends JpaRepository<LessonAttempt, Long> {
  Optional<LessonAttempt> findByIdAndUserId(Long id, UUID userId);

  @org.springframework.data.jpa.repository.Query(
      "SELECT a FROM LessonAttempt a JOIN FETCH a.lesson l JOIN FETCH l.unit"
          + " WHERE a.userId = :userId ORDER BY a.submittedAt ASC")
  List<LessonAttempt> findByUserIdWithLessonAndUnit(
      @org.springframework.data.repository.query.Param("userId") UUID userId);
}
