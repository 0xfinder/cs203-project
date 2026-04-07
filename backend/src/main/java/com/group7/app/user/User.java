package com.group7.app.user;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "users")
public class User {

  @Id private UUID id;

  @NotBlank
  @Email
  @Column(nullable = false)
  private String email;

  @Column(name = "display_name")
  private String displayName;

  @Column(columnDefinition = "text")
  private String bio;

  private Integer age;

  private String gender;

  @Column(name = "avatar_color")
  private String avatarColor;

  @Column(name = "avatar_path")
  private String avatarPath;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  // default role is LEARNER
  private Role role = Role.LEARNER;

  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  @Column(name = "updated_at")
  private Instant updatedAt;

  @Column(name = "current_correct_streak")
  private Integer currentCorrectStreak = 0;

  @Column(name = "max_correct_streak")
  private Integer maxCorrectStreak = 0;

  @Column(name = "total_time_seconds")
  private Long totalTimeSeconds = 0L;

  @Column(name = "completed_lessons_count")
  private Integer completedLessonsCount = 0;

  protected User() {}

  public User(UUID id, String email) {
    this.id = id;
    this.email = email;
  }

  public UUID getId() {
    return id;
  }

  public String getEmail() {
    return email;
  }

  public void setEmail(String email) {
    this.email = email;
  }

  public String getDisplayName() {
    return displayName;
  }

  public void setDisplayName(String displayName) {
    this.displayName = displayName;
  }

  public String getBio() {
    return bio;
  }

  public void setBio(String bio) {
    this.bio = bio;
  }

  public Integer getAge() {
    return age;
  }

  public void setAge(Integer age) {
    this.age = age;
  }

  public String getGender() {
    return gender;
  }

  public void setGender(String gender) {
    this.gender = gender;
  }

  public String getAvatarColor() {
    return avatarColor;
  }

  public void setAvatarColor(String avatarColor) {
    this.avatarColor = avatarColor;
  }

  public String getAvatarPath() {
    return avatarPath;
  }

  public void setAvatarPath(String avatarPath) {
    this.avatarPath = avatarPath;
  }

  public Role getRole() {
    return role;
  }

  public void setRole(Role role) {
    this.role = role;
  }

  public Instant getCreatedAt() {
    return createdAt;
  }

  public Instant getUpdatedAt() {
    return updatedAt;
  }

  public Integer getCurrentCorrectStreak() {
    return currentCorrectStreak != null ? currentCorrectStreak : 0;
  }

  public void setCurrentCorrectStreak(Integer currentCorrectStreak) {
    this.currentCorrectStreak = currentCorrectStreak;
  }

  public Integer getMaxCorrectStreak() {
    return maxCorrectStreak != null ? maxCorrectStreak : 0;
  }

  public void setMaxCorrectStreak(Integer maxCorrectStreak) {
    this.maxCorrectStreak = maxCorrectStreak;
  }

  public Long getTotalTimeSeconds() {
    return totalTimeSeconds != null ? totalTimeSeconds : 0L;
  }

  public void setTotalTimeSeconds(Long totalTimeSeconds) {
    this.totalTimeSeconds = totalTimeSeconds;
  }

  public Integer getCompletedLessonsCount() {
    return completedLessonsCount != null ? completedLessonsCount : 0;
  }

  public void setCompletedLessonsCount(Integer completedLessonsCount) {
    this.completedLessonsCount = completedLessonsCount;
  }

  @PrePersist
  protected void onCreate() {
    Instant now = Instant.now();
    if (createdAt == null) {
      createdAt = now;
    }
    updatedAt = now;
  }

  @PreUpdate
  protected void onUpdate() {
    updatedAt = Instant.now();
  }
}
