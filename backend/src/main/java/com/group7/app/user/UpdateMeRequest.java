package com.group7.app.user;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record UpdateMeRequest(
        @NotBlank @Size(min = 2, max = 32) String displayName,
        @NotNull RoleIntent roleIntent) {

    public enum RoleIntent {
        LEARNER,
        CONTRIBUTOR
    }
}
