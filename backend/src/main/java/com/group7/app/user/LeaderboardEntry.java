package com.group7.app.user;

import java.util.UUID;

public record LeaderboardEntry(
    UUID userId,
    String displayName,
    String avatarColor,
    String avatarPath,
    Long totalScore,
    Integer lessonsCompleted,
    Integer maxCorrectStreak,
    Double avgTimeSeconds) {}
