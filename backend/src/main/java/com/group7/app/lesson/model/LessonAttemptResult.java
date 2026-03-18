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
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "lesson_attempt_results")
public class LessonAttemptResult {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "attempt_id", nullable = false)
    private LessonAttempt attempt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "lesson_step_id", nullable = false)
    private LessonStep lessonStep;

    @Column(name = "lesson_id", nullable = false)
    private Long lessonId;

    @Column(name = "is_correct", nullable = false)
    private boolean isCorrect;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "submitted_answer", columnDefinition = "jsonb")
    private JsonNode submittedAnswer;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "evaluated_answer", columnDefinition = "jsonb")
    private JsonNode evaluatedAnswer;

    @Column
    private String explanation;

    @Column(name = "created_at", nullable = false, updatable = false)
    private java.time.Instant createdAt;

    protected LessonAttemptResult() {
    }

    public LessonAttemptResult(
            LessonAttempt attempt,
            LessonStep lessonStep,
            Long lessonId,
            boolean isCorrect,
            JsonNode submittedAnswer,
            JsonNode evaluatedAnswer,
            String explanation) {
        this.attempt = attempt;
        this.lessonStep = lessonStep;
        this.lessonId = lessonId;
        this.isCorrect = isCorrect;
        this.submittedAnswer = submittedAnswer;
        this.evaluatedAnswer = evaluatedAnswer;
        this.explanation = explanation;
    }

    public Long getId() {
        return id;
    }

    public LessonAttempt getAttempt() {
        return attempt;
    }

    public LessonStep getLessonStep() {
        return lessonStep;
    }

    public Long getLessonId() {
        return lessonId;
    }

    public boolean isCorrect() {
        return isCorrect;
    }

    public JsonNode getSubmittedAnswer() {
        return submittedAnswer;
    }

    public JsonNode getEvaluatedAnswer() {
        return evaluatedAnswer;
    }

    public String getExplanation() {
        return explanation;
    }

    @jakarta.persistence.PrePersist
    protected void onCreate() {
        createdAt = java.time.Instant.now();
    }
}
