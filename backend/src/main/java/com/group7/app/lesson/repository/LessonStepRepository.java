package com.group7.app.lesson.repository;

import com.group7.app.lesson.model.LessonStep;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LessonStepRepository extends JpaRepository<LessonStep, Long> {
    List<LessonStep> findByLessonIdOrderByOrderIndexAsc(Long lessonId);

    Optional<LessonStep> findByIdAndLessonId(Long id, Long lessonId);

    List<LessonStep> findByLessonIdAndQuestionIsNotNullOrderByOrderIndexAsc(Long lessonId);
}
