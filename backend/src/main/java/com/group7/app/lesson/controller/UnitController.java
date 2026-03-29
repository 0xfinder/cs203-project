package com.group7.app.lesson.controller;

import com.group7.app.lesson.model.Lesson;
import com.group7.app.lesson.model.Unit;
import com.group7.app.lesson.service.AuthContextService;
import com.group7.app.lesson.service.LessonService;
import com.group7.app.user.User;
import com.group7.app.user.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/units")
@Tag(name = "Units", description = "Unit read endpoints")
public class UnitController {

  private final LessonService lessonService;
  private final UserService userService;
  private final AuthContextService authContextService;

  public UnitController(
      LessonService lessonService, AuthContextService authContextService, UserService userService) {
    this.lessonService = lessonService;
    this.userService = userService;
    this.authContextService = authContextService;
  }

  @GetMapping
  @Operation(summary = "Get all units with lesson summaries")
  public List<UnitResponse> listUnits(@AuthenticationPrincipal Jwt jwt) {
    User actor = authContextService.resolveUser(jwt);
    List<Unit> units = lessonService.listUnits();

    return units.stream()
        .map(
            unit -> {
              List<LessonSummaryResponse> lessons =
                  lessonService.listLessons(actor, unit.getId(), null).stream()
                      .filter(lesson -> lesson.getUnit().getId().equals(unit.getId()))
                      .map(this::toLessonSummary)
                      .toList();
              return new UnitResponse(
                  unit.getId(),
                  unit.getTitle(),
                  unit.getSlug(),
                  unit.getDescription(),
                  unit.getOrderIndex(),
                  lessons);
            })
        .filter(unit -> !unit.lessons().isEmpty())
        .toList();
  }

  private LessonSummaryResponse toLessonSummary(Lesson lesson) {
    String submittedBy = null;
    try {
      if (lesson.getCreatedBy() != null) {
        var uOpt = userService.findById(lesson.getCreatedBy());
        if (uOpt.isPresent()) {
          var u = uOpt.get();
          submittedBy =
              u.getDisplayName() != null && !u.getDisplayName().isBlank()
                  ? u.getDisplayName()
                  : u.getEmail();
        }
      }
    } catch (Exception e) {
      submittedBy = null;
    }

    return new LessonSummaryResponse(
        lesson.getId(),
        lesson.getUnit().getId(),
        lesson.getTitle(),
        lesson.getSlug(),
        lesson.getDescription(),
        lesson.getLearningObjective(),
        lesson.getEstimatedMinutes(),
        lesson.getOrderIndex(),
        lesson.getStatus(),
        submittedBy);
  }

  public record UnitResponse(
      Long id,
      String title,
      String slug,
      String description,
      Integer orderIndex,
      List<LessonSummaryResponse> lessons) {}

  public record LessonSummaryResponse(
      Long id,
      Long unitId,
      String title,
      String slug,
      String description,
      String learningObjective,
      Integer estimatedMinutes,
      Integer orderIndex,
      com.group7.app.lesson.model.LessonStatus status,
      String submittedBy) {}
}
