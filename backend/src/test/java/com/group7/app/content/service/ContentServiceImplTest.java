package com.group7.app.content.service;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.group7.app.content.model.Content;
import com.group7.app.content.repository.ContentRepository;
import com.group7.app.content.repository.ContentVoteRepository;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

@ExtendWith(MockitoExtension.class)
class ContentServiceImplTest {

  @Mock private ContentRepository contentRepository;

  @Mock private ContentVoteRepository contentVoteRepository;

  private ContentServiceImpl contentService;

  @BeforeEach
  void setUp() {
    contentService = new ContentServiceImpl(contentRepository, contentVoteRepository);
  }

  @Test
  void deleteContentRemovesVotesBeforeDeletingContent() {
    Content content = new Content("rizz", "charisma", "example", "creator@example.com");
    org.springframework.test.util.ReflectionTestUtils.setField(content, "id", 42L);
    when(contentRepository.findById(42L)).thenReturn(Optional.of(content));

    contentService.deleteContent(42L);

    verify(contentVoteRepository).deleteAllByContentId(42L);
    verify(contentRepository).delete(content);
  }

  @Test
  void deleteContentRejectsMissingContent() {
    when(contentRepository.findById(42L)).thenReturn(Optional.empty());

    assertThatThrownBy(() -> contentService.deleteContent(42L))
        .isInstanceOf(ResponseStatusException.class)
        .hasMessageContaining("Content not found");

    verifyNoInteractions(contentVoteRepository);
  }
}
