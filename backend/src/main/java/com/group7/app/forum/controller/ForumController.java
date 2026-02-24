package com.group7.app.forum.controller;

import com.group7.app.forum.model.Answer;
import com.group7.app.forum.model.Question;
import com.group7.app.forum.service.AnswerService;
import com.group7.app.forum.service.QuestionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/forum")
@CrossOrigin(origins = "*")   // ← fixes CORS; tighten to your frontend origin in production
@Tag(name = "Forum", description = "Q&A forum endpoints")
public class ForumController {

    private final QuestionService questionService;
    private final AnswerService answerService;

    public ForumController(QuestionService questionService, AnswerService answerService) {
        this.questionService = questionService;
        this.answerService = answerService;
    }

    // ── Questions ────────────────────────────────────────────────────────────

    @GetMapping("/questions")
    @Operation(summary = "Get all questions (with answers embedded)")
    public ResponseEntity<List<Question>> getAllQuestions() {
        return ResponseEntity.ok(questionService.getAllQuestions());
    }

    @GetMapping("/questions/{id}")
    @Operation(summary = "Get a single question by ID")
    public ResponseEntity<Question> getQuestion(@PathVariable Long id) {
        return ResponseEntity.ok(questionService.getQuestion(id));
    }

    @PostMapping("/questions")
    @Operation(summary = "Post a new question")
    public ResponseEntity<Question> postQuestion(@RequestBody Question question) {
        Question created = questionService.createQuestion(question);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @DeleteMapping("/questions/{id}")
    @Operation(summary = "Delete a question (and its answers)")
    public ResponseEntity<Void> deleteQuestion(@PathVariable Long id) {
        questionService.deleteQuestion(id);
        return ResponseEntity.noContent().build();
    }

    // ── Answers ──────────────────────────────────────────────────────────────

    @GetMapping("/questions/{id}/answers")
    @Operation(summary = "Get all answers for a question")
    public ResponseEntity<List<Answer>> getAnswers(@PathVariable Long id) {
        return ResponseEntity.ok(answerService.getAnswersForQuestion(id));
    }

    @PostMapping("/questions/{id}/answers")
    @Operation(summary = "Post an answer to a question")
    public ResponseEntity<Answer> postAnswer(@PathVariable Long id, @RequestBody Answer answer) {
        Answer created = answerService.postAnswer(id, answer);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @DeleteMapping("/answers/{answerId}")
    @Operation(summary = "Delete an answer")
    public ResponseEntity<Void> deleteAnswer(@PathVariable Long answerId) {
        answerService.deleteAnswer(answerId);
        return ResponseEntity.noContent().build();
    }
}