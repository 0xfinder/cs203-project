package com.group7.app.content;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ContentVoteRepository extends JpaRepository<ContentVote, Long> {

    Optional<ContentVote> findByContentIdAndUserId(Long contentId, UUID userId);

    long countByContentIdAndVoteType(Long contentId, ContentVote.VoteType voteType);

    void deleteByContentIdAndUserId(Long contentId, UUID userId);
}
