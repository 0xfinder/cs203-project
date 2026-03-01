package com.group7.app.content;

public record ContentVoteSummaryResponse(
        Long contentId,
        long thumbsUp,
        long thumbsDown,
        ContentVote.VoteType userVote) {
}
