package com.group7.app.forum.model;

import com.group7.app.user.User;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDateTime;

@Entity
@Table(
    name = "question_votes",
    uniqueConstraints =
        @UniqueConstraint(
            name = "uq_question_vote",
            columnNames = {"question_id", "user_id"}),
    indexes = {
      @Index(name = "idx_question_votes_question_id", columnList = "question_id"),
      @Index(name = "idx_question_votes_user_id", columnList = "user_id")
    })
public class QuestionVote {

  public enum VoteType {
    THUMBS_UP,
    THUMBS_DOWN
  }

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @NotNull
  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "question_id", nullable = false)
  private Question question;

  @NotNull
  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "user_id", nullable = false)
  private User user;

  @NotNull
  @Enumerated(EnumType.STRING)
  @Column(name = "vote_type", nullable = false, length = 20)
  private VoteType voteType;

  @Column(name = "created_at", nullable = false, updatable = false)
  private LocalDateTime createdAt;

  @Column(name = "updated_at", nullable = false)
  private LocalDateTime updatedAt;

  protected QuestionVote() {}

  public QuestionVote(Question question, User user, VoteType voteType) {
    this.question = question;
    this.user = user;
    this.voteType = voteType;
  }

  @PrePersist
  protected void onCreate() {
    LocalDateTime now = LocalDateTime.now();
    createdAt = now;
    updatedAt = now;
  }

  @PreUpdate
  protected void onUpdate() {
    updatedAt = LocalDateTime.now();
  }

  public Long getId() {
    return id;
  }

  public Question getQuestion() {
    return question;
  }

  public User getUser() {
    return user;
  }

  public VoteType getVoteType() {
    return voteType;
  }

  public void setVoteType(VoteType voteType) {
    this.voteType = voteType;
  }

  public LocalDateTime getCreatedAt() {
    return createdAt;
  }

  public LocalDateTime getUpdatedAt() {
    return updatedAt;
  }
}
