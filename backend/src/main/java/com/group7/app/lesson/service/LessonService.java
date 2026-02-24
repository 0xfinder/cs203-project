package com.group7.app.lesson.service;

import com.group7.app.lesson.model.Lesson;
import com.group7.app.lesson.repository.LessonRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class LessonService {

    private final LessonRepository lessonRepository;

    public LessonService(LessonRepository lessonRepository) {
        this.lessonRepository = lessonRepository;
    }

    public List<Lesson> findAll() {
        return lessonRepository.findAll();
    }

    public Lesson findById(Long id) {
        return lessonRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Lesson not found"));
    }

    public Lesson create(String title) {
        Lesson lesson = new Lesson(title);
        return lessonRepository.save(lesson);
    }
}
