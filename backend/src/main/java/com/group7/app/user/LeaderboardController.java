package com.group7.app.user;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import org.springframework.data.domain.PageRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/leaderboard")
@Tag(name = "Leaderboard", description = "Global user rankings and scores")
public class LeaderboardController {

  private final LeaderboardRepository leaderboardRepository;

  public LeaderboardController(LeaderboardRepository leaderboardRepository) {
    this.leaderboardRepository = leaderboardRepository;
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
}
