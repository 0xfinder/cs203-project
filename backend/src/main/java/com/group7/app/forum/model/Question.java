package com.group7.app.forum.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonManagedReference;
import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "questions")
public class Question {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(nullable = false, columnDefinition = "TEXT")
  private String title;

  @Column(nullable = false, columnDefinition = "TEXT")
  private String content;

  @Column(nullable = false)
  private String author;

  @Column(name = "author_id")
  private UUID authorId;

  private LocalDateTime createdAt;

  @Column(nullable = false)
  private boolean resolved = false;

  @Column(name = "resolved_at")
  private LocalDateTime resolvedAt;

  @OneToMany(
      mappedBy = "question",
      cascade = CascadeType.ALL,
      orphanRemoval = true,
      fetch = FetchType.LAZY)
  @JsonManagedReference
  private List<Answer> answers = new ArrayList<>();

  @OneToMany(mappedBy = "question", cascade = CascadeType.ALL, orphanRemoval = true)
  @JsonIgnore
  private List<QuestionVote> votes = new ArrayList<>();

  public Question() {}

  public Question(String title, String content, String author) {
    this.title = title;
    this.content = content;
    this.author = author;
  }

  @PrePersist
  protected void onCreate() {
    this.createdAt = LocalDateTime.now();
  }

  public Long getId() {
    return id;
  }

  public String getTitle() {
    return title;
  }

  public void setTitle(String title) {
    this.title = title;
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

  public List<Answer> getAnswers() {
    return answers;
  }

  public void setAnswers(List<Answer> answers) {
    this.answers = answers;
  }

  public List<QuestionVote> getVotes() {
    return votes;
  }

  public void setVotes(List<QuestionVote> votes) {
    this.votes = votes;
  }

  public boolean isResolved() {
    return resolved;
  }

  public void setResolved(boolean resolved) {
    this.resolved = resolved;
  }

  public LocalDateTime getResolvedAt() {
    return resolvedAt;
  }

  public void setResolvedAt(LocalDateTime resolvedAt) {
    this.resolvedAt = resolvedAt;
  }
}
