package com.group7.app.lesson.repository;

import com.group7.app.lesson.model.VocabItem;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface VocabItemRepository extends JpaRepository<VocabItem, Long> {
  Optional<VocabItem> findByTermIgnoreCase(String term);

  List<VocabItem> findByIdIn(Collection<Long> ids);
}
