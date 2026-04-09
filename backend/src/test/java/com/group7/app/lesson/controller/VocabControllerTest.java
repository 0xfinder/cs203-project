package com.group7.app.lesson.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

import com.group7.app.lesson.model.VocabItem;
import com.group7.app.lesson.repository.VocabItemRepository;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

@ExtendWith(MockitoExtension.class)
class VocabControllerTest {

  @Mock private VocabItemRepository vocabItemRepository;

  private VocabController vocabController;

  @BeforeEach
  void setUp() {
    vocabController = new VocabController(vocabItemRepository);
  }

  @Test
  void createVocabReturnsExistingItemWhenTermAlreadyExists() {
    VocabItem existing = new VocabItem("rizz", "charisma", "example", "noun");
    when(vocabItemRepository.findByTermIgnoreCase("rizz")).thenReturn(Optional.of(existing));

    ResponseEntity<VocabItem> response =
        vocabController.createVocab(
            new VocabController.CreateVocabRequest("  rizz  ", "charisma", "example", "noun"));

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
    assertThat(response.getBody()).isSameAs(existing);
  }

  @Test
  void createVocabCreatesNewItemWhenTermIsMissing() {
    VocabItem saved = new VocabItem("rizz", "charisma", "example", "noun");
    when(vocabItemRepository.findByTermIgnoreCase("rizz")).thenReturn(Optional.empty());
    when(vocabItemRepository.save(org.mockito.ArgumentMatchers.any(VocabItem.class)))
        .thenReturn(saved);

    ResponseEntity<VocabItem> response =
        vocabController.createVocab(
            new VocabController.CreateVocabRequest("  rizz  ", "  charisma  ", "example", "noun"));

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
    assertThat(response.getBody()).isSameAs(saved);
  }

  @Test
  void createVocabReturnsExistingItemAfterConcurrentInsertRace() {
    VocabItem existing = new VocabItem("rizz", "charisma", "example", "noun");
    when(vocabItemRepository.findByTermIgnoreCase("rizz"))
        .thenReturn(Optional.empty(), Optional.of(existing));
    when(vocabItemRepository.save(org.mockito.ArgumentMatchers.any(VocabItem.class)))
        .thenThrow(new DataIntegrityViolationException("duplicate"));

    ResponseEntity<VocabItem> response =
        vocabController.createVocab(
            new VocabController.CreateVocabRequest("rizz", "charisma", null, null));

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
    assertThat(response.getBody()).isSameAs(existing);
  }

  @Test
  void createVocabRethrowsIntegrityErrorWhenRetryStillFindsNothing() {
    when(vocabItemRepository.findByTermIgnoreCase("rizz"))
        .thenReturn(Optional.empty(), Optional.empty());
    when(vocabItemRepository.save(org.mockito.ArgumentMatchers.any(VocabItem.class)))
        .thenThrow(new DataIntegrityViolationException("duplicate"));

    assertThatThrownBy(
            () ->
                vocabController.createVocab(
                    new VocabController.CreateVocabRequest("rizz", "charisma", null, null)))
        .isInstanceOf(DataIntegrityViolationException.class);
  }
}
