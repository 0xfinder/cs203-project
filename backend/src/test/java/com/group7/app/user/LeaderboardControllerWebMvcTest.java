package com.group7.app.user;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.group7.app.config.DatabaseRoleJwtAuthenticationConverter;
import com.group7.app.config.SecurityConfig;
import com.group7.app.lesson.service.AuthContextService;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(LeaderboardController.class)
@Import(SecurityConfig.class)
@ActiveProfiles("test")
class LeaderboardControllerWebMvcTest {

  @Autowired private MockMvc mockMvc;

  @MockitoBean private LeaderboardRepository leaderboardRepository;

  @MockitoBean private AuthContextService authContextService;

  @MockitoBean private JwtDecoder jwtDecoder;

  @MockitoBean
  private DatabaseRoleJwtAuthenticationConverter databaseRoleJwtAuthenticationConverter;

  @Test
  void getMyLeaderboardReturnsExactRanks() throws Exception {
    UUID learnerId = UUID.randomUUID();
    User learner = new User(learnerId, "learner@example.com");
    learner.setRole(Role.LEARNER);

    LeaderboardEntry topPlayer =
        new LeaderboardEntry(UUID.randomUUID(), "Top", "#111111", null, 500L, 12, 15, 42.0);
    LeaderboardEntry learnerEntry =
        new LeaderboardEntry(learnerId, "Learner", "#222222", null, 200L, 6, 8, 55.0);

    when(authContextService.resolveUser(any(Jwt.class))).thenReturn(learner);
    when(leaderboardRepository.getAllPlayers("points"))
        .thenReturn(
            List.of(
                topPlayer,
                learnerEntry,
                new LeaderboardEntry(UUID.randomUUID(), "C", null, null, 10L, 1, 1, 80.0)));
    when(leaderboardRepository.getAllPlayers("streak"))
        .thenReturn(List.of(topPlayer, learnerEntry));
    when(leaderboardRepository.getAllPlayers("speed")).thenReturn(List.of(learnerEntry, topPlayer));

    mockMvc
        .perform(
            get("/api/leaderboard/me")
                .with(
                    jwt()
                        .jwt(
                            token ->
                                token
                                    .subject(learnerId.toString())
                                    .claim("email", "learner@example.com"))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.entry.userId").value(learnerId.toString()))
        .andExpect(jsonPath("$.pointsRank").value(2))
        .andExpect(jsonPath("$.streakRank").value(2))
        .andExpect(jsonPath("$.speedRank").value(1))
        .andExpect(jsonPath("$.totalRankedUsers").value(3));
  }
}
