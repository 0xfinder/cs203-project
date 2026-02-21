package com.group7.app.user;

import java.util.UUID;

public record UserMeResponse(
        UUID id,
        String email,
        String displayName,
        Role role,
        boolean onboardingCompleted) {

    public static UserMeResponse fromUser(User user, boolean onboardingCompleted) {
        return new UserMeResponse(
                user.getId(),
                user.getEmail(),
                user.getDisplayName(),
                user.getRole(),
                onboardingCompleted);
    }
}
