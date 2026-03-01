package com.group7.app.user;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record UpdateMeRequest(
        @NotBlank @Size(min = 2, max = 32) String displayName,
        RoleIntent roleIntent,
        @Size(max = 280) String bio,
        @Min(0) @Max(130) Integer age,
        @Size(max = 40) String gender,
        @Pattern(regexp = "^#(?:[0-9a-fA-F]{6})$", message = "avatarColor must be a hex color")
        String avatarColor,
        @Size(max = 512) String avatarPath) {

    public enum RoleIntent {
        LEARNER,
        CONTRIBUTOR
    }
}
