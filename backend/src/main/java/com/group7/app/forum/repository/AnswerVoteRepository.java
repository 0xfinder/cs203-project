package com.group7.app.forum.repository;

import com.group7.app.forum.model.AnswerVote;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AnswerVoteRepository extends JpaRepository<AnswerVote, Long> {
  Optional<AnswerVote> findByAnswerIdAndUserId(Long answerId, UUID userId);

  long countByAnswerIdAndVoteType(Long answerId, AnswerVote.VoteType voteType);

  void deleteByAnswerIdAndUserId(Long answerId, UUID userId);
}
