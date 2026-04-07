package com.group7.app.forum.repository;

import com.group7.app.forum.model.AnswerVote;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface AnswerVoteRepository extends JpaRepository<AnswerVote, Long> {
  Optional<AnswerVote> findByAnswerIdAndUserId(Long answerId, UUID userId);

  long countByAnswerIdAndVoteType(Long answerId, AnswerVote.VoteType voteType);

  List<AnswerVote> findAllByAnswerIdInAndUserId(Collection<Long> answerIds, UUID userId);

  @Query(
      """
      select v.answer.id as answerId, v.voteType as voteType, count(v) as voteCount
      from AnswerVote v
      where v.answer.id in :answerIds
      group by v.answer.id, v.voteType
      """)
  List<AnswerVoteCountView> summarizeByAnswerIds(Collection<Long> answerIds);

  void deleteByAnswerIdAndUserId(Long answerId, UUID userId);

  interface AnswerVoteCountView {
    Long getAnswerId();

    AnswerVote.VoteType getVoteType();

    long getVoteCount();
  }
}
