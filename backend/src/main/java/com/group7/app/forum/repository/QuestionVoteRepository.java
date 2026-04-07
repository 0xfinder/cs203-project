package com.group7.app.forum.repository;

import com.group7.app.forum.model.QuestionVote;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface QuestionVoteRepository extends JpaRepository<QuestionVote, Long> {
  Optional<QuestionVote> findByQuestionIdAndUserId(Long questionId, UUID userId);

  long countByQuestionIdAndVoteType(Long questionId, QuestionVote.VoteType voteType);

  List<QuestionVote> findAllByQuestionIdInAndUserId(Collection<Long> questionIds, UUID userId);

  @Query(
      """
      select v.question.id as questionId, v.voteType as voteType, count(v) as voteCount
      from QuestionVote v
      where v.question.id in :questionIds
      group by v.question.id, v.voteType
      """)
  List<QuestionVoteCountView> summarizeByQuestionIds(Collection<Long> questionIds);

  void deleteByQuestionIdAndUserId(Long questionId, UUID userId);

  interface QuestionVoteCountView {
    Long getQuestionId();

    QuestionVote.VoteType getVoteType();

    long getVoteCount();
  }
}
