package com.group7.app.forum.repository;

import com.group7.app.forum.model.Answer;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface AnswerRepository extends JpaRepository<Answer, Long> {
  List<Answer> findByQuestionIdOrderByCreatedAtAsc(Long questionId);

  @Query(
      """
      select a.question.id as questionId, count(a) as answerCount
      from Answer a
      where a.question.id in :questionIds
      group by a.question.id
      """)
  List<QuestionAnswerCountView> countByQuestionIds(Collection<Long> questionIds);

  interface QuestionAnswerCountView {
    Long getQuestionId();

    long getAnswerCount();
  }
}
