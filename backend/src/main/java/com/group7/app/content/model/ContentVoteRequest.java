package com.group7.app.content.model;

import jakarta.validation.constraints.NotNull;

public record ContentVoteRequest(
                @NotNull ContentVote.VoteType voteType) {
}
