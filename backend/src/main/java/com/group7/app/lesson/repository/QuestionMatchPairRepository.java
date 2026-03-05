package com.group7.app.lesson.repository;

import com.group7.app.lesson.model.QuestionMatchPair;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface QuestionMatchPairRepository extends JpaRepository<QuestionMatchPair, Long> {
    List<QuestionMatchPair> findByQuestionIdOrderByOrderIndexAsc(Long questionId);
}
