package com.group7.app.forum.dto;

import jakarta.validation.constraints.NotBlank;

public record PostAnswerRequest(@NotBlank String content) {}
