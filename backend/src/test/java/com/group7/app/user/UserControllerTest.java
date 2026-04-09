package com.group7.app.user;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.server.ResponseStatusException;

@ExtendWith(MockitoExtension.class)
class UserControllerTest {

  @Mock private UserService userService;

  private UserController userController;

  @BeforeEach
  void setUp() {
    userController = new UserController(userService);
  }

  @Test
  void getMeRejectsMissingAuthentication() {
    assertThatThrownBy(() -> userController.getMe(null))
        .isInstanceOfSatisfying(
            ResponseStatusException.class,
            ex -> {
              assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
              assertThat(ex.getReason()).isEqualTo("missing authentication");
            });
  }

  @Test
  void getMeRejectsInvalidTokenSubject() {
    assertThatThrownBy(() -> userController.getMe(jwt("not-a-uuid", "user@example.com")))
        .isInstanceOfSatisfying(
            ResponseStatusException.class,
            ex -> {
              assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
              assertThat(ex.getReason()).isEqualTo("invalid token subject");
            });
  }

  @Test
  void getMeRejectsMissingTokenSubject() {
    assertThatThrownBy(() -> userController.getMe(jwt(" ", "user@example.com")))
        .isInstanceOfSatisfying(
            ResponseStatusException.class,
            ex -> {
              assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
              assertThat(ex.getReason()).isEqualTo("missing token subject");
            });
  }

  @Test
  void getMeReturnsExistingUserWithoutBootstrapping() {
    UUID userId = UUID.randomUUID();
    User existing = new User(userId, "user@example.com");
    existing.setDisplayName("Kai");

    when(userService.findById(userId)).thenReturn(Optional.of(existing));
    when(userService.isOnboardingCompleted(existing)).thenReturn(false);

    UserMeResponse response = userController.getMe(jwt(userId.toString(), "user@example.com"));

    assertThat(response.displayName()).isEqualTo("Kai");
  }

  @Test
  void getMeRequiresEmailWhenCreatingMissingUser() {
    UUID userId = UUID.randomUUID();
    when(userService.findById(userId)).thenReturn(Optional.empty());

    assertThatThrownBy(() -> userController.getMe(jwt(userId.toString(), " ")))
        .isInstanceOfSatisfying(
            ResponseStatusException.class,
            ex -> {
              assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
              assertThat(ex.getReason()).isEqualTo("missing email claim");
            });
  }

  @Test
  void updateMeRejectsTooShortDisplayName() {
    UUID userId = UUID.randomUUID();
    User existing = new User(userId, "user@example.com");
    when(userService.findById(userId)).thenReturn(Optional.of(existing));

    assertThatThrownBy(
            () ->
                userController.updateMe(
                    jwt(userId.toString(), "user@example.com"),
                    new UpdateMeRequest(" a ", null, null, null, null, null, null)))
        .isInstanceOfSatisfying(
            ResponseStatusException.class,
            ex -> {
              assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
              assertThat(ex.getReason()).contains("displayName must be 2 to 32 characters");
            });
  }

  @Test
  void updateMeRejectsAvatarPathOutsideUserFolder() {
    UUID userId = UUID.randomUUID();
    User existing = new User(userId, "user@example.com");
    when(userService.findById(userId)).thenReturn(Optional.of(existing));

    assertThatThrownBy(
            () ->
                userController.updateMe(
                    jwt(userId.toString(), "user@example.com"),
                    new UpdateMeRequest(
                        "AlphaKid",
                        null,
                        null,
                        null,
                        null,
                        null,
                        "uploads/another-user/avatar.png")))
        .isInstanceOfSatisfying(
            ResponseStatusException.class,
            ex -> {
              assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
              assertThat(ex.getReason())
                  .contains("avatarPath must be in the authenticated user's uploads path");
            });
  }

  @Test
  void updateMeNormalizesOptionalFieldsAndMapsRoleIntent() {
    UUID userId = UUID.randomUUID();
    User existing = new User(userId, "user@example.com");
    existing.setRole(Role.LEARNER);
    User updated = new User(userId, "user@example.com");
    updated.setDisplayName("AlphaKid");
    updated.setRole(Role.CONTRIBUTOR);

    when(userService.findById(userId)).thenReturn(Optional.of(existing));
    when(userService.updateProfile(
            eq(userId),
            eq("AlphaKid"),
            eq(Role.CONTRIBUTOR),
            eq(null),
            eq(15),
            eq("non-binary"),
            eq(null),
            eq(null)))
        .thenReturn(updated);
    when(userService.isOnboardingCompleted(updated)).thenReturn(true);

    UserMeResponse response =
        userController.updateMe(
            jwt(userId.toString(), "user@example.com"),
            new UpdateMeRequest(
                " AlphaKid ",
                UpdateMeRequest.RoleIntent.CONTRIBUTOR,
                "   ",
                15,
                " non-binary ",
                " ",
                " "));

    assertThat(response.displayName()).isEqualTo("AlphaKid");
    assertThat(response.role()).isEqualTo(Role.CONTRIBUTOR);
    verify(userService)
        .updateProfile(userId, "AlphaKid", Role.CONTRIBUTOR, null, 15, "non-binary", null, null);
  }

  @Test
  void updateMeKeepsExistingRoleWhenRoleIntentIsMissing() {
    UUID userId = UUID.randomUUID();
    User existing = new User(userId, "user@example.com");
    existing.setRole(Role.MODERATOR);
    User updated = new User(userId, "user@example.com");
    updated.setDisplayName("AlphaKid");
    updated.setRole(Role.MODERATOR);

    when(userService.findById(userId)).thenReturn(Optional.of(existing));
    when(userService.updateProfile(
            eq(userId),
            eq("AlphaKid"),
            eq(Role.MODERATOR),
            eq("bio"),
            eq(null),
            eq(null),
            eq("#112233"),
            eq("uploads/" + userId + "/avatar.png")))
        .thenReturn(updated);
    when(userService.isOnboardingCompleted(updated)).thenReturn(true);

    UserMeResponse response =
        userController.updateMe(
            jwt(userId.toString(), "user@example.com"),
            new UpdateMeRequest(
                "AlphaKid",
                null,
                " bio ",
                null,
                null,
                "#112233",
                "uploads/" + userId + "/avatar.png"));

    assertThat(response.role()).isEqualTo(Role.MODERATOR);
  }

  private Jwt jwt(String subject, String email) {
    return Jwt.withTokenValue("token")
        .header("alg", "none")
        .subject(subject)
        .claim("email", email)
        .build();
  }
}
