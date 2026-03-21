package com.group7.app.lesson.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "user_vocab_memory")
public class UserVocabMemory {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "user_id", nullable = false)
  private UUID userId;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "vocab_item_id", nullable = false)
  private VocabItem vocabItem;

  @Column(nullable = false)
  private Integer strength = 0;

  @Column(name = "correct_streak", nullable = false)
  private Integer correctStreak = 0;

  @Column(name = "last_seen_at")
  private Instant lastSeenAt;

  @Column(name = "next_due_at", nullable = false)
  private Instant nextDueAt;

  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;

  protected UserVocabMemory() {}

  public UserVocabMemory(UUID userId, VocabItem vocabItem, Instant now) {
    this.userId = userId;
    this.vocabItem = vocabItem;
    this.lastSeenAt = now;
    this.nextDueAt = now;
  }

  public Long getId() {
    return id;
  }

  public UUID getUserId() {
    return userId;
  }

  public VocabItem getVocabItem() {
    return vocabItem;
  }

  public Integer getStrength() {
    return strength;
  }

  public void setStrength(Integer strength) {
    this.strength = strength;
  }

  public Integer getCorrectStreak() {
    return correctStreak;
  }

  public void setCorrectStreak(Integer correctStreak) {
    this.correctStreak = correctStreak;
  }

  public Instant getLastSeenAt() {
    return lastSeenAt;
  }

  public void setLastSeenAt(Instant lastSeenAt) {
    this.lastSeenAt = lastSeenAt;
  }

  public Instant getNextDueAt() {
    return nextDueAt;
  }

  public void setNextDueAt(Instant nextDueAt) {
    this.nextDueAt = nextDueAt;
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
