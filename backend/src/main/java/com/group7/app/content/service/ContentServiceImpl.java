package com.group7.app.content.service;

import com.group7.app.content.model.Content;
import com.group7.app.content.repository.ContentRepository;
import com.group7.app.content.repository.ContentVoteRepository;
import java.util.List;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ContentServiceImpl implements ContentService {

  private final ContentRepository contentRepository;
  private final ContentVoteRepository contentVoteRepository;

  public ContentServiceImpl(
      ContentRepository contentRepository, ContentVoteRepository contentVoteRepository) {
    this.contentRepository = contentRepository;
    this.contentVoteRepository = contentVoteRepository;
  }

  @Override
  public Content submitContent(Content content) {
    // Respect any status already set (e.g. controller auto-approves for admins).
    if (content.getStatus() != Content.Status.APPROVED) {
      content.setStatus(Content.Status.PENDING);
    }
    return contentRepository.save(content);
  }

  @Override
  public Content approveContent(Long id, String reviewer, String reviewComment) {
    Content content =
        contentRepository
            .findById(id)
            .orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Content not found"));

    content.setStatus(Content.Status.APPROVED);
    content.setReviewedBy(reviewer);
    content.setReviewComment(reviewComment);

    return contentRepository.save(content);
  }

  @Override
  public Content rejectContent(Long id, String reviewer, String reviewComment) {
    Content content =
        contentRepository
            .findById(id)
            .orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Content not found"));

    content.setStatus(Content.Status.REJECTED);
    content.setReviewedBy(reviewer);
    content.setReviewComment(reviewComment);

    return contentRepository.save(content);
  }

  @Override
  public List<Content> getApprovedContents() {
    return contentRepository.findByStatus(Content.Status.APPROVED);
  }

  @Override
  public List<Content> getPendingContents() {
    return contentRepository.findByStatus(Content.Status.PENDING);
  }

  @Override
  public org.springframework.data.domain.Page<Content> getPendingContents(
      org.springframework.data.domain.Pageable pageable) {
    return contentRepository.findByStatus(Content.Status.PENDING, pageable);
  }

  @Override
  @Transactional
  public void deleteContent(Long id) {
    Content content =
        contentRepository
            .findById(id)
            .orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Content not found"));
    contentVoteRepository.deleteAllByContentId(id);
    contentRepository.delete(content);
  }
}
