package com.group7.app.lesson.repository;

import com.group7.app.lesson.model.LessonStep;
import com.group7.app.lesson.model.StepType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface LessonStepRepository extends JpaRepository<LessonStep, Long> {
  @Query(
      """
            SELECT s
            FROM LessonStep s
            LEFT JOIN FETCH s.vocabItem
            WHERE s.lesson.id = :lessonId
            ORDER BY s.orderIndex ASC
            """)
  List<LessonStep> findByLessonIdOrderByOrderIndexAsc(Long lessonId);

  Optional<LessonStep> findByIdAndLessonId(Long id, Long lessonId);

  List<LessonStep> findByLessonIdAndStepTypeOrderByOrderIndexAsc(Long lessonId, StepType stepType);
}
