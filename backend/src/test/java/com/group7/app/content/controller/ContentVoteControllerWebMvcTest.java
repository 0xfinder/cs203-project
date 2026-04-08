package com.group7.app.content.controller;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.group7.app.config.DatabaseRoleJwtAuthenticationConverter;
import com.group7.app.config.SecurityConfig;
import com.group7.app.content.model.Content;
import com.group7.app.content.model.ContentVote;
import com.group7.app.content.model.ContentWithVotesResponse;
import com.group7.app.content.service.ContentVoteService;
import com.group7.app.support.TestJwtFactory;
import com.group7.app.user.User;
import com.group7.app.user.UserService;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(ContentVoteController.class)
@Import(SecurityConfig.class)
@ActiveProfiles("test")
class ContentVoteControllerWebMvcTest {

  @Autowired private MockMvc mockMvc;

  @MockitoBean private ContentVoteService contentVoteService;

  @MockitoBean private UserService userService;

  @MockitoBean private JwtDecoder jwtDecoder;

  @MockitoBean
  private DatabaseRoleJwtAuthenticationConverter databaseRoleJwtAuthenticationConverter;

  @Test
  void approvedWithVotesEndpointIsPublicForGuests() throws Exception {
    Content approved = new Content("rizz", "charisma", "example", "creator@example.com");
    approved.setStatus(Content.Status.APPROVED);
    org.springframework.test.util.ReflectionTestUtils.setField(approved, "id", 7L);

    when(contentVoteService.getApprovedContentsWithVotes(null))
        .thenReturn(
            List.of(new ContentWithVotesResponse(approved, 3L, 1L, null, "creator@example.com")));

    mockMvc
        .perform(get("/api/contents/approved-with-votes"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].content.term").value("rizz"))
        .andExpect(jsonPath("$[0].thumbsUp").value(3))
        .andExpect(jsonPath("$[0].userVote").isEmpty());

    verify(contentVoteService).getApprovedContentsWithVotes(null);
    verifyNoInteractions(userService);
  }

  @Test
  void approvedWithVotesEndpointKeepsAuthenticatedUserVoteState() throws Exception {
    UUID userId = UUID.randomUUID();
    Content approved = new Content("rizz", "charisma", "example", "creator@example.com");
    approved.setStatus(Content.Status.APPROVED);
    org.springframework.test.util.ReflectionTestUtils.setField(approved, "id", 9L);
    User user = new User(userId, "learner@example.com");

    when(userService.findById(userId)).thenReturn(Optional.of(user));
    when(contentVoteService.getApprovedContentsWithVotes(userId))
        .thenReturn(
            List.of(
                new ContentWithVotesResponse(
                    approved, 4L, 0L, ContentVote.VoteType.THUMBS_UP, "Kai")));

    mockMvc
        .perform(
            get("/api/contents/approved-with-votes")
                .with(TestJwtFactory.jwt(userId, "learner@example.com", "LEARNER")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].content.term").value("rizz"))
        .andExpect(jsonPath("$[0].userVote").value("THUMBS_UP"));

    verify(userService).findById(userId);
    verify(contentVoteService).getApprovedContentsWithVotes(userId);
  }
}
