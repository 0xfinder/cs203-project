package com.group7.app.lesson.controller;

import com.group7.app.lesson.model.Lesson;
import com.group7.app.lesson.model.Unit;
import com.group7.app.lesson.service.AuthContextService;
import com.group7.app.lesson.service.LessonService;
import com.group7.app.user.User;
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
    private final AuthContextService authContextService;

    public UnitController(LessonService lessonService, AuthContextService authContextService) {
        this.lessonService = lessonService;
        this.authContextService = authContextService;
    }

    @GetMapping
    @Operation(summary = "Get all units with lesson summaries")
    public List<UnitResponse> listUnits(@AuthenticationPrincipal Jwt jwt) {
        User actor = authContextService.resolveUser(jwt);
        List<Unit> units = lessonService.listUnits();

        return units.stream()
                .map(unit -> {
                    List<LessonSummaryResponse> lessons = lessonService.listLessons(actor, unit.getId(), null).stream()
                            .filter(lesson -> lesson.getUnit().getId().equals(unit.getId()))
                            .map(this::toLessonSummary)
                            .toList();
                    return new UnitResponse(unit.getId(), unit.getTitle(), unit.getOrderIndex(), lessons);
                })
                .toList();
    }

    private LessonSummaryResponse toLessonSummary(Lesson lesson) {
        return new LessonSummaryResponse(
                lesson.getId(),
                lesson.getUnit().getId(),
                lesson.getTitle(),
                lesson.getDescription(),
                lesson.getOrderIndex(),
                lesson.getStatus());
    }

    public record UnitResponse(Long id, String title, Integer orderIndex, List<LessonSummaryResponse> lessons) {
    }

    public record LessonSummaryResponse(
            Long id,
            Long unitId,
            String title,
            String description,
            Integer orderIndex,
            com.group7.app.lesson.model.LessonStatus status) {
    }
}
