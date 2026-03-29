package com.group7.app.lesson.controller;

import com.group7.app.lesson.model.VocabItem;
import com.group7.app.lesson.repository.VocabItemRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.util.Optional;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/vocab")
@Tag(name = "Vocab", description = "Vocab items for TEACH steps")
public class VocabController {

  private final VocabItemRepository vocabItemRepository;

  public VocabController(VocabItemRepository vocabItemRepository) {
    this.vocabItemRepository = vocabItemRepository;
  }

  public static record CreateVocabRequest(
      @NotBlank String term, @NotBlank String definition, String example, String partOfSpeech) {}

  @PostMapping
  @Operation(summary = "Create a vocab item")
  public ResponseEntity<VocabItem> createVocab(@Valid @RequestBody CreateVocabRequest req) {
    String term = req.term().trim();
    // If vocab already exists for this term (case-insensitive), return it instead of failing.
    Optional<VocabItem> existing = vocabItemRepository.findByTermIgnoreCase(term);
    if (existing.isPresent()) {
      return ResponseEntity.ok(existing.get());
    }

    VocabItem item =
        new VocabItem(term, req.definition().trim(), req.example(), req.partOfSpeech());
    try {
      VocabItem saved = vocabItemRepository.save(item);
      return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    } catch (DataIntegrityViolationException dive) {
      // Handle race where another request inserted the same term concurrently.
      Optional<VocabItem> retry = vocabItemRepository.findByTermIgnoreCase(term);
      if (retry.isPresent()) {
        return ResponseEntity.ok(retry.get());
      }
      throw dive;
    }
  }
}
