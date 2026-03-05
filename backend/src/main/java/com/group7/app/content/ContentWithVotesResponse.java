package com.group7.app.content;

public record ContentWithVotesResponse(
                Content content,
                long thumbsUp,
                long thumbsDown,
                ContentVote.VoteType userVote,
                String submittedByDisplayName) {
}
