package com.group7.app.forum.service;

import com.group7.app.forum.dto.*;
import com.group7.app.forum.model.Answer;
import com.group7.app.forum.model.Question;
import com.group7.app.user.User;
import com.group7.app.user.UserRepository;
import java.util.*;
import org.springframework.stereotype.Service;

@Service
public class ForumMappingService {

  private final UserRepository userRepo;
  private final ForumVoteService voteService;

  public ForumMappingService(UserRepository userRepo, ForumVoteService voteService) {
    this.userRepo = userRepo;
    this.voteService = voteService;
  }

  public List<QuestionListItemResponse> toQuestionListItemResponses(
      List<Question> questions, UUID currentUserId, Map<Long, Long> answerCounts) {
    if (questions.isEmpty()) {
      return List.of();
    }

    Map<UUID, User> userCache = buildUserCache(collectAuthorIds(questions), Set.of());
    Map<Long, VoteSummary> voteSummaries =
        voteService.getQuestionVoteSummaries(
            questions.stream().map(Question::getId).filter(Objects::nonNull).toList(),
            currentUserId);

    return questions.stream()
        .map(
            question ->
                new QuestionListItemResponse(
                    question.getId(),
                    question.getTitle(),
                    question.getContent(),
                    question.getAuthor(),
                    resolveAuthorInfo(question.getAuthorId(), question.getAuthor(), userCache),
                    question.getCreatedAt() != null ? question.getCreatedAt().toString() : null,
                    answerCounts.getOrDefault(question.getId(), 0L),
                    voteSummaries.getOrDefault(question.getId(), new VoteSummary(0, 0, null))))
        .toList();
  }

  public QuestionResponse toQuestionResponse(Question q, UUID currentUserId) {
    List<Answer> answers = q.getAnswers() == null ? List.of() : q.getAnswers();
    Map<UUID, User> userCache =
        buildUserCache(collectAuthorIds(List.of(q)), collectAuthorIdsFromAnswers(answers));
    Map<Long, VoteSummary> questionVotes =
        voteService.getQuestionVoteSummaries(List.of(q.getId()), currentUserId);
    Map<Long, VoteSummary> answerVotes =
        voteService.getAnswerVoteSummaries(
            answers.stream().map(Answer::getId).filter(Objects::nonNull).toList(), currentUserId);
    AuthorInfo authorInfo = resolveAuthorInfo(q.getAuthorId(), q.getAuthor(), userCache);

    List<AnswerResponse> mappedAnswers =
        answers.stream()
            .map(a -> toAnswerResponse(a, userCache, answerVotes.get(a.getId())))
            .toList();

    return new QuestionResponse(
        q.getId(),
        q.getTitle(),
        q.getContent(),
        q.getAuthor(),
        authorInfo,
        q.getCreatedAt() != null ? q.getCreatedAt().toString() : null,
        mappedAnswers.size(),
        mappedAnswers,
        questionVotes.getOrDefault(q.getId(), new VoteSummary(0, 0, null)));
  }

  public List<AnswerResponse> toAnswerResponses(List<Answer> answers, UUID currentUserId) {
    if (answers.isEmpty()) {
      return List.of();
    }

    Map<UUID, User> userCache = buildUserCache(Set.of(), collectAuthorIdsFromAnswers(answers));
    Map<Long, VoteSummary> voteSummaries =
        voteService.getAnswerVoteSummaries(
            answers.stream().map(Answer::getId).filter(Objects::nonNull).toList(), currentUserId);

    return answers.stream()
        .map(answer -> toAnswerResponse(answer, userCache, voteSummaries.get(answer.getId())))
        .toList();
  }

  public AnswerResponse toAnswerResponse(Answer answer, UUID currentUserId) {
    return toAnswerResponses(List.of(answer), currentUserId).getFirst();
  }

  private AnswerResponse toAnswerResponse(
      Answer answer, Map<UUID, User> userCache, VoteSummary votes) {
    AuthorInfo authorInfo = resolveAuthorInfo(answer.getAuthorId(), answer.getAuthor(), userCache);
    return new AnswerResponse(
        answer.getId(),
        answer.getContent(),
        answer.getAuthor(),
        authorInfo,
        answer.getCreatedAt() != null ? answer.getCreatedAt().toString() : null,
        votes != null ? votes : new VoteSummary(0, 0, null));
  }

  private AuthorInfo resolveAuthorInfo(UUID authorId, String fallbackName, Map<UUID, User> cache) {
    User user = null;
    if (authorId != null) {
      user = cache.computeIfAbsent(authorId, id -> userRepo.findById(id).orElse(null));
    }
    // fallback: try matching by display name for old posts without author_id
    if (user == null && fallbackName != null && !fallbackName.isBlank()) {
      user = userRepo.findFirstByDisplayNameIgnoreCase(fallbackName).orElse(null);
      if (user != null) {
        cache.put(user.getId(), user);
      }
    }
    if (user == null) {
      return new AuthorInfo(null, fallbackName, null, null, null);
    }
    String name = user.getDisplayName() != null ? user.getDisplayName() : fallbackName;
    return new AuthorInfo(
        user.getId().toString(),
        name,
        user.getAvatarPath(),
        user.getAvatarColor(),
        user.getRole() != null ? user.getRole().name() : null);
  }

  private Map<UUID, User> buildUserCache(Set<UUID> questionAuthorIds, Set<UUID> answerAuthorIds) {
    Set<UUID> authorIds = new HashSet<>(questionAuthorIds);
    authorIds.addAll(answerAuthorIds);

    if (authorIds.isEmpty()) {
      return new HashMap<>();
    }

    Map<UUID, User> cache = new HashMap<>();
    for (User user : userRepo.findAllById(authorIds)) {
      cache.put(user.getId(), user);
    }
    return cache;
  }

  private Set<UUID> collectAuthorIds(List<Question> questions) {
    Set<UUID> authorIds = new HashSet<>();
    for (Question question : questions) {
      if (question.getAuthorId() != null) {
        authorIds.add(question.getAuthorId());
      }
    }
    return authorIds;
  }

  private Set<UUID> collectAuthorIdsFromAnswers(List<Answer> answers) {
    Set<UUID> authorIds = new HashSet<>();
    for (Answer answer : answers) {
      if (answer.getAuthorId() != null) {
        authorIds.add(answer.getAuthorId());
      }
    }
    return authorIds;
  }
}
