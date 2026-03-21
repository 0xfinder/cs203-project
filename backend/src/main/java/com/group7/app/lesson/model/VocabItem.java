package com.group7.app.lesson.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "vocab_items")
public class VocabItem {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(nullable = false, unique = true, length = 120)
  private String term;

  @Column(nullable = false)
  private String definition;

  @Column(name = "example_sentence")
  private String exampleSentence;

  @Column(name = "part_of_speech")
  private String partOfSpeech;

  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;

  protected VocabItem() {}

  public VocabItem(String term, String definition, String exampleSentence, String partOfSpeech) {
    this.term = term;
    this.definition = definition;
    this.exampleSentence = exampleSentence;
    this.partOfSpeech = partOfSpeech;
  }

  public Long getId() {
    return id;
  }

  public String getTerm() {
    return term;
  }

  public void setTerm(String term) {
    this.term = term;
  }

  public String getDefinition() {
    return definition;
  }

  public void setDefinition(String definition) {
    this.definition = definition;
  }

  public String getExampleSentence() {
    return exampleSentence;
  }

  public void setExampleSentence(String exampleSentence) {
    this.exampleSentence = exampleSentence;
  }

  public String getPartOfSpeech() {
    return partOfSpeech;
  }

  public void setPartOfSpeech(String partOfSpeech) {
    this.partOfSpeech = partOfSpeech;
  }

  public Instant getCreatedAt() {
    return createdAt;
  }

  public Instant getUpdatedAt() {
    return updatedAt;
  }

  @PrePersist
  protected void onCreate() {
    Instant now = Instant.now();
    createdAt = now;
    updatedAt = now;
  }

  @PreUpdate
  protected void onUpdate() {
    updatedAt = Instant.now();
  }
}
