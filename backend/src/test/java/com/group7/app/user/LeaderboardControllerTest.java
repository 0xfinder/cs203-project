package com.group7.app.user;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.group7.app.lesson.service.AuthContextService;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.oauth2.jwt.Jwt;

@ExtendWith(MockitoExtension.class)
class LeaderboardControllerTest {

  @Mock private LeaderboardRepository leaderboardRepository;

  @Mock private AuthContextService authContextService;

  private LeaderboardController leaderboardController;

  @BeforeEach
  void setUp() {
    leaderboardController = new LeaderboardController(leaderboardRepository, authContextService);
  }

  @Test
  void getLeaderboardClampsLimitAndFallsBackToPointsSort() {
    List<LeaderboardEntry> expected = List.of();
    when(leaderboardRepository.getTopPlayers(eq("points"), any(PageRequest.class)))
        .thenReturn(expected);

    List<LeaderboardEntry> response = leaderboardController.getLeaderboard(999, "unknown");

    assertThat(response).isSameAs(expected);
    verify(leaderboardRepository).getTopPlayers("points", PageRequest.of(0, 100));
  }

  @Test
  void getMyLeaderboardReturnsNullRanksForNonLearners() {
    UUID userId = UUID.randomUUID();
    User moderator = new User(userId, "moderator@example.com");
    moderator.setRole(Role.MODERATOR);
    when(authContextService.resolveUser(any(Jwt.class))).thenReturn(moderator);
    when(leaderboardRepository.getAllPlayers("points"))
        .thenReturn(
            List.of(new LeaderboardEntry(UUID.randomUUID(), "Top", null, null, 300L, 4, 6, 30.0)));

    LeaderboardController.LeaderboardMeResponse response =
        leaderboardController.getMyLeaderboard(jwt(userId));

    assertThat(response.entry()).isNull();
    assertThat(response.pointsRank()).isNull();
    assertThat(response.streakRank()).isNull();
    assertThat(response.speedRank()).isNull();
    assertThat(response.totalRankedUsers()).isEqualTo(1);
  }

  @Test
  void getMyLeaderboardReturnsNullRanksWhenLearnerIsNotRanked() {
    UUID userId = UUID.randomUUID();
    User learner = new User(userId, "learner@example.com");
    learner.setRole(Role.LEARNER);
    LeaderboardEntry topPlayer =
        new LeaderboardEntry(UUID.randomUUID(), "Top", null, null, 300L, 4, 6, 30.0);

    when(authContextService.resolveUser(any(Jwt.class))).thenReturn(learner);
    when(leaderboardRepository.getAllPlayers("points")).thenReturn(List.of(topPlayer));
    when(leaderboardRepository.getAllPlayers("streak")).thenReturn(List.of(topPlayer));
    when(leaderboardRepository.getAllPlayers("speed")).thenReturn(List.of(topPlayer));

    LeaderboardController.LeaderboardMeResponse response =
        leaderboardController.getMyLeaderboard(jwt(userId));

    assertThat(response.entry()).isNull();
    assertThat(response.pointsRank()).isNull();
    assertThat(response.streakRank()).isNull();
    assertThat(response.speedRank()).isNull();
    assertThat(response.totalRankedUsers()).isEqualTo(1);
  }

  private Jwt jwt(UUID userId) {
    return Jwt.withTokenValue("token")
        .header("alg", "none")
        .subject(userId.toString())
        .claim("email", "user@example.com")
        .build();
  }
}
