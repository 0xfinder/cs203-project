package com.group7.app.content;

import jakarta.validation.constraints.NotNull;

public record ContentVoteRequest(
        @NotNull ContentVote.VoteType voteType) {
}
