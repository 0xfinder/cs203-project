package com.group7.app.lesson.controller;

import com.group7.app.lesson.model.Lesson;
import com.group7.app.lesson.service.LessonService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api/lessons")
public class LessonController {

    private final LessonService lessonService;

    public LessonController(LessonService lessonService) {
        this.lessonService = lessonService;
    }

    // Get all lessons
    @GetMapping
    public List<Lesson> getAll() {
        return lessonService.findAll();
    }

    // Get lesson by ID
    @GetMapping("/{id}")
    public Lesson getById(@PathVariable Long id) {
        return lessonService.findById(id);
    }

    // Create a new lesson
    @PostMapping
    public ResponseEntity<Lesson> create(@Valid @RequestBody CreateLessonRequest request) {
        Lesson created = lessonService.create(request.title());
        return ResponseEntity
                .created(URI.create("/api/lessons/" + created.getId()))
                .body(created);
    }

    // Request DTO
    public record CreateLessonRequest(
            @NotBlank String title
    ) {}
}
