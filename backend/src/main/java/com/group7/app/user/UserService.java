package com.group7.app.user;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class UserService {

  private static final int AUTH_SYNC_RETRY_ATTEMPTS = 6;
  private static final long AUTH_SYNC_RETRY_DELAY_MS = 100L;

  private final UserRepository userRepository;

  public UserService(UserRepository userRepository) {
    this.userRepository = userRepository;
  }

  public List<User> findAll() {
    return userRepository.findAll();
  }

  public Optional<User> findById(UUID id) {
    return userRepository.findById(id);
  }

  public Optional<User> findByEmail(String email) {
    return userRepository.findByEmailIgnoreCase(email);
  }

  public boolean existsByEmail(String email) {
    return userRepository.existsByEmailIgnoreCase(email);
  }

  @Transactional(propagation = Propagation.NOT_SUPPORTED)
  public User createFromAuth(UUID id, String email) {
    try {
      return userRepository.saveAndFlush(new User(id, email));
    } catch (DataIntegrityViolationException ex) {
      return awaitUserRow(id, email, ex);
    }
  }

  @Transactional
  public User updateProfile(
      UUID id,
      String displayName,
      Role role,
      String bio,
      Integer age,
      String gender,
      String avatarColor,
      String avatarPath) {
    User user = userRepository.findById(id).orElseThrow();
    user.setDisplayName(displayName);
    user.setRole(role);
    user.setBio(bio);
    user.setAge(age);
    user.setGender(gender);
    user.setAvatarColor(avatarColor);
    user.setAvatarPath(avatarPath);
    return userRepository.save(user);
  }

  public boolean isOnboardingCompleted(User user) {
    String displayName = user.getDisplayName();
    return displayName != null && !displayName.trim().isEmpty();
  }

  @Transactional
  public User save(User user) {
    return userRepository.save(user);
  }

  private User awaitUserRow(UUID id, String email, DataIntegrityViolationException originalError) {
    for (int attempt = 0; attempt < AUTH_SYNC_RETRY_ATTEMPTS; attempt++) {
      Optional<User> existing = userRepository.findById(id);
      if (existing.isPresent()) {
        return existing.get();
      }

      Optional<User> existingByEmail =
          userRepository.findByEmailIgnoreCase(email).filter(user -> id.equals(user.getId()));
      if (existingByEmail.isPresent()) {
        return existingByEmail.get();
      }

      if (attempt + 1 < AUTH_SYNC_RETRY_ATTEMPTS) {
        sleepBeforeRetry();
      }
    }

    throw originalError;
  }

  private void sleepBeforeRetry() {
    try {
      Thread.sleep(AUTH_SYNC_RETRY_DELAY_MS);
    } catch (InterruptedException ex) {
      Thread.currentThread().interrupt();
      throw new IllegalStateException("Interrupted while waiting for auth user sync", ex);
    }
  }
}
