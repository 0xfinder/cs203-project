package com.group7.app.lesson;

import com.group7.app.lesson.model.Lesson;
import com.group7.app.lesson.repository.LessonRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

@Component
public class LessonSeeder implements CommandLineRunner {

    private final LessonRepository lessonRepository;

    public LessonSeeder(LessonRepository lessonRepository) {
        this.lessonRepository = lessonRepository;
    }

    @Override
    public void run(String... args) throws Exception {
        // Only add if the table is empty to avoid duplicates
        if (lessonRepository.count() == 0) {
            lessonRepository.save(new Lesson("Intro to Gen-Alpha Culture"));
            lessonRepository.save(new Lesson("Gen-Alpha Lingo"));
            lessonRepository.save(new Lesson("TikTok Trends Explained"));
        }
    }
}
