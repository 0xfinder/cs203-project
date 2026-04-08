package com.group7.app.forum.dto;

import java.util.List;

public record QuestionResponse(
    Long id,
    String title,
    String content,
    String author,
    AuthorInfo authorInfo,
    String createdAt,
    long answerCount,
    List<AnswerResponse> answers,
    VoteSummary votes,
    boolean resolved) {}
