package com.group7.app.forum.model;

import com.fasterxml.jackson.annotation.JsonBackReference;
import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "answers")
public class Answer {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(nullable = false, columnDefinition = "TEXT")
  private String content;

  @Column(nullable = false)
  private String author;

  @Column(name = "author_id")
  private UUID authorId;

  private LocalDateTime createdAt;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "question_id", nullable = false)
  @JsonBackReference
  private Question question;

  @OneToMany(mappedBy = "answer", cascade = CascadeType.ALL, orphanRemoval = true)
  @JsonIgnore
  private List<AnswerVote> votes = new ArrayList<>();

  public Answer() {}

  public Answer(String content, String author, Question question) {
    this.content = content;
    this.author = author;
    this.question = question;
  }

  @PrePersist
  protected void onCreate() {
    this.createdAt = LocalDateTime.now();
  }

  public Long getId() {
    return id;
  }

  public String getContent() {
    return content;
  }

  public void setContent(String content) {
    this.content = content;
  }

  public String getAuthor() {
    return author;
  }

  public void setAuthor(String author) {
    this.author = author;
  }

  public UUID getAuthorId() {
    return authorId;
  }

  public void setAuthorId(UUID authorId) {
    this.authorId = authorId;
  }

  public LocalDateTime getCreatedAt() {
    return createdAt;
  }

  public void setCreatedAt(LocalDateTime createdAt) {
    this.createdAt = createdAt;
  }

  public Question getQuestion() {
    return question;
  }

  public void setQuestion(Question question) {
    this.question = question;
  }

  public List<AnswerVote> getVotes() {
    return votes;
  }

  public void setVotes(List<AnswerVote> votes) {
    this.votes = votes;
  }
}
