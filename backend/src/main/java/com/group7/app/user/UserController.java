package com.group7.app.user;

import java.util.UUID;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping("/me")
    public UserMeResponse getMe(@AuthenticationPrincipal Jwt jwt) {
        UUID userId = parseUserId(jwt);
        User user = userService.findById(userId)
                .orElseGet(() -> userService.createFromAuth(userId, getEmail(jwt)));
        return UserMeResponse.fromUser(user, userService.isOnboardingCompleted(user));
    }

    @PatchMapping("/me")
    public UserMeResponse updateMe(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody UpdateMeRequest request) {
        UUID userId = parseUserId(jwt);
        userService.findById(userId)
                .orElseGet(() -> userService.createFromAuth(userId, getEmail(jwt)));

        String displayName = request.displayName().trim();
        if (displayName.length() < 2 || displayName.length() > 32) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "displayName must be 2 to 32 characters after trimming");
        }

        Role role = switch (request.roleIntent()) {
            case LEARNER -> Role.LEARNER;
            case CONTRIBUTOR -> Role.CONTRIBUTOR;
        };

        User updated = userService.updateProfile(userId, displayName, role);
        return UserMeResponse.fromUser(updated, userService.isOnboardingCompleted(updated));
    }

    private static UUID parseUserId(Jwt jwt) {
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
}
