package com.group7.app.forum.dto;

public record AnswerResponse(
        Long id,
        String content,
        String author,
        AuthorInfo authorInfo,
        String createdAt,
        VoteSummary votes) {
}
