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

    public ForumVoteService(QuestionVoteRepository questionVoteRepo,
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
    public VoteSummary castQuestionVote(Long questionId, UUID userId, QuestionVote.VoteType voteType) {
        Question question = questionRepo.findById(questionId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Question not found"));
        User user = userRepo.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        QuestionVote vote = questionVoteRepo.findByQuestionIdAndUserId(questionId, userId)
                .map(existing -> { existing.setVoteType(voteType); return existing; })
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
        return buildQuestionVoteSummary(questionId, userId);
    }

    private VoteSummary buildQuestionVoteSummary(Long questionId, UUID userId) {
        long up = questionVoteRepo.countByQuestionIdAndVoteType(questionId, QuestionVote.VoteType.THUMBS_UP);
        long down = questionVoteRepo.countByQuestionIdAndVoteType(questionId, QuestionVote.VoteType.THUMBS_DOWN);
        String userVote = userId == null ? null :
                questionVoteRepo.findByQuestionIdAndUserId(questionId, userId)
                        .map(v -> v.getVoteType().name())
                        .orElse(null);
        return new VoteSummary(up, down, userVote);
    }

    // ── Answer votes ────────────────────────────────────────────────────────

    @Transactional
    public VoteSummary castAnswerVote(Long answerId, UUID userId, AnswerVote.VoteType voteType) {
        Answer answer = answerRepo.findById(answerId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Answer not found"));
        User user = userRepo.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        AnswerVote vote = answerVoteRepo.findByAnswerIdAndUserId(answerId, userId)
                .map(existing -> { existing.setVoteType(voteType); return existing; })
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
        return buildAnswerVoteSummary(answerId, userId);
    }

    private VoteSummary buildAnswerVoteSummary(Long answerId, UUID userId) {
        long up = answerVoteRepo.countByAnswerIdAndVoteType(answerId, AnswerVote.VoteType.THUMBS_UP);
        long down = answerVoteRepo.countByAnswerIdAndVoteType(answerId, AnswerVote.VoteType.THUMBS_DOWN);
        String userVote = userId == null ? null :
                answerVoteRepo.findByAnswerIdAndUserId(answerId, userId)
                        .map(v -> v.getVoteType().name())
                        .orElse(null);
        return new VoteSummary(up, down, userVote);
    }
}
