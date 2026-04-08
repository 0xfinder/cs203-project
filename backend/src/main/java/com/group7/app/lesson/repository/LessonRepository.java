package com.group7.app.lesson.repository;

import com.group7.app.lesson.model.Lesson;
import com.group7.app.lesson.model.LessonStatus;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LessonRepository extends JpaRepository<Lesson, Long> {
  List<Lesson> findByStatusOrderByOrderIndexAsc(LessonStatus status);

  List<Lesson> findByUnitIdAndStatusOrderByOrderIndexAsc(Long unitId, LessonStatus status);

  List<Lesson> findByUnitIdOrderByOrderIndexAsc(Long unitId);

  List<Lesson> findByCreatedByOrderByUpdatedAtDescIdDesc(java.util.UUID createdBy);

  List<Lesson> findByCreatedByAndStatusOrderByUpdatedAtDescIdDesc(
      java.util.UUID createdBy, LessonStatus status);

  List<Lesson> findAllByOrderByOrderIndexAsc();

  boolean existsBySlug(String slug);
}
