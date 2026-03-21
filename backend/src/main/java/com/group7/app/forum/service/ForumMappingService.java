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

  public QuestionResponse toQuestionResponse(Question q, UUID currentUserId) {
    Map<UUID, User> userCache = new HashMap<>();
    AuthorInfo authorInfo = resolveAuthorInfo(q.getAuthorId(), q.getAuthor(), userCache);
    VoteSummary votes = voteService.getQuestionVoteSummary(q.getId(), currentUserId);

    List<AnswerResponse> answers =
        q.getAnswers() == null
            ? List.of()
            : q.getAnswers().stream()
                .map(a -> toAnswerResponse(a, currentUserId, userCache))
                .toList();

    return new QuestionResponse(
        q.getId(),
        q.getTitle(),
        q.getContent(),
        q.getAuthor(),
        authorInfo,
        q.getCreatedAt() != null ? q.getCreatedAt().toString() : null,
        answers,
        votes);
  }

  public AnswerResponse toAnswerResponse(Answer a, UUID currentUserId, Map<UUID, User> userCache) {
    AuthorInfo authorInfo = resolveAuthorInfo(a.getAuthorId(), a.getAuthor(), userCache);
    VoteSummary votes = voteService.getAnswerVoteSummary(a.getId(), currentUserId);
    return new AnswerResponse(
        a.getId(),
        a.getContent(),
        a.getAuthor(),
        authorInfo,
        a.getCreatedAt() != null ? a.getCreatedAt().toString() : null,
        votes);
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
}
