package com.group7.app.lesson.model;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "user_step_events")
public class UserStepEvent {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "user_id", nullable = false)
  private UUID userId;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "lesson_id", nullable = false)
  private Lesson lesson;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "lesson_step_id", nullable = false)
  private LessonStep lessonStep;

  @Column(name = "attempt_id")
  private Long attemptId;

  @Column(name = "event_type", nullable = false)
  private String eventType;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "payload", nullable = false, columnDefinition = "jsonb")
  private JsonNode payload;

  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  protected UserStepEvent() {}

  public UserStepEvent(
      UUID userId,
      Lesson lesson,
      LessonStep lessonStep,
      Long attemptId,
      String eventType,
      JsonNode payload) {
    this.userId = userId;
    this.lesson = lesson;
    this.lessonStep = lessonStep;
    this.attemptId = attemptId;
    this.eventType = eventType;
    this.payload = payload;
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

  public LessonStep getLessonStep() {
    return lessonStep;
  }

  public Long getAttemptId() {
    return attemptId;
  }

  public String getEventType() {
    return eventType;
  }

  public JsonNode getPayload() {
    return payload;
  }

  public Instant getCreatedAt() {
    return createdAt;
  }

  @PrePersist
  protected void onCreate() {
    createdAt = Instant.now();
  }
}
