package com.group7.app.lesson.repository;

import com.group7.app.lesson.model.Unit;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UnitRepository extends JpaRepository<Unit, Long> {
  List<Unit> findAllByOrderByOrderIndexAsc();

  boolean existsBySlug(String slug);
}
