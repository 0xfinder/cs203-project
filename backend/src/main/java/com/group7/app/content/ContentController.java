package com.group7.app.content;

import org.springframework.web.bind.annotation.*;
import jakarta.validation.Valid; // 
import java.util.List;

@RestController
@RequestMapping("/api/contents")
public class ContentController {

    private final ContentService contentService;

    public ContentController(ContentService contentService) {
        this.contentService = contentService;
    }

    // Contributor submits a new term
    @PostMapping("/submit")
    // Added @Valid so Spring actually checks your @NotBlank and @Size constraints
    public Content submitContent(@Valid @RequestBody Content content) {
        return contentService.submitContent(content);
    }

    // Admin approves a term with reviewer username and optional comment
    @PutMapping("/approve/{id}")
    public Content approveContent(@PathVariable Long id,
            @RequestParam String reviewer,
            @RequestParam(required = false) String reviewComment) {
        return contentService.approveContent(id, reviewer, reviewComment);
    }

    // Admin rejects a term with reviewer username and comment
    @PutMapping("/reject/{id}")
    public Content rejectContent(@PathVariable Long id,
            @RequestParam String reviewer,
            @RequestParam String reviewComment) {
        return contentService.rejectContent(id, reviewer, reviewComment);
    }

    // Get all approved terms (for normal users)
    @GetMapping("/approved")
    public List<Content> getApprovedContents() {
        return contentService.getApprovedContents();
    }

    // Get all pending terms (for admin review)
    @GetMapping("/pending")
    public List<Content> getPendingContents() {
        return contentService.getPendingContents();
    }

    // Get pending terms with pagination
    @GetMapping("/pending/paginated")
    public org.springframework.data.domain.Page<Content> getPendingContentsPaginated(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return contentService.getPendingContents(
                org.springframework.data.domain.PageRequest.of(page, size,
                        org.springframework.data.domain.Sort.by("createdAt").ascending()));
    }
}