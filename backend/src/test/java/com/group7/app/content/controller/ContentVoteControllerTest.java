package com.group7.app.content.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.group7.app.content.model.ContentVote;
import com.group7.app.content.model.ContentVoteRequest;
import com.group7.app.content.model.ContentVoteSummaryResponse;
import com.group7.app.content.model.ContentWithVotesResponse;
import com.group7.app.content.service.ContentVoteService;
import com.group7.app.user.User;
import com.group7.app.user.UserService;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.server.ResponseStatusException;

@ExtendWith(MockitoExtension.class)
class ContentVoteControllerTest {

  @Mock private ContentVoteService contentVoteService;

  @Mock private UserService userService;

  private ContentVoteController contentVoteController;

  @BeforeEach
  void setUp() {
    contentVoteController = new ContentVoteController(contentVoteService, userService);
  }

  @Test
  void getApprovedWithVotesAllowsAnonymousRequests() {
    List<ContentWithVotesResponse> expected = List.of();
    when(contentVoteService.getApprovedContentsWithVotes(null)).thenReturn(expected);

    List<ContentWithVotesResponse> response = contentVoteController.getApprovedWithVotes(null);

    assertThat(response).isSameAs(expected);
    verifyNoInteractions(userService);
  }

  @Test
  void getApprovedWithVotesBootstrapsAuthenticatedUser() {
    UUID userId = UUID.randomUUID();
    User created = new User(userId, "user@example.com");
    List<ContentWithVotesResponse> expected = List.of();

    when(userService.findById(userId)).thenReturn(Optional.empty());
    when(userService.createFromAuth(userId, "user@example.com")).thenReturn(created);
    when(contentVoteService.getApprovedContentsWithVotes(userId)).thenReturn(expected);

    List<ContentWithVotesResponse> response =
        contentVoteController.getApprovedWithVotes(jwt(userId.toString(), "user@example.com"));

    assertThat(response).isSameAs(expected);
  }

  @Test
  void castVoteRequiresEmailWhenUserIsMissing() {
    UUID userId = UUID.randomUUID();
    when(userService.findById(userId)).thenReturn(Optional.empty());

    assertThatThrownBy(
            () ->
                contentVoteController.castVote(
                    jwt(userId.toString(), " "),
                    9L,
                    new ContentVoteRequest(ContentVote.VoteType.THUMBS_UP)))
        .isInstanceOfSatisfying(
            ResponseStatusException.class,
            ex -> {
              assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
              assertThat(ex.getReason()).isEqualTo("missing email claim");
            });
  }

  @Test
  void castVoteDelegatesToService() {
    UUID userId = UUID.randomUUID();
    User existing = new User(userId, "user@example.com");
    ContentVoteSummaryResponse summary =
        new ContentVoteSummaryResponse(9L, 4, 1, ContentVote.VoteType.THUMBS_UP);

    when(userService.findById(userId)).thenReturn(Optional.of(existing));
    when(contentVoteService.castVote(9L, userId, ContentVote.VoteType.THUMBS_UP))
        .thenReturn(summary);

    ContentVoteSummaryResponse response =
        contentVoteController.castVote(
            jwt(userId.toString(), "user@example.com"),
            9L,
            new ContentVoteRequest(ContentVote.VoteType.THUMBS_UP));

    assertThat(response).isSameAs(summary);
  }

  @Test
  void getMyContentsWithVotesCreatesMissingUserAndUsesEmail() {
    UUID userId = UUID.randomUUID();
    User created = new User(userId, "user@example.com");
    List<ContentWithVotesResponse> expected = List.of();

    when(userService.findById(userId)).thenReturn(Optional.empty());
    when(userService.createFromAuth(userId, "user@example.com")).thenReturn(created);
    when(contentVoteService.getApprovedContentsWithVotesForSubmitter(
            eq(userId), eq("user@example.com")))
        .thenReturn(expected);

    List<ContentWithVotesResponse> response =
        contentVoteController.getMyContentsWithVotes(jwt(userId.toString(), "user@example.com"));

    assertThat(response).isSameAs(expected);
  }

  private Jwt jwt(String subject, String email) {
    return Jwt.withTokenValue("token")
        .header("alg", "none")
        .subject(subject)
        .claim("email", email)
        .build();
  }
}
