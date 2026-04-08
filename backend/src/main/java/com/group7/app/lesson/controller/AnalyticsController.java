package com.group7.app.lesson.controller;

import com.group7.app.lesson.model.LessonAttempt;
import com.group7.app.lesson.repository.LessonAttemptRepository;
import com.group7.app.lesson.service.AuthContextService;
import com.group7.app.user.User;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/analytics")
@Tag(name = "Analytics", description = "Learning analytics endpoints")
public class AnalyticsController {

  private final LessonAttemptRepository lessonAttemptRepository;
  private final AuthContextService authContextService;

  public AnalyticsController(
      LessonAttemptRepository lessonAttemptRepository, AuthContextService authContextService) {
    this.lessonAttemptRepository = lessonAttemptRepository;
    this.authContextService = authContextService;
  }

  @GetMapping("/me")
  @Operation(summary = "Get learning analytics for the current user")
  public ResponseEntity<UserAnalyticsResponse> getMyAnalytics(@AuthenticationPrincipal Jwt jwt) {
    User user = authContextService.resolveUser(jwt);
    List<LessonAttempt> attempts =
        lessonAttemptRepository.findByUserIdWithLessonAndUnit(user.getId());

    LocalDate today = LocalDate.now(ZoneOffset.UTC);

    // Daily XP for last 30 days
    LocalDate thirtyDaysAgo = today.minusDays(29);
    Map<LocalDate, Integer> dailyXpMap = new LinkedHashMap<>();
    for (int i = 0; i < 30; i++) {
      dailyXpMap.put(thirtyDaysAgo.plusDays(i), 0);
    }
    for (LessonAttempt a : attempts) {
      LocalDate date = a.getSubmittedAt().atZone(ZoneOffset.UTC).toLocalDate();
      if (!date.isBefore(thirtyDaysAgo) && !date.isAfter(today)) {
        dailyXpMap.merge(date, a.getScore(), Integer::sum);
      }
    }
    List<DailyXpEntry> dailyXp = new ArrayList<>();
    for (Map.Entry<LocalDate, Integer> e : dailyXpMap.entrySet()) {
      dailyXp.add(new DailyXpEntry(e.getKey().toString(), e.getValue()));
    }

    // Weekly attempts for last 8 weeks
    LocalDate weekStart = today.with(DayOfWeek.MONDAY);
    LocalDate eightWeeksAgo = weekStart.minusWeeks(7);
    Map<LocalDate, int[]> weeklyMap = new LinkedHashMap<>();
    for (int i = 0; i < 8; i++) {
      weeklyMap.put(eightWeeksAgo.plusWeeks(i), new int[] {0, 0});
    }
    for (LessonAttempt a : attempts) {
      LocalDate date = a.getSubmittedAt().atZone(ZoneOffset.UTC).toLocalDate();
      LocalDate ws = date.with(DayOfWeek.MONDAY);
      if (weeklyMap.containsKey(ws)) {
        weeklyMap.get(ws)[0]++;
        if (a.isPassed()) weeklyMap.get(ws)[1]++;
      }
    }
    List<WeeklyEntry> weeklyAttempts = new ArrayList<>();
    for (Map.Entry<LocalDate, int[]> e : weeklyMap.entrySet()) {
      weeklyAttempts.add(new WeeklyEntry(e.getKey().toString(), e.getValue()[0], e.getValue()[1]));
    }

    // Per-unit accuracy (categories)
    Map<String, int[]> unitMap = new LinkedHashMap<>();
    for (LessonAttempt a : attempts) {
      if (a.getTotalQuestions() == 0) continue;
      String unitTitle = a.getLesson().getUnit().getTitle();
      unitMap.computeIfAbsent(unitTitle, k -> new int[] {0, 0});
      unitMap.get(unitTitle)[0] += a.getCorrectCount();
      unitMap.get(unitTitle)[1] += a.getTotalQuestions();
    }
    List<UnitAccuracy> unitAccuracy = new ArrayList<>();
    for (Map.Entry<String, int[]> e : unitMap.entrySet()) {
      int correct = e.getValue()[0];
      int total = e.getValue()[1];
      int pct = total > 0 ? (int) Math.round((correct * 100.0) / total) : 0;
      unitAccuracy.add(new UnitAccuracy(e.getKey(), correct, total, pct));
    }

    // Overall accuracy
    int totalAttempts = attempts.size();
    int totalCorrect = attempts.stream().mapToInt(LessonAttempt::getCorrectCount).sum();
    int totalQuestions = attempts.stream().mapToInt(LessonAttempt::getTotalQuestions).sum();

    int completedLessons = user.getCompletedLessonsCount();
    int maxStreak = user.getMaxCorrectStreak();
    int currentStreak = user.getCurrentCorrectStreak();
    Double avgTimeSeconds =
        completedLessons > 0 ? (double) user.getTotalTimeSeconds() / completedLessons : null;

    return ResponseEntity.ok(
        new UserAnalyticsResponse(
            dailyXp,
            weeklyAttempts,
            unitAccuracy,
            totalAttempts,
            totalCorrect,
            totalQuestions,
            completedLessons,
            maxStreak,
            currentStreak,
            avgTimeSeconds));
  }

  public record DailyXpEntry(String date, int xp) {}

  public record WeeklyEntry(String weekStart, int attempts, int passed) {}

  public record UnitAccuracy(String unitTitle, int correct, int total, int accuracyPct) {}

  public record UserAnalyticsResponse(
      List<DailyXpEntry> dailyXp,
      List<WeeklyEntry> weeklyAttempts,
      List<UnitAccuracy> unitAccuracy,
      int totalAttempts,
      int totalCorrect,
      int totalQuestions,
      int lessonsCompleted,
      int maxStreak,
      int currentStreak,
      Double avgTimeSeconds) {}
}
