package com.group7.app.forum.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record PostQuestionRequest(
    @NotBlank @Size(max = 160) String title, @NotBlank String content) {}
