package com.group7.app.content;

import java.util.List;

public interface ContentService {

    Content submitContent(Content content);

    Content approveContent(Long id, String reviewer, String reviewComment);

    Content rejectContent(Long id, String reviewer, String reviewComment);

    List<Content> getApprovedContents();

    List<Content> getPendingContents();
}
