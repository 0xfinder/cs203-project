package com.group7.app.content.service;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import com.group7.app.content.model.Content;

import java.util.List;

public interface ContentService {

    Content submitContent(Content content);

    Content approveContent(Long id, String reviewer, String reviewComment);

    Content rejectContent(Long id, String reviewer, String reviewComment);

    List<Content> getApprovedContents();

    List<Content> getPendingContents();

    Page<Content> getPendingContents(Pageable pageable);
}
