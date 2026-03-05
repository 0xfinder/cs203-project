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
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "user_step_events")
public class UserStepEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "lesson_step_id", nullable = false)
    private LessonStep lessonStep;

    @Column(name = "response_json", nullable = false, columnDefinition = "jsonb")
    private String responseJson;

    @Column(name = "is_correct")
    private Boolean isCorrect;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected UserStepEvent() {
    }

    public UserStepEvent(UUID userId, LessonStep lessonStep, String responseJson, Boolean isCorrect) {
        this.userId = userId;
        this.lessonStep = lessonStep;
        this.responseJson = responseJson;
        this.isCorrect = isCorrect;
    }

    public Long getId() {
        return id;
    }

    @PrePersist
    protected void onCreate() {
        createdAt = Instant.now();
    }
}
