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

@Entity
@Table(name = "lesson_question_cloze_answers")
public class QuestionClozeAnswer {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "question_id", nullable = false)
    private LessonQuestion question;

    @Column(name = "answer_text", nullable = false)
    private String answerText;

    @Column(name = "order_index", nullable = false)
    private Integer orderIndex;

    protected QuestionClozeAnswer() {
    }

    public QuestionClozeAnswer(LessonQuestion question, String answerText, Integer orderIndex) {
        this.question = question;
        this.answerText = answerText;
        this.orderIndex = orderIndex;
    }

    public Long getId() {
        return id;
    }

    public LessonQuestion getQuestion() {
        return question;
    }

    public void setQuestion(LessonQuestion question) {
        this.question = question;
    }

    public String getAnswerText() {
        return answerText;
    }

    public void setAnswerText(String answerText) {
        this.answerText = answerText;
    }

    public Integer getOrderIndex() {
        return orderIndex;
    }

    public void setOrderIndex(Integer orderIndex) {
        this.orderIndex = orderIndex;
    }
}
