package com.group7.app.lesson.controller;

import com.group7.app.lesson.model.Lesson;
import com.group7.app.lesson.model.Unit;
import com.group7.app.lesson.service.AuthContextService;
import com.group7.app.lesson.service.LessonService;
import com.group7.app.user.User;
import com.group7.app.user.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/units")
@Tag(name = "Units", description = "Unit management endpoints")
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
        .toList();
  }

  @PostMapping
  @Operation(summary = "Create unit")
  public ResponseEntity<UnitResponse> createUnit(
      @AuthenticationPrincipal Jwt jwt, @Valid @RequestBody CreateUnitRequest request) {
    User actor = authContextService.resolveUser(jwt);
    Unit unit =
        lessonService.createUnit(
            actor, new LessonService.UnitCreateInput(request.title(), request.description()));
    return ResponseEntity.ok(toUnitResponse(unit, List.of()));
  }

  @PatchMapping("/{unitId}")
  @Operation(summary = "Update unit")
  public UnitResponse patchUnit(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable Long unitId,
      @RequestBody PatchUnitRequest request) {
    User actor = authContextService.resolveUser(jwt);
    Unit unit =
        lessonService.patchUnit(
            actor,
            unitId,
            new LessonService.UnitPatchInput(request.title(), request.description()));
    List<LessonSummaryResponse> lessons =
        lessonService.listLessons(actor, unit.getId(), null).stream()
            .filter(lesson -> lesson.getUnit().getId().equals(unit.getId()))
            .map(this::toLessonSummary)
            .toList();
    return toUnitResponse(unit, lessons);
  }

  @DeleteMapping("/{unitId}")
  @Operation(summary = "Delete unit")
  public ResponseEntity<Void> deleteUnit(
      @AuthenticationPrincipal Jwt jwt, @PathVariable Long unitId) {
    User actor = authContextService.resolveUser(jwt);
    lessonService.deleteUnit(actor, unitId);
    return ResponseEntity.noContent().build();
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

  private UnitResponse toUnitResponse(Unit unit, List<LessonSummaryResponse> lessons) {
    return new UnitResponse(
        unit.getId(),
        unit.getTitle(),
        unit.getSlug(),
        unit.getDescription(),
        unit.getOrderIndex(),
        lessons);
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

  public record CreateUnitRequest(@NotBlank String title, String description) {}

  public record PatchUnitRequest(String title, String description) {}
}
