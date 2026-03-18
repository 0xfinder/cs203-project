package com.group7.app.lesson.repository;

import com.group7.app.lesson.model.LessonAttempt;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LessonAttemptRepository extends JpaRepository<LessonAttempt, Long> {
    Optional<LessonAttempt> findByIdAndUserId(Long id, UUID userId);
}
