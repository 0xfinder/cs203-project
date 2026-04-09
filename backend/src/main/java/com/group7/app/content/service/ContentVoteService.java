package com.group7.app.content.service;

import com.group7.app.content.model.Content;
import com.group7.app.content.model.ContentVote;
import com.group7.app.content.model.ContentVoteSummaryResponse;
import com.group7.app.content.model.ContentWithVotesResponse;
import com.group7.app.content.repository.ContentRepository;
import com.group7.app.content.repository.ContentVoteRepository;
import com.group7.app.user.User;
import com.group7.app.user.UserRepository;
import java.util.Collection;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ContentVoteService {

  private final ContentVoteRepository contentVoteRepository;
  private final ContentRepository contentRepository;
  private final UserRepository userRepository;

  public ContentVoteService(
      ContentVoteRepository contentVoteRepository,
      ContentRepository contentRepository,
      UserRepository userRepository) {
    this.contentVoteRepository = contentVoteRepository;
    this.contentRepository = contentRepository;
    this.userRepository = userRepository;
  }

  @Transactional
  public ContentVoteSummaryResponse castVote(
      Long contentId, UUID userId, ContentVote.VoteType voteType) {
    Content content =
        contentRepository
            .findById(contentId)
            .orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Content not found"));
    User user =
        userRepository
            .findById(userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

    ContentVote vote =
        contentVoteRepository
            .findByContentIdAndUserId(contentId, userId)
            .map(
                existing -> {
                  existing.setVoteType(voteType);
                  return existing;
                })
            .orElseGet(() -> new ContentVote(content, user, voteType));

    contentVoteRepository.save(vote);
    return buildSummary(contentId, userId);
  }

  @Transactional
  public ContentVoteSummaryResponse clearVote(Long contentId, UUID userId) {
    ensureContentExists(contentId);
    contentVoteRepository.deleteByContentIdAndUserId(contentId, userId);
    return buildSummary(contentId, userId);
  }

  @Transactional(readOnly = true)
  public ContentVoteSummaryResponse getSummary(Long contentId, UUID userId) {
    ensureContentExists(contentId);
    return buildSummary(contentId, userId);
  }

  @Transactional(readOnly = true)
  public List<ContentWithVotesResponse> getApprovedContentsWithVotes(UUID userId) {
    return mapContentWithVotes(contentRepository.findByStatus(Content.Status.APPROVED), userId);
  }

  @Transactional(readOnly = true)
  public List<ContentWithVotesResponse> getApprovedContentsWithVotesForSubmitter(
      UUID userId, String submittedBy) {
    return mapContentWithVotes(
        contentRepository.findByStatusAndSubmittedByIgnoreCase(
            Content.Status.APPROVED, submittedBy),
        userId);
  }

  private void ensureContentExists(Long contentId) {
    if (!contentRepository.existsById(contentId)) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Content not found");
    }
  }

  private List<ContentWithVotesResponse> mapContentWithVotes(List<Content> contents, UUID userId) {
    if (contents.isEmpty()) {
      return List.of();
    }

    List<Long> contentIds = contents.stream().map(Content::getId).toList();
    Map<Long, Map<ContentVote.VoteType, Long>> voteCountsByContentId =
        buildVoteCountsByContentId(contentIds);
    Map<Long, ContentVote.VoteType> userVotesByContentId =
        buildUserVotesByContentId(contentIds, userId);
    Map<String, User> usersByLowercaseEmail = buildUsersByLowercaseEmail(contents);

    return contents.stream()
        .map(
            content -> {
              Map<ContentVote.VoteType, Long> voteCounts =
                  voteCountsByContentId.getOrDefault(content.getId(), Collections.emptyMap());
              User submitter = usersByLowercaseEmail.get(normalizeEmail(content.getSubmittedBy()));
              String displayName = resolveDisplayName(content.getSubmittedBy(), submitter);
              return new ContentWithVotesResponse(
                  content,
                  voteCounts.getOrDefault(ContentVote.VoteType.THUMBS_UP, 0L),
                  voteCounts.getOrDefault(ContentVote.VoteType.THUMBS_DOWN, 0L),
                  userVotesByContentId.get(content.getId()),
                  displayName);
            })
        .toList();
  }

  private ContentVoteSummaryResponse buildSummary(Long contentId, UUID userId) {
    long thumbsUp =
        contentVoteRepository.countByContentIdAndVoteType(
            contentId, ContentVote.VoteType.THUMBS_UP);
    long thumbsDown =
        contentVoteRepository.countByContentIdAndVoteType(
            contentId, ContentVote.VoteType.THUMBS_DOWN);
    ContentVote.VoteType userVote =
        userId == null
            ? null
            : contentVoteRepository
                .findByContentIdAndUserId(contentId, userId)
                .map(ContentVote::getVoteType)
                .orElse(null);
    return new ContentVoteSummaryResponse(contentId, thumbsUp, thumbsDown, userVote);
  }

  private Map<Long, Map<ContentVote.VoteType, Long>> buildVoteCountsByContentId(
      Collection<Long> contentIds) {
    return contentVoteRepository.summarizeByContentIds(contentIds).stream()
        .collect(
            Collectors.groupingBy(
                ContentVoteRepository.ContentVoteCountView::getContentId,
                Collectors.toMap(
                    ContentVoteRepository.ContentVoteCountView::getVoteType,
                    ContentVoteRepository.ContentVoteCountView::getVoteCount)));
  }

  private Map<Long, ContentVote.VoteType> buildUserVotesByContentId(
      Collection<Long> contentIds, UUID userId) {
    if (userId == null) {
      return Map.of();
    }
    return contentVoteRepository.findAllByContentIdInAndUserId(contentIds, userId).stream()
        .collect(Collectors.toMap(vote -> vote.getContent().getId(), ContentVote::getVoteType));
  }

  private Map<String, User> buildUsersByLowercaseEmail(List<Content> contents) {
    List<String> submittedByEmails =
        contents.stream()
            .map(Content::getSubmittedBy)
            .map(ContentVoteService::normalizeEmail)
            .distinct()
            .toList();
    return userRepository.findAllByEmailLowercaseIn(submittedByEmails).stream()
        .collect(Collectors.toMap(user -> normalizeEmail(user.getEmail()), Function.identity()));
  }

  private static String resolveDisplayName(String submittedBy, User submitter) {
    if (submitter == null || submitter.getDisplayName() == null) {
      return submittedBy;
    }
    return submitter.getDisplayName();
  }

  private static String normalizeEmail(String email) {
    return email.toLowerCase(Locale.ROOT);
  }
}
