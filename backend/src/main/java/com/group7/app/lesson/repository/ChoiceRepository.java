package com.group7.app.lesson.repository;

import com.group7.app.lesson.model.Choice;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ChoiceRepository extends JpaRepository<Choice, Long> {
    List<Choice> findByQuestionIdOrderByOrderIndexAsc(Long questionId);

    List<Choice> findByQuestionIdIn(Collection<Long> questionIds);
}
