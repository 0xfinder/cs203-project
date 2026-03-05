package com.group7.app.lesson.repository;

import com.group7.app.lesson.model.QuestionClozeAnswer;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface QuestionClozeAnswerRepository extends JpaRepository<QuestionClozeAnswer, Long> {
    List<QuestionClozeAnswer> findByQuestionIdOrderByOrderIndexAsc(Long questionId);
}
