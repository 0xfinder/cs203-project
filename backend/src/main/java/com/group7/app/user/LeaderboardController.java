package com.group7.app.user;

import com.group7.app.lesson.service.AuthContextService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/leaderboard")
@Tag(name = "Leaderboard", description = "Global user rankings and scores")
public class LeaderboardController {

  private final LeaderboardRepository leaderboardRepository;
  private final AuthContextService authContextService;

  public LeaderboardController(
      LeaderboardRepository leaderboardRepository, AuthContextService authContextService) {
    this.leaderboardRepository = leaderboardRepository;
    this.authContextService = authContextService;
  }

  @GetMapping
  @Operation(summary = "Get global leaderboard")
  public List<LeaderboardEntry> getLeaderboard(
      @RequestParam(defaultValue = "10") int limit,
      @RequestParam(defaultValue = "points") String sortBy) {
    int safeLimit = Math.max(1, Math.min(limit, 100));
    String safeSortBy =
        List.of("points", "streak", "speed").contains(sortBy.toLowerCase())
            ? sortBy.toLowerCase()
            : "points";
    return leaderboardRepository.getTopPlayers(safeSortBy, PageRequest.of(0, safeLimit));
  }

  @GetMapping("/me")
  @Operation(summary = "Get leaderboard ranks for the current user")
  public LeaderboardMeResponse getMyLeaderboard(@AuthenticationPrincipal Jwt jwt) {
    User user = authContextService.resolveUser(jwt);
    List<LeaderboardEntry> pointsBoard = leaderboardRepository.getAllPlayers("points");
    int totalRankedUsers = pointsBoard.size();

    if (user.getRole() != Role.LEARNER) {
      return new LeaderboardMeResponse(null, null, null, null, totalRankedUsers);
    }

    UUID userId = user.getId();
    return new LeaderboardMeResponse(
        findEntry(pointsBoard, userId),
        findRank(pointsBoard, userId),
        findRank(leaderboardRepository.getAllPlayers("streak"), userId),
        findRank(leaderboardRepository.getAllPlayers("speed"), userId),
        totalRankedUsers);
  }

  private static LeaderboardEntry findEntry(List<LeaderboardEntry> board, UUID userId) {
    return board.stream().filter(entry -> entry.userId().equals(userId)).findFirst().orElse(null);
  }

  private static Integer findRank(List<LeaderboardEntry> board, UUID userId) {
    for (int i = 0; i < board.size(); i++) {
      if (board.get(i).userId().equals(userId)) {
        return i + 1;
      }
    }
    return null;
  }

  public record LeaderboardMeResponse(
      LeaderboardEntry entry,
      Integer pointsRank,
      Integer streakRank,
      Integer speedRank,
      int totalRankedUsers) {}
}
