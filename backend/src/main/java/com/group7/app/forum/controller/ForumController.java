package com.group7.app.forum.controller;

import com.group7.app.forum.dto.*;
import com.group7.app.forum.model.Answer;
import com.group7.app.forum.model.AnswerVote;
import com.group7.app.forum.model.Question;
import com.group7.app.forum.model.QuestionVote;
import com.group7.app.forum.service.AnswerService;
import com.group7.app.forum.service.ForumMappingService;
import com.group7.app.forum.service.ForumVoteService;
import com.group7.app.forum.service.QuestionService;
import com.group7.app.user.User;
import com.group7.app.user.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/forum")
@Tag(name = "Forum", description = "Q&A forum endpoints")
public class ForumController {

  private final QuestionService questionService;
  private final AnswerService answerService;
  private final ForumVoteService voteService;
  private final ForumMappingService mappingService;
  private final UserService userService;

  public ForumController(
      QuestionService questionService,
      AnswerService answerService,
      ForumVoteService voteService,
      ForumMappingService mappingService,
      UserService userService) {
    this.questionService = questionService;
    this.answerService = answerService;
    this.voteService = voteService;
    this.mappingService = mappingService;
    this.userService = userService;
  }

  // ── Questions ────────────────────────────────────────────────────────────

  @GetMapping("/questions")
  @Operation(summary = "Get all questions with answers, author info, and vote summaries")
  public ResponseEntity<ForumQuestionPageResponse> getAllQuestions(
      @AuthenticationPrincipal Jwt jwt,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "10") int size,
      @RequestParam(required = false) String q) {
    if (page < 0 || size < 1 || size > 50) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "page must be >= 0 and size must be between 1 and 50");
    }

    UUID userId = jwt != null ? parseUserId(jwt) : null;
    Page<Question> resultPage = questionService.getQuestions(PageRequest.of(page, size), q);
    List<Question> questions = resultPage.getContent();
    var answerCounts =
        answerService.getAnswerCounts(questions.stream().map(Question::getId).toList());
    List<QuestionListItemResponse> items =
        mappingService.toQuestionListItemResponses(questions, userId, answerCounts);

    return ResponseEntity.ok(
        new ForumQuestionPageResponse(
            items,
            resultPage.getNumber(),
            resultPage.getSize(),
            resultPage.getTotalElements(),
            resultPage.getTotalPages(),
            resultPage.hasNext()));
  }

  @GetMapping("/questions/{id}")
  @Operation(summary = "Get a single question by ID")
  public ResponseEntity<QuestionResponse> getQuestion(
      @PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
    UUID userId = jwt != null ? parseUserId(jwt) : null;
    Question q = questionService.getQuestionWithAnswers(id);
    return ResponseEntity.ok(mappingService.toQuestionResponse(q, userId));
  }

  @PostMapping("/questions")
  @Operation(summary = "Post a new question (requires auth)")
  public ResponseEntity<QuestionResponse> postQuestion(
      @AuthenticationPrincipal Jwt jwt, @Valid @RequestBody PostQuestionRequest request) {
    User user = resolveUser(jwt);
    requireOnboardingCompleted(user);
    Question q = new Question();
    q.setTitle(request.title().trim());
    q.setContent(request.content().trim());
    q.setAuthor(
        user.getDisplayName() != null ? user.getDisplayName() : user.getEmail().split("@")[0]);
    q.setAuthorId(user.getId());
    Question created = questionService.createQuestion(q);
    return ResponseEntity.status(HttpStatus.CREATED)
        .body(mappingService.toQuestionResponse(created, user.getId()));
  }

  @DeleteMapping("/questions/{id}")
  @Operation(summary = "Delete a question (owner or admin/moderator)")
  public ResponseEntity<Void> deleteQuestion(
      @PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
    User user = resolveUser(jwt);
    Question q = questionService.getQuestion(id);
    if (!user.getId().equals(q.getAuthorId())
        && user.getRole() != com.group7.app.user.Role.ADMIN
        && user.getRole() != com.group7.app.user.Role.MODERATOR) {
      throw new ResponseStatusException(
          HttpStatus.FORBIDDEN, "Not allowed to delete this question");
    }
    questionService.deleteQuestion(id);
    return ResponseEntity.noContent().build();
  }

  @PatchMapping("/questions/{id}/resolve")
  @Operation(summary = "Toggle resolved status on own question")
  public ResponseEntity<QuestionListItemResponse> resolveQuestion(
      @PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
    User user = resolveUser(jwt);
    Question q = questionService.resolveQuestion(id, user.getId());
    var answerCounts = answerService.getAnswerCounts(List.of(q.getId()));
    var items = mappingService.toQuestionListItemResponses(List.of(q), user.getId(), answerCounts);
    return ResponseEntity.ok(items.getFirst());
  }

  // ── Answers ──────────────────────────────────────────────────────────────

  @GetMapping("/questions/{id}/answers")
  @Operation(summary = "Get all answers for a question")
  public ResponseEntity<List<AnswerResponse>> getAnswers(
      @PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
    UUID userId = jwt != null ? parseUserId(jwt) : null;
    List<AnswerResponse> result =
        mappingService.toAnswerResponses(answerService.getAnswersForQuestion(id), userId);
    return ResponseEntity.ok(result);
  }

  @PostMapping("/questions/{id}/answers")
  @Operation(summary = "Post an answer to a question (requires auth)")
  public ResponseEntity<AnswerResponse> postAnswer(
      @PathVariable Long id,
      @AuthenticationPrincipal Jwt jwt,
      @Valid @RequestBody PostAnswerRequest request) {
    User user = resolveUser(jwt);
    requireOnboardingCompleted(user);
    Answer a = new Answer();
    a.setContent(request.content().trim());
    a.setAuthor(
        user.getDisplayName() != null ? user.getDisplayName() : user.getEmail().split("@")[0]);
    a.setAuthorId(user.getId());
    Answer created = answerService.postAnswer(id, a);
    return ResponseEntity.status(HttpStatus.CREATED)
        .body(mappingService.toAnswerResponse(created, user.getId()));
  }

  @DeleteMapping("/answers/{answerId}")
  @Operation(summary = "Delete an answer (owner or admin/moderator)")
  public ResponseEntity<Void> deleteAnswer(
      @PathVariable Long answerId, @AuthenticationPrincipal Jwt jwt) {
    User user = resolveUser(jwt);
    Answer a = answerService.getAnswer(answerId);
    if (!user.getId().equals(a.getAuthorId())
        && user.getRole() != com.group7.app.user.Role.ADMIN
        && user.getRole() != com.group7.app.user.Role.MODERATOR) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not allowed to delete this answer");
    }
    answerService.deleteAnswer(answerId);
    return ResponseEntity.noContent().build();
  }

  // ── Votes ────────────────────────────────────────────────────────────────

  @PostMapping("/questions/{id}/votes")
  @Operation(summary = "Cast or update a vote on a question")
  public VoteSummary voteQuestion(
      @PathVariable Long id,
      @AuthenticationPrincipal Jwt jwt,
      @Valid @RequestBody ForumVoteRequest request) {
    User user = resolveUser(jwt);
    requireOnboardingCompleted(user);
    QuestionVote.VoteType vt = QuestionVote.VoteType.valueOf(request.voteType());
    return voteService.castQuestionVote(id, user.getId(), vt);
  }

  @DeleteMapping("/questions/{id}/votes")
  @Operation(summary = "Remove vote on a question")
  public VoteSummary clearQuestionVote(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
    User user = resolveUser(jwt);
    requireOnboardingCompleted(user);
    return voteService.clearQuestionVote(id, user.getId());
  }

  @PostMapping("/answers/{answerId}/votes")
  @Operation(summary = "Cast or update a vote on an answer")
  public VoteSummary voteAnswer(
      @PathVariable Long answerId,
      @AuthenticationPrincipal Jwt jwt,
      @Valid @RequestBody ForumVoteRequest request) {
    User user = resolveUser(jwt);
    requireOnboardingCompleted(user);
    AnswerVote.VoteType vt = AnswerVote.VoteType.valueOf(request.voteType());
    return voteService.castAnswerVote(answerId, user.getId(), vt);
  }

  @DeleteMapping("/answers/{answerId}/votes")
  @Operation(summary = "Remove vote on an answer")
  public VoteSummary clearAnswerVote(
      @PathVariable Long answerId, @AuthenticationPrincipal Jwt jwt) {
    User user = resolveUser(jwt);
    requireOnboardingCompleted(user);
    return voteService.clearAnswerVote(answerId, user.getId());
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private User resolveUser(Jwt jwt) {
    UUID userId = parseUserId(jwt);
    String email = getEmail(jwt);
    return userService.findById(userId).orElseGet(() -> userService.createFromAuth(userId, email));
  }

  private void requireOnboardingCompleted(User user) {
    if (!userService.isOnboardingCompleted(user)) {
      throw new ResponseStatusException(
          HttpStatus.FORBIDDEN, "complete onboarding before posting or voting in the forum");
    }
  }

  private static UUID parseUserId(Jwt jwt) {
    String subject = jwt.getSubject();
    if (subject == null || subject.isBlank()) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "missing token subject");
    }
    try {
      return UUID.fromString(subject);
    } catch (IllegalArgumentException ex) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "invalid token subject");
    }
  }

  private static String getEmail(Jwt jwt) {
    String email = jwt.getClaimAsString("email");
    if (email == null || email.isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "missing email claim");
    }
    return email;
  }
}
