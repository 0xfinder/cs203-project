package com.group7.app.lesson.repository;

import com.group7.app.lesson.model.LessonQuestion;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LessonQuestionRepository extends JpaRepository<LessonQuestion, Long> {
}
