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
@Table(name = "user_lesson_progress")
public class UserLessonProgress {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "user_id", nullable = false)
  private UUID userId;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "lesson_id", nullable = false)
  private Lesson lesson;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "last_step_id")
  private LessonStep lastStep;

  @Column(name = "best_score", nullable = false)
  private Integer bestScore = 0;

  @Column(name = "attempt_count", nullable = false)
  private Integer attemptCount = 0;

  @Column(name = "completed_at")
  private Instant completedAt;

  @Column(name = "last_attempt_at")
  private Instant lastAttemptAt;

  @Column(name = "best_time_seconds")
  private Long bestTimeSeconds;

  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;

  protected UserLessonProgress() {}

  public UserLessonProgress(UUID userId, Lesson lesson) {
    this.userId = userId;
    this.lesson = lesson;
  }

  public Long getId() {
    return id;
  }

  public UUID getUserId() {
    return userId;
  }

  public Lesson getLesson() {
    return lesson;
  }

  public LessonStep getLastStep() {
    return lastStep;
  }

  public void setLastStep(LessonStep lastStep) {
    this.lastStep = lastStep;
  }

  public Integer getBestScore() {
    return bestScore;
  }

  public void setBestScore(Integer bestScore) {
    this.bestScore = bestScore;
  }

  public Integer getAttemptCount() {
    return attemptCount;
  }

  public void setAttemptCount(Integer attemptCount) {
    this.attemptCount = attemptCount;
  }

  public Instant getCompletedAt() {
    return completedAt;
  }

  public void setCompletedAt(Instant completedAt) {
    this.completedAt = completedAt;
  }

  public Instant getLastAttemptAt() {
    return lastAttemptAt;
  }

  public void setLastAttemptAt(Instant lastAttemptAt) {
    this.lastAttemptAt = lastAttemptAt;
  }

  public Long getBestTimeSeconds() {
    return bestTimeSeconds;
  }

  public void setBestTimeSeconds(Long bestTimeSeconds) {
    this.bestTimeSeconds = bestTimeSeconds;
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
