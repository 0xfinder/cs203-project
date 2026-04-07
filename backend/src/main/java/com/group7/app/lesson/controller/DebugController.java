package com.group7.app.lesson.controller;

import com.group7.app.lesson.model.LessonStep;
import com.group7.app.lesson.repository.LessonRepository;
import com.group7.app.lesson.repository.LessonStepRepository;
import jakarta.transaction.Transactional;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/debug")
public class DebugController {

  private final LessonRepository lessonRepository;
  private final LessonStepRepository lessonStepRepository;

  public DebugController(
      LessonRepository lessonRepository, LessonStepRepository lessonStepRepository) {
    this.lessonRepository = lessonRepository;
    this.lessonStepRepository = lessonStepRepository;
  }

  @DeleteMapping("/lessons/{lessonId}")
  @Transactional
  public ResponseEntity<Void> deleteLessonDebug(@PathVariable Long lessonId) {
    List<LessonStep> steps = lessonStepRepository.findByLessonIdOrderByOrderIndexAsc(lessonId);
    for (LessonStep s : steps) {
      lessonStepRepository.delete(s);
    }
    lessonRepository.findById(lessonId).ifPresent(lessonRepository::delete);
    return ResponseEntity.noContent().build();
  }
}
