package com.group7.app.lesson.repository;

import com.group7.app.lesson.model.LessonAttemptResult;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LessonAttemptResultRepository extends JpaRepository<LessonAttemptResult, Long> {
  List<LessonAttemptResult> findByAttemptIdOrderByIdAsc(Long attemptId);
}
