package com.group7.app.content.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.group7.app.content.model.Content;
import com.group7.app.content.model.ContentVote;
import com.group7.app.content.repository.ContentRepository;
import com.group7.app.content.repository.ContentVoteRepository;
import com.group7.app.user.User;
import com.group7.app.user.UserRepository;
import java.util.Collection;
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
    when(contentVoteRepository.summarizeByContentIds(argThat(ids -> matchesIds(ids, 1L, 2L))))
        .thenReturn(
            List.of(
                countView(1L, ContentVote.VoteType.THUMBS_UP, 3L),
                countView(1L, ContentVote.VoteType.THUMBS_DOWN, 1L),
                countView(2L, ContentVote.VoteType.THUMBS_DOWN, 2L)));
    when(contentVoteRepository.findAllByContentIdInAndUserId(
            argThat(ids -> matchesIds(ids, 1L, 2L)), org.mockito.ArgumentMatchers.eq(userId)))
        .thenReturn(
            List.of(
                new ContentVote(
                    approved,
                    new User(userId, "viewer@example.com"),
                    ContentVote.VoteType.THUMBS_UP)));
    when(userRepository.findAllByEmailLowercaseIn(
            argThat(emails -> matchesStrings(emails, "creator@example.com", "legacy@example.com"))))
        .thenReturn(List.of(creator));

    var responses = contentVoteService.getApprovedContentsWithVotes(userId);

    assertThat(responses).hasSize(2);
    assertThat(responses.get(0).submittedByDisplayName()).isEqualTo("Kai");
    assertThat(responses.get(0).userVote()).isEqualTo(ContentVote.VoteType.THUMBS_UP);
    assertThat(responses.get(1).submittedByDisplayName()).isEqualTo("legacy@example.com");
  }

  @Test
  void getApprovedContentsWithVotesReturnsNullUserVoteForGuests() {
    Content approved = new Content("rizz", "charisma", "example", "creator@example.com");
    org.springframework.test.util.ReflectionTestUtils.setField(approved, "id", 3L);
    approved.setStatus(Content.Status.APPROVED);

    when(contentRepository.findByStatus(Content.Status.APPROVED)).thenReturn(List.of(approved));
    when(contentVoteRepository.summarizeByContentIds(argThat(ids -> matchesIds(ids, 3L))))
        .thenReturn(
            List.of(
                countView(3L, ContentVote.VoteType.THUMBS_UP, 2L),
                countView(3L, ContentVote.VoteType.THUMBS_DOWN, 1L)));
    when(userRepository.findAllByEmailLowercaseIn(
            argThat(emails -> matchesStrings(emails, "creator@example.com"))))
        .thenReturn(List.of());

    var responses = contentVoteService.getApprovedContentsWithVotes(null);

    assertThat(responses).hasSize(1);
    assertThat(responses.getFirst().thumbsUp()).isEqualTo(2L);
    assertThat(responses.getFirst().thumbsDown()).isEqualTo(1L);
    assertThat(responses.getFirst().userVote()).isNull();
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
    when(contentVoteRepository.summarizeByContentIds(argThat(ids -> matchesIds(ids, 9L))))
        .thenReturn(
            List.of(
                countView(9L, ContentVote.VoteType.THUMBS_UP, 4L),
                countView(9L, ContentVote.VoteType.THUMBS_DOWN, 1L)));
    when(contentVoteRepository.findAllByContentIdInAndUserId(
            argThat(ids -> matchesIds(ids, 9L)), org.mockito.ArgumentMatchers.eq(userId)))
        .thenReturn(List.of());
    when(userRepository.findAllByEmailLowercaseIn(
            argThat(emails -> matchesStrings(emails, "creator@example.com"))))
        .thenReturn(List.of(creator));

    var responses =
        contentVoteService.getApprovedContentsWithVotesForSubmitter(userId, "creator@example.com");

    assertThat(responses).hasSize(1);
    assertThat(responses.getFirst().content().getSubmittedBy()).isEqualTo("creator@example.com");
    assertThat(responses.getFirst().thumbsUp()).isEqualTo(4L);
    assertThat(responses.getFirst().submittedByDisplayName()).isEqualTo("Kai");
  }

  private static boolean matchesIds(Collection<Long> actualIds, Long... expectedIds) {
    return actualIds.containsAll(List.of(expectedIds)) && actualIds.size() == expectedIds.length;
  }

  private static boolean matchesStrings(Collection<String> actualValues, String... expectedValues) {
    return actualValues.containsAll(List.of(expectedValues))
        && actualValues.size() == expectedValues.length;
  }

  private static ContentVoteRepository.ContentVoteCountView countView(
      Long contentId, ContentVote.VoteType voteType, long voteCount) {
    return new ContentVoteRepository.ContentVoteCountView() {
      @Override
      public Long getContentId() {
        return contentId;
      }

      @Override
      public ContentVote.VoteType getVoteType() {
        return voteType;
      }

      @Override
      public long getVoteCount() {
        return voteCount;
      }
    };
  }
}
