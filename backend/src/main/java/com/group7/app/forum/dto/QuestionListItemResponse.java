package com.group7.app.forum.dto;

public record QuestionListItemResponse(
    Long id,
    String title,
    String content,
    String author,
    AuthorInfo authorInfo,
    String createdAt,
    long answerCount,
    VoteSummary votes) {}
