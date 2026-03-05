package com.group7.app.lesson.repository;

import com.group7.app.lesson.model.Question;
import org.springframework.data.jpa.repository.JpaRepository;

public interface QuestionRepository extends JpaRepository<Question, Long> {
}
