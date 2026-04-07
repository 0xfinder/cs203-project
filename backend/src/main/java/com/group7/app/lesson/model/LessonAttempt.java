package com.group7.app.lesson.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "lesson_attempts")
public class LessonAttempt {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "user_id", nullable = false)
  private UUID userId;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "lesson_id", nullable = false)
  private Lesson lesson;

  @Column(nullable = false)
  private Integer score;

  @Column(name = "total_questions", nullable = false)
  private Integer totalQuestions;

  @Column(name = "correct_count", nullable = false)
  private Integer correctCount;

  @Column(nullable = false)
  private boolean passed;

  @Column(name = "started_at", nullable = false, updatable = false)
  private Instant startedAt;

  @Column(name = "submitted_at", nullable = false)
  private Instant submittedAt;

  protected LessonAttempt() {}

  public LessonAttempt(
      UUID userId,
      Lesson lesson,
      Integer score,
      Integer totalQuestions,
      Integer correctCount,
      boolean passed,
      Instant startedAt,
      Instant submittedAt) {
    this.userId = userId;
    this.lesson = lesson;
    this.score = score;
    this.totalQuestions = totalQuestions;
    this.correctCount = correctCount;
    this.passed = passed;
    this.startedAt = startedAt;
    this.submittedAt = submittedAt;
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

  public Integer getScore() {
    return score;
  }

  public Integer getTotalQuestions() {
    return totalQuestions;
  }

  public Integer getCorrectCount() {
    return correctCount;
  }

  public boolean isPassed() {
    return passed;
  }

  public Instant getStartedAt() {
    return startedAt;
  }

  public Instant getSubmittedAt() {
    return submittedAt;
  }
}
