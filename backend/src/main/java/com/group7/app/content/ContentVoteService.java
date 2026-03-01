package com.group7.app.content;

import com.group7.app.user.User;
import com.group7.app.user.UserRepository;
import java.util.List;
import java.util.UUID;
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
            Long contentId,
            UUID userId,
            ContentVote.VoteType voteType) {
        Content content = contentRepository.findById(contentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Content not found"));
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        ContentVote vote = contentVoteRepository
                .findByContentIdAndUserId(contentId, userId)
                .map(existing -> {
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
        return contentRepository.findByStatus(Content.Status.APPROVED).stream()
                .map(content -> {
                    ContentVoteSummaryResponse summary = buildSummary(content.getId(), userId);
                    String displayName = userRepository.findByEmailIgnoreCase(content.getSubmittedBy())
                            .map(user -> user.getDisplayName() != null ? user.getDisplayName()
                                    : content.getSubmittedBy())
                            .orElse(content.getSubmittedBy());
                    return new ContentWithVotesResponse(
                            content,
                            summary.thumbsUp(),
                            summary.thumbsDown(),
                            summary.userVote(),
                            displayName);
                })
                .toList();
    }

    private void ensureContentExists(Long contentId) {
        if (!contentRepository.existsById(contentId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Content not found");
        }
    }

    private ContentVoteSummaryResponse buildSummary(Long contentId, UUID userId) {
        long thumbsUp = contentVoteRepository.countByContentIdAndVoteType(
                contentId,
                ContentVote.VoteType.THUMBS_UP);
        long thumbsDown = contentVoteRepository.countByContentIdAndVoteType(
                contentId,
                ContentVote.VoteType.THUMBS_DOWN);
        ContentVote.VoteType userVote = contentVoteRepository
                .findByContentIdAndUserId(contentId, userId)
                .map(ContentVote::getVoteType)
                .orElse(null);
        return new ContentVoteSummaryResponse(contentId, thumbsUp, thumbsDown, userVote);
    }
}
