package com.group7.app.user;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class UserService {

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

    @Transactional
    public User createFromAuth(UUID id, String email) {
        try {
            return userRepository.save(new User(id, email));
        } catch (DataIntegrityViolationException ex) {
            return userRepository.findById(id).orElseThrow(() -> ex);
        }
    }

    @Transactional
    public User updateProfile(UUID id, String displayName, Role role) {
        User user = userRepository.findById(id).orElseThrow();
        user.setDisplayName(displayName);
        user.setRole(role);
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
}
