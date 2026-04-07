package com.group7.app.content.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.group7.app.content.model.Content;
import com.group7.app.content.model.ContentVote;
import com.group7.app.content.repository.ContentRepository;
import com.group7.app.content.repository.ContentVoteRepository;
import com.group7.app.user.User;
import com.group7.app.user.UserRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

@ExtendWith(MockitoExtension.class)
class ContentVoteServiceTest {

  @Mock private ContentVoteRepository contentVoteRepository;

  @Mock private ContentRepository contentRepository;

  @Mock private UserRepository userRepository;

  private ContentVoteService contentVoteService;

  @BeforeEach
  void setUp() {
    contentVoteService =
        new ContentVoteService(contentVoteRepository, contentRepository, userRepository);
  }

  @Test
  void castVoteCreatesVoteAndReturnsSummary() {
    UUID userId = UUID.randomUUID();
    Content content = new Content("rizz", "charisma", "example", "creator@example.com");
    User user = new User(userId, "user@example.com");

    org.springframework.test.util.ReflectionTestUtils.setField(content, "id", 11L);

    when(contentRepository.findById(11L)).thenReturn(Optional.of(content));
    when(userRepository.findById(userId)).thenReturn(Optional.of(user));
    when(contentVoteRepository.findByContentIdAndUserId(11L, userId)).thenReturn(Optional.empty());
    when(contentVoteRepository.save(any(ContentVote.class)))
        .thenAnswer(invocation -> invocation.getArgument(0));
    when(contentVoteRepository.countByContentIdAndVoteType(11L, ContentVote.VoteType.THUMBS_UP))
        .thenReturn(1L);
    when(contentVoteRepository.countByContentIdAndVoteType(11L, ContentVote.VoteType.THUMBS_DOWN))
        .thenReturn(0L);
    when(contentVoteRepository.findByContentIdAndUserId(11L, userId))
        .thenReturn(Optional.of(new ContentVote(content, user, ContentVote.VoteType.THUMBS_UP)));

    var summary = contentVoteService.castVote(11L, userId, ContentVote.VoteType.THUMBS_UP);

    assertThat(summary.contentId()).isEqualTo(11L);
    assertThat(summary.thumbsUp()).isEqualTo(1L);
    assertThat(summary.thumbsDown()).isZero();
    assertThat(summary.userVote()).isEqualTo(ContentVote.VoteType.THUMBS_UP);
    verify(contentVoteRepository).save(any(ContentVote.class));
  }

  @Test
  void clearVoteRejectsMissingContent() {
    when(contentRepository.existsById(55L)).thenReturn(false);

    assertThatThrownBy(() -> contentVoteService.clearVote(55L, UUID.randomUUID()))
        .isInstanceOf(ResponseStatusException.class)
        .hasMessageContaining("Content not found");
  }

  @Test
  void getApprovedContentsWithVotesUsesDisplayNameFallbacks() {
    UUID userId = UUID.randomUUID();
    Content approved = new Content("rizz", "charisma", "example", "creator@example.com");
    Content approvedWithoutProfile = new Content("cap", "lie", "example", "legacy@example.com");
    User creator = new User(UUID.randomUUID(), "creator@example.com");
    creator.setDisplayName("Kai");

    org.springframework.test.util.ReflectionTestUtils.setField(approved, "id", 1L);
    approved.setStatus(Content.Status.APPROVED);
    org.springframework.test.util.ReflectionTestUtils.setField(approvedWithoutProfile, "id", 2L);
    approvedWithoutProfile.setStatus(Content.Status.APPROVED);

    when(contentRepository.findByStatus(Content.Status.APPROVED))
        .thenReturn(List.of(approved, approvedWithoutProfile));
    when(contentVoteRepository.countByContentIdAndVoteType(1L, ContentVote.VoteType.THUMBS_UP))
        .thenReturn(3L);
    when(contentVoteRepository.countByContentIdAndVoteType(1L, ContentVote.VoteType.THUMBS_DOWN))
        .thenReturn(1L);
    when(contentVoteRepository.countByContentIdAndVoteType(2L, ContentVote.VoteType.THUMBS_UP))
        .thenReturn(0L);
    when(contentVoteRepository.countByContentIdAndVoteType(2L, ContentVote.VoteType.THUMBS_DOWN))
        .thenReturn(2L);
    when(contentVoteRepository.findByContentIdAndUserId(1L, userId))
        .thenReturn(
            Optional.of(
                new ContentVote(
                    approved,
                    new User(userId, "viewer@example.com"),
                    ContentVote.VoteType.THUMBS_UP)));
    when(contentVoteRepository.findByContentIdAndUserId(2L, userId)).thenReturn(Optional.empty());
    when(userRepository.findByEmailIgnoreCase("creator@example.com"))
        .thenReturn(Optional.of(creator));
    when(userRepository.findByEmailIgnoreCase("legacy@example.com")).thenReturn(Optional.empty());

    var responses = contentVoteService.getApprovedContentsWithVotes(userId);

    assertThat(responses).hasSize(2);
    assertThat(responses.get(0).submittedByDisplayName()).isEqualTo("Kai");
    assertThat(responses.get(0).userVote()).isEqualTo(ContentVote.VoteType.THUMBS_UP);
    assertThat(responses.get(1).submittedByDisplayName()).isEqualTo("legacy@example.com");
  }

  @Test
  void getApprovedContentsWithVotesForSubmitterFiltersInRepository() {
    UUID userId = UUID.randomUUID();
    Content approved = new Content("rizz", "charisma", "example", "creator@example.com");
    User creator = new User(UUID.randomUUID(), "creator@example.com");
    creator.setDisplayName("Kai");

    org.springframework.test.util.ReflectionTestUtils.setField(approved, "id", 9L);
    approved.setStatus(Content.Status.APPROVED);

    when(contentRepository.findByStatusAndSubmittedByIgnoreCase(
            Content.Status.APPROVED, "creator@example.com"))
        .thenReturn(List.of(approved));
    when(contentVoteRepository.countByContentIdAndVoteType(9L, ContentVote.VoteType.THUMBS_UP))
        .thenReturn(4L);
    when(contentVoteRepository.countByContentIdAndVoteType(9L, ContentVote.VoteType.THUMBS_DOWN))
        .thenReturn(1L);
    when(contentVoteRepository.findByContentIdAndUserId(9L, userId)).thenReturn(Optional.empty());
    when(userRepository.findByEmailIgnoreCase("creator@example.com"))
        .thenReturn(Optional.of(creator));

    var responses =
        contentVoteService.getApprovedContentsWithVotesForSubmitter(userId, "creator@example.com");

    assertThat(responses).hasSize(1);
    assertThat(responses.getFirst().content().getSubmittedBy()).isEqualTo("creator@example.com");
    assertThat(responses.getFirst().thumbsUp()).isEqualTo(4L);
    assertThat(responses.getFirst().submittedByDisplayName()).isEqualTo("Kai");
  }
}
