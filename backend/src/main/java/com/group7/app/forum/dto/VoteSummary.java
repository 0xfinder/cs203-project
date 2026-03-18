package com.group7.app.forum.dto;

public record VoteSummary(
        long thumbsUp,
        long thumbsDown,
        String userVote) {
}
