package com.group7.app.user;

import java.util.UUID;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.GetMapping;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/users")
@Tag(name = "Users", description = "User profile and onboarding endpoints")
public class UserController {

    private final UserService userService;
    private static final Logger log = LoggerFactory.getLogger(UserController.class);

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping("/me")
    @Operation(summary = "Get current user profile")
    public UserMeResponse getMe(@AuthenticationPrincipal Jwt jwt) {
        UUID userId = parseUserId(jwt);
        User user = userService.findById(userId)
                .orElseGet(() -> userService.createFromAuth(userId, getEmail(jwt)));
        return UserMeResponse.fromUser(user, userService.isOnboardingCompleted(user));
    }

    @PatchMapping("/me")
    @Operation(summary = "Update current user profile")
    public UserMeResponse updateMe(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody UpdateMeRequest request) {
        UUID userId = parseUserId(jwt);
        User user = userService.findById(userId)
                .orElseGet(() -> userService.createFromAuth(userId, getEmail(jwt)));

        String displayName = request.displayName().trim();
        if (displayName.length() < 2 || displayName.length() > 32) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "displayName must be 2 to 32 characters after trimming");
        }

        Role role = user.getRole();
        if (request.roleIntent() != null) {
            role = switch (request.roleIntent()) {
                case LEARNER -> Role.LEARNER;
                case CONTRIBUTOR -> Role.CONTRIBUTOR;
            };
        }

        String avatarPath = normalizeOptional(request.avatarPath());
        if (avatarPath != null && !avatarPath.startsWith("uploads/" + userId + "/")) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "avatarPath must be in the authenticated user's uploads path");
        }

        User updated = userService.updateProfile(
                userId,
                displayName,
                role,
                normalizeOptional(request.bio()),
                request.age(),
                normalizeOptional(request.gender()),
                normalizeOptional(request.avatarColor()),
                avatarPath);
        return UserMeResponse.fromUser(updated, userService.isOnboardingCompleted(updated));
    }

    @PostMapping("/me/dev-role")
    @Operation(summary = "Dev: set current user's role (dev only)")
    public UserMeResponse setMyRoleDev(@AuthenticationPrincipal Jwt jwt, @RequestParam String role) {
        // Only allow when explicitly enabled via environment variable for safety
        String allow = System.getenv("ALLOW_DEV_ROLE_CHANGE");
        if (!"true".equalsIgnoreCase(allow)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Dev role changes are disabled");
        }

        UUID userId = parseUserId(jwt);
        User user = userService.findById(userId).orElseGet(() -> userService.createFromAuth(userId, getEmail(jwt)));

        Role newRole;
        try {
            newRole = Role.valueOf(role.trim().toUpperCase());
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid role");
        }

        user.setRole(newRole);
        User updated;
        try {
            updated = userService.save(user);
        } catch (Exception ex) {
            log.error("Failed to save user while setting dev role", ex);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to set role: " + ex.getMessage());
        }
        return UserMeResponse.fromUser(updated, userService.isOnboardingCompleted(updated));
    }

    private static UUID parseUserId(Jwt jwt) {
        if (jwt == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "missing authentication");
        }
        String subject = jwt.getSubject();
        if (subject == null || subject.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "missing token subject");
        }
        try {
            return UUID.fromString(subject);
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "invalid token subject");
        }
    }

    private static String getEmail(Jwt jwt) {
        String email = jwt.getClaimAsString("email");
        if (email == null || email.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "missing email claim");
        }
        return email;
    }

    private static String normalizeOptional(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
