package com.group7.app.user;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;

@ExtendWith(MockitoExtension.class)
class UserServiceTest {

  @Mock private UserRepository userRepository;

  private UserService userService;

  @BeforeEach
  void setUp() {
    userService = new UserService(userRepository);
  }

  @Test
  void createFromAuthReturnsSavedUser() {
    UUID userId = UUID.randomUUID();
    User saved = new User(userId, "user@example.com");
    when(userRepository.save(any(User.class))).thenReturn(saved);

    User created = userService.createFromAuth(userId, "user@example.com");

    assertThat(created).isSameAs(saved);
  }

  @Test
  void createFromAuthReturnsExistingUserAfterRaceCondition() {
    UUID userId = UUID.randomUUID();
    User existing = new User(userId, "user@example.com");
    when(userRepository.save(any(User.class)))
        .thenThrow(new DataIntegrityViolationException("duplicate"));
    when(userRepository.findById(userId)).thenReturn(Optional.of(existing));

    User created = userService.createFromAuth(userId, "user@example.com");

    assertThat(created).isSameAs(existing);
  }

  @Test
  void updateProfilePersistsAllEditableFields() {
    UUID userId = UUID.randomUUID();
    User user = new User(userId, "user@example.com");
    when(userRepository.findById(userId)).thenReturn(Optional.of(user));
    when(userRepository.save(user)).thenReturn(user);

    User updated =
        userService.updateProfile(
            userId,
            "display",
            Role.CONTRIBUTOR,
            "bio",
            18,
            "non-binary",
            "#112233",
            "uploads/" + userId + "/avatar.png");

    assertThat(updated.getDisplayName()).isEqualTo("display");
    assertThat(updated.getRole()).isEqualTo(Role.CONTRIBUTOR);
    assertThat(updated.getBio()).isEqualTo("bio");
    assertThat(updated.getAge()).isEqualTo(18);
    assertThat(updated.getGender()).isEqualTo("non-binary");
    assertThat(updated.getAvatarColor()).isEqualTo("#112233");
    assertThat(updated.getAvatarPath()).endsWith("/avatar.png");
    verify(userRepository).save(user);
  }

  @Test
  void isOnboardingCompletedRequiresNonBlankDisplayName() {
    User user = new User(UUID.randomUUID(), "user@example.com");
    user.setDisplayName("  ");
    assertThat(userService.isOnboardingCompleted(user)).isFalse();

    user.setDisplayName("Alpha");
    assertThat(userService.isOnboardingCompleted(user)).isTrue();
  }
}
