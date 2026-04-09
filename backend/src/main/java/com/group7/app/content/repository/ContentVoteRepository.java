package com.group7.app.content.repository;

import com.group7.app.content.model.ContentVote;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface ContentVoteRepository extends JpaRepository<ContentVote, Long> {

  Optional<ContentVote> findByContentIdAndUserId(Long contentId, UUID userId);

  long countByContentIdAndVoteType(Long contentId, ContentVote.VoteType voteType);

  List<ContentVote> findAllByContentIdInAndUserId(Collection<Long> contentIds, UUID userId);

  @Query(
      """
      select v.content.id as contentId, v.voteType as voteType, count(v) as voteCount
      from ContentVote v
      where v.content.id in :contentIds
      group by v.content.id, v.voteType
      """)
  List<ContentVoteCountView> summarizeByContentIds(Collection<Long> contentIds);

  void deleteAllByContentId(Long contentId);

  void deleteByContentIdAndUserId(Long contentId, UUID userId);

  interface ContentVoteCountView {
    Long getContentId();

    ContentVote.VoteType getVoteType();

    long getVoteCount();
  }
}
