package com.group7.app.lesson.repository;

import com.group7.app.lesson.model.Lesson;
import com.group7.app.lesson.model.LessonStatus;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LessonRepository extends JpaRepository<Lesson, Long> {
    List<Lesson> findByStatusOrderByOrderIndexAsc(LessonStatus status);

    List<Lesson> findByUnitIdAndStatusOrderByOrderIndexAsc(Long unitId, LessonStatus status);

    List<Lesson> findByUnitIdOrderByOrderIndexAsc(Long unitId);

    List<Lesson> findAllByOrderByOrderIndexAsc();
}
