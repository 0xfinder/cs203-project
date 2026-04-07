package com.group7.app.forum.dto;

import java.util.List;

public record ForumQuestionPageResponse(
    List<QuestionListItemResponse> items,
    int page,
    int size,
    long totalItems,
    int totalPages,
    boolean hasNext) {}
