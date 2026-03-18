package com.group7.app.forum.dto;

import jakarta.validation.constraints.NotNull;

public record ForumVoteRequest(
        @NotNull String voteType) {
}
