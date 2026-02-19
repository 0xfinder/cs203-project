package com.group7.app.content;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface ContentRepository extends JpaRepository<Content, Long> {

    // Find all contents with a specific status (PENDING, APPROVED, REJECTED)
    List<Content> findByStatus(Content.Status status);

    // Optional: find by term to prevent duplicates
    Optional<Content> findByTerm(String term);
}
