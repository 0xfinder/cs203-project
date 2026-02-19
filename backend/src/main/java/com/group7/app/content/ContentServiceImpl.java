package com.group7.app.content;

import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import java.util.List;

@Service
public class ContentServiceImpl implements ContentService {

    private final ContentRepository contentRepository;

    public ContentServiceImpl(ContentRepository contentRepository) {
        this.contentRepository = contentRepository;
    }

    @Override
    public Content submitContent(Content content) {
        content.setStatus(Content.Status.PENDING);
        return contentRepository.save(content);
    }

    @Override
    public Content approveContent(Long id, String reviewer, String reviewComment) {
        Content content = contentRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Content not found"));

        content.setStatus(Content.Status.APPROVED);
        content.setReviewedBy(reviewer);
        content.setReviewComment(reviewComment);

        return contentRepository.save(content);
    }

    @Override
    public Content rejectContent(Long id, String reviewer, String reviewComment) {
        Content content = contentRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Content not found"));

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
}