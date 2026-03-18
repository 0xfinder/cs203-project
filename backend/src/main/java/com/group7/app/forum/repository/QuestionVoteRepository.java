package com.group7.app.forum.repository;

import com.group7.app.forum.model.QuestionVote;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface QuestionVoteRepository extends JpaRepository<QuestionVote, Long> {
    Optional<QuestionVote> findByQuestionIdAndUserId(Long questionId, UUID userId);
    long countByQuestionIdAndVoteType(Long questionId, QuestionVote.VoteType voteType);
    void deleteByQuestionIdAndUserId(Long questionId, UUID userId);
}
