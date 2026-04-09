package com.group7.app.lesson.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.group7.app.lesson.model.Lesson;
import com.group7.app.lesson.model.LessonAttempt;
import com.group7.app.lesson.model.Unit;
import com.group7.app.lesson.repository.LessonAttemptRepository;
import com.group7.app.lesson.service.AuthContextService;
import com.group7.app.user.User;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class AnalyticsControllerTest {

  @Mock private LessonAttemptRepository lessonAttemptRepository;

  @Mock private AuthContextService authContextService;

  private AnalyticsController analyticsController;

  @BeforeEach
  void setUp() {
    analyticsController = new AnalyticsController(lessonAttemptRepository, authContextService);
  }

  @Test
  void getMyAnalyticsAggregatesRecentAttemptsAndUserStats() {
    UUID userId = UUID.randomUUID();
    User user = new User(userId, "user@example.com");
    user.setCompletedLessonsCount(2);
    user.setMaxCorrectStreak(7);
    user.setCurrentCorrectStreak(3);
    user.setTotalTimeSeconds(240L);

    LocalDate today = LocalDate.now(ZoneOffset.UTC);
    LessonAttempt recentPassed = attemptForDate(userId, "Core", today.minusDays(1), 20, 5, 4, true);
    LessonAttempt recentFailed =
        attemptForDate(userId, "Core", today.minusDays(8), 10, 4, 2, false);
    LessonAttempt zeroQuestionAttempt =
        attemptForDate(userId, "Meta", today.minusDays(2), 5, 0, 0, true);
    LessonAttempt oldAttempt =
        attemptForDate(userId, "Archived", today.minusDays(60), 50, 10, 10, true);

    Jwt jwt = jwt(userId);
    when(authContextService.resolveUser(jwt)).thenReturn(user);
    when(lessonAttemptRepository.findByUserIdWithLessonAndUnit(userId))
        .thenReturn(List.of(recentPassed, recentFailed, zeroQuestionAttempt, oldAttempt));

    ResponseEntity<AnalyticsController.UserAnalyticsResponse> response =
        analyticsController.getMyAnalytics(jwt);

    AnalyticsController.UserAnalyticsResponse body = response.getBody();
    assertThat(body).isNotNull();
    assertThat(body.totalAttempts()).isEqualTo(4);
    assertThat(body.totalCorrect()).isEqualTo(16);
    assertThat(body.totalQuestions()).isEqualTo(19);
    assertThat(body.lessonsCompleted()).isEqualTo(2);
    assertThat(body.maxStreak()).isEqualTo(7);
    assertThat(body.currentStreak()).isEqualTo(3);
    assertThat(body.avgTimeSeconds()).isEqualTo(120.0);
    assertThat(body.dailyXp()).hasSize(30);
    assertThat(body.dailyXp())
        .anySatisfy(entry -> assertThat(entry.date()).isEqualTo(today.minusDays(1).toString()));
    assertThat(body.dailyXp())
        .filteredOn(entry -> entry.date().equals(today.minusDays(1).toString()))
        .singleElement()
        .extracting(AnalyticsController.DailyXpEntry::xp)
        .isEqualTo(20);
    assertThat(body.unitAccuracy()).hasSize(2);
    assertThat(body.unitAccuracy())
        .filteredOn(entry -> entry.unitTitle().equals("Core"))
        .singleElement()
        .satisfies(
            entry -> {
              assertThat(entry.correct()).isEqualTo(6);
              assertThat(entry.total()).isEqualTo(9);
              assertThat(entry.accuracyPct()).isEqualTo(67);
            });
    assertThat(body.unitAccuracy()).noneMatch(entry -> entry.unitTitle().equals("Meta"));
    assertThat(body.weeklyAttempts()).hasSize(8);
    assertThat(
            body.weeklyAttempts().stream()
                .mapToInt(AnalyticsController.WeeklyEntry::attempts)
                .sum())
        .isEqualTo(3);
    assertThat(
            body.weeklyAttempts().stream().mapToInt(AnalyticsController.WeeklyEntry::passed).sum())
        .isEqualTo(2);
  }

  @Test
  void getMyAnalyticsReturnsNullAverageWhenNoCompletedLessonsExist() {
    UUID userId = UUID.randomUUID();
    User user = new User(userId, "user@example.com");
    Jwt jwt = jwt(userId);

    when(authContextService.resolveUser(jwt)).thenReturn(user);
    when(lessonAttemptRepository.findByUserIdWithLessonAndUnit(userId)).thenReturn(List.of());

    AnalyticsController.UserAnalyticsResponse body =
        analyticsController.getMyAnalytics(jwt).getBody();

    assertThat(body).isNotNull();
    assertThat(body.avgTimeSeconds()).isNull();
    assertThat(body.totalAttempts()).isZero();
    assertThat(body.totalCorrect()).isZero();
    assertThat(body.totalQuestions()).isZero();
    assertThat(body.dailyXp()).hasSize(30);
    assertThat(body.weeklyAttempts()).hasSize(8);
    assertThat(body.unitAccuracy()).isEmpty();
  }

  private LessonAttempt attemptForDate(
      UUID userId,
      String unitTitle,
      LocalDate submittedDate,
      int score,
      int totalQuestions,
      int correctCount,
      boolean passed) {
    Unit unit = new Unit(unitTitle, unitTitle.toLowerCase(), "desc", 1);
    ReflectionTestUtils.setField(unit, "id", (long) Math.abs(unitTitle.hashCode()));
    Lesson lesson = new Lesson(unit, "Lesson", "lesson", "desc", null, 5, 1, userId);
    ReflectionTestUtils.setField(lesson, "id", (long) Math.abs((unitTitle + "-lesson").hashCode()));
    Instant submittedAt = submittedDate.atStartOfDay().toInstant(ZoneOffset.UTC);
    return new LessonAttempt(
        userId,
        lesson,
        score,
        totalQuestions,
        correctCount,
        passed,
        submittedAt.minusSeconds(120),
        submittedAt);
  }

  private Jwt jwt(UUID userId) {
    return Jwt.withTokenValue("token-" + userId)
        .header("alg", "none")
        .subject(userId.toString())
        .claim("email", "user@example.com")
        .build();
  }
}
