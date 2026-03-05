package com.group7.app.user;

import java.util.UUID;

public record UserMeResponse(
        UUID id,
        String email,
        String displayName,
        String bio,
        Integer age,
        String gender,
        String avatarColor,
        String avatarPath,
        Role role,
        boolean onboardingCompleted) {

    public static UserMeResponse fromUser(User user, boolean onboardingCompleted) {
        return new UserMeResponse(
                user.getId(),
                user.getEmail(),
                user.getDisplayName(),
                user.getBio(),
                user.getAge(),
                user.getGender(),
                user.getAvatarColor(),
                user.getAvatarPath(),
                user.getRole(),
                onboardingCompleted);
    }
}
