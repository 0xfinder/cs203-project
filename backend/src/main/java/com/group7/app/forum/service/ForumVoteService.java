package com.group7.app.forum.service;

import com.group7.app.forum.dto.VoteSummary;
import com.group7.app.forum.model.Answer;
import com.group7.app.forum.model.AnswerVote;
import com.group7.app.forum.model.Question;
import com.group7.app.forum.model.QuestionVote;
import com.group7.app.forum.repository.AnswerRepository;
import com.group7.app.forum.repository.AnswerVoteRepository;
import com.group7.app.forum.repository.QuestionRepository;
import com.group7.app.forum.repository.QuestionVoteRepository;
import com.group7.app.user.User;
import com.group7.app.user.UserRepository;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ForumVoteService {

  private final QuestionVoteRepository questionVoteRepo;
  private final AnswerVoteRepository answerVoteRepo;
  private final QuestionRepository questionRepo;
  private final AnswerRepository answerRepo;
  private final UserRepository userRepo;

  public ForumVoteService(
      QuestionVoteRepository questionVoteRepo,
      AnswerVoteRepository answerVoteRepo,
      QuestionRepository questionRepo,
      AnswerRepository answerRepo,
      UserRepository userRepo) {
    this.questionVoteRepo = questionVoteRepo;
    this.answerVoteRepo = answerVoteRepo;
    this.questionRepo = questionRepo;
    this.answerRepo = answerRepo;
    this.userRepo = userRepo;
  }

  // ── Question votes ──────────────────────────────────────────────────────

  @Transactional
  public VoteSummary castQuestionVote(
      Long questionId, UUID userId, QuestionVote.VoteType voteType) {
    Question question =
        questionRepo
            .findById(questionId)
            .orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Question not found"));
    User user =
        userRepo
            .findById(userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

    QuestionVote vote =
        questionVoteRepo
            .findByQuestionIdAndUserId(questionId, userId)
            .map(
                existing -> {
                  existing.setVoteType(voteType);
                  return existing;
                })
            .orElseGet(() -> new QuestionVote(question, user, voteType));

    questionVoteRepo.save(vote);
    return buildQuestionVoteSummary(questionId, userId);
  }

  @Transactional
  public VoteSummary clearQuestionVote(Long questionId, UUID userId) {
    questionVoteRepo.deleteByQuestionIdAndUserId(questionId, userId);
    return buildQuestionVoteSummary(questionId, userId);
  }

  @Transactional(readOnly = true)
  public VoteSummary getQuestionVoteSummary(Long questionId, UUID userId) {
    return getQuestionVoteSummaries(List.of(questionId), userId)
        .getOrDefault(questionId, new VoteSummary(0, 0, null));
  }

  @Transactional(readOnly = true)
  public Map<Long, VoteSummary> getQuestionVoteSummaries(List<Long> questionIds, UUID userId) {
    return buildQuestionVoteSummaries(questionIds, userId);
  }

  private VoteSummary buildQuestionVoteSummary(Long questionId, UUID userId) {
    return getQuestionVoteSummary(questionId, userId);
  }

  // ── Answer votes ────────────────────────────────────────────────────────

  @Transactional
  public VoteSummary castAnswerVote(Long answerId, UUID userId, AnswerVote.VoteType voteType) {
    Answer answer =
        answerRepo
            .findById(answerId)
            .orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Answer not found"));
    User user =
        userRepo
            .findById(userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

    AnswerVote vote =
        answerVoteRepo
            .findByAnswerIdAndUserId(answerId, userId)
            .map(
                existing -> {
                  existing.setVoteType(voteType);
                  return existing;
                })
            .orElseGet(() -> new AnswerVote(answer, user, voteType));

    answerVoteRepo.save(vote);
    return buildAnswerVoteSummary(answerId, userId);
  }

  @Transactional
  public VoteSummary clearAnswerVote(Long answerId, UUID userId) {
    answerVoteRepo.deleteByAnswerIdAndUserId(answerId, userId);
    return buildAnswerVoteSummary(answerId, userId);
  }

  @Transactional(readOnly = true)
  public VoteSummary getAnswerVoteSummary(Long answerId, UUID userId) {
    return getAnswerVoteSummaries(List.of(answerId), userId)
        .getOrDefault(answerId, new VoteSummary(0, 0, null));
  }

  @Transactional(readOnly = true)
  public Map<Long, VoteSummary> getAnswerVoteSummaries(List<Long> answerIds, UUID userId) {
    return buildAnswerVoteSummaries(answerIds, userId);
  }

  private VoteSummary buildAnswerVoteSummary(Long answerId, UUID userId) {
    return getAnswerVoteSummary(answerId, userId);
  }

  private Map<Long, VoteSummary> buildQuestionVoteSummaries(
      Collection<Long> questionIds, UUID userId) {
    if (questionIds.isEmpty()) {
      return Map.of();
    }

    Map<Long, Long> upCounts = new HashMap<>();
    Map<Long, Long> downCounts = new HashMap<>();

    for (var row : questionVoteRepo.summarizeByQuestionIds(questionIds)) {
      if (row.getVoteType() == QuestionVote.VoteType.THUMBS_UP) {
        upCounts.put(row.getQuestionId(), row.getVoteCount());
      } else if (row.getVoteType() == QuestionVote.VoteType.THUMBS_DOWN) {
        downCounts.put(row.getQuestionId(), row.getVoteCount());
      }
    }

    Map<Long, String> userVotes = new HashMap<>();
    if (userId != null) {
      for (QuestionVote vote :
          questionVoteRepo.findAllByQuestionIdInAndUserId(questionIds, userId)) {
        userVotes.put(vote.getQuestion().getId(), vote.getVoteType().name());
      }
    }

    Map<Long, VoteSummary> summaries = new HashMap<>();
    for (Long questionId : questionIds) {
      summaries.put(
          questionId,
          new VoteSummary(
              upCounts.getOrDefault(questionId, 0L),
              downCounts.getOrDefault(questionId, 0L),
              userVotes.get(questionId)));
    }
    return summaries;
  }

  private Map<Long, VoteSummary> buildAnswerVoteSummaries(Collection<Long> answerIds, UUID userId) {
    if (answerIds.isEmpty()) {
      return Map.of();
    }

    Map<Long, Long> upCounts = new HashMap<>();
    Map<Long, Long> downCounts = new HashMap<>();

    for (var row : answerVoteRepo.summarizeByAnswerIds(answerIds)) {
      if (row.getVoteType() == AnswerVote.VoteType.THUMBS_UP) {
        upCounts.put(row.getAnswerId(), row.getVoteCount());
      } else if (row.getVoteType() == AnswerVote.VoteType.THUMBS_DOWN) {
        downCounts.put(row.getAnswerId(), row.getVoteCount());
      }
    }

    Map<Long, String> userVotes = new HashMap<>();
    if (userId != null) {
      for (AnswerVote vote : answerVoteRepo.findAllByAnswerIdInAndUserId(answerIds, userId)) {
        userVotes.put(vote.getAnswer().getId(), vote.getVoteType().name());
      }
    }

    Map<Long, VoteSummary> summaries = new HashMap<>();
    for (Long answerId : answerIds) {
      summaries.put(
          answerId,
          new VoteSummary(
              upCounts.getOrDefault(answerId, 0L),
              downCounts.getOrDefault(answerId, 0L),
              userVotes.get(answerId)));
    }
    return summaries;
  }
}
