package com.group7.app.lesson.repository;

import com.group7.app.lesson.model.UserVocabMemory;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserVocabMemoryRepository extends JpaRepository<UserVocabMemory, Long> {
  List<UserVocabMemory> findByUserIdAndNextDueAtLessThanEqualOrderByNextDueAtAsc(
      UUID userId, Instant now, Pageable pageable);

  Optional<UserVocabMemory> findByUserIdAndVocabItemId(UUID userId, Long vocabItemId);
}
