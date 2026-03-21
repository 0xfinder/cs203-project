package com.group7.app.lesson.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.group7.app.user.User;
import com.group7.app.user.UserService;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

@ExtendWith(MockitoExtension.class)
class AuthContextServiceTest {

    @Mock
    private UserService userService;

    private AuthContextService authContextService;

    @BeforeEach
    void setUp() {
        authContextService = new AuthContextService(userService);
    }

    @Test
    void resolveUserReturnsExistingUserWhenPresent() {
        UUID userId = UUID.randomUUID();
        User existing = new User(userId, "learner@example.com");
        when(userService.findById(userId)).thenReturn(Optional.of(existing));

        User resolved = authContextService.resolveUser(jwt(userId, "learner@example.com"));

        assertThat(resolved).isSameAs(existing);
        verify(userService).findById(userId);
    }

    @Test
    void resolveUserCreatesUserWhenMissing() {
        UUID userId = UUID.randomUUID();
        User created = new User(userId, "new@example.com");
        when(userService.findById(userId)).thenReturn(Optional.empty());
        when(userService.createFromAuth(userId, "new@example.com")).thenReturn(created);

        User resolved = authContextService.resolveUser(jwt(userId, "new@example.com"));

        assertThat(resolved).isSameAs(created);
        verify(userService).createFromAuth(userId, "new@example.com");
    }

    @Test
    void resolveUserRejectsMissingSubject() {
        assertThatThrownBy(() -> authContextService.resolveUser(org.springframework.security.oauth2.jwt.Jwt
                .withTokenValue("token")
                .header("alg", "none")
                .claim("email", "user@example.com")
                .build()))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("missing token subject");
    }

    @Test
    void resolveUserRejectsInvalidSubject() {
        assertThatThrownBy(() -> authContextService.resolveUser(org.springframework.security.oauth2.jwt.Jwt
                .withTokenValue("token")
                .header("alg", "none")
                .subject("not-a-uuid")
                .claim("email", "user@example.com")
                .build()))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("invalid token subject");
    }

    @Test
    void resolveUserRejectsMissingEmailClaim() {
        assertThatThrownBy(() -> authContextService.resolveUser(org.springframework.security.oauth2.jwt.Jwt
                .withTokenValue("token")
                .header("alg", "none")
                .subject(UUID.randomUUID().toString())
                .build()))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("missing email claim");
    }

    private org.springframework.security.oauth2.jwt.Jwt jwt(UUID userId, String email) {
        return org.springframework.security.oauth2.jwt.Jwt.withTokenValue("token")
                .header("alg", "none")
                .subject(userId.toString())
                .claim("email", email)
                .build();
    }
}
