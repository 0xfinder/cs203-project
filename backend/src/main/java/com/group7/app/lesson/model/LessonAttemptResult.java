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

    @Column(name = "is_correct", nullable = false)
    private boolean isCorrect;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "submitted_answer", columnDefinition = "jsonb")
    private JsonNode submittedAnswer;

    @Column(name = "correct_answer")
    private String correctAnswer;

    @Column
    private String explanation;

    protected LessonAttemptResult() {
    }

    public LessonAttemptResult(
            LessonAttempt attempt,
            LessonStep lessonStep,
            boolean isCorrect,
            JsonNode submittedAnswer,
            String correctAnswer,
            String explanation) {
        this.attempt = attempt;
        this.lessonStep = lessonStep;
        this.isCorrect = isCorrect;
        this.submittedAnswer = submittedAnswer;
        this.correctAnswer = correctAnswer;
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

    public boolean isCorrect() {
        return isCorrect;
    }

    public JsonNode getSubmittedAnswer() {
        return submittedAnswer;
    }

    public String getCorrectAnswer() {
        return correctAnswer;
    }

    public String getExplanation() {
        return explanation;
    }
}
