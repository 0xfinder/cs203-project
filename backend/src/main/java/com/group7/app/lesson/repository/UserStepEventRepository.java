package com.group7.app.lesson.repository;

import com.group7.app.lesson.model.UserStepEvent;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserStepEventRepository extends JpaRepository<UserStepEvent, Long> {
  List<UserStepEvent> findByUserIdAndEventTypeOrderByCreatedAtAsc(UUID userId, String eventType);
}
