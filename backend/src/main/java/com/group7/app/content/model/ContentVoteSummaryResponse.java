package com.group7.app.content.model;

public record ContentVoteSummaryResponse(
                Long contentId,
                long thumbsUp,
                long thumbsDown,
                ContentVote.VoteType userVote) {
}
