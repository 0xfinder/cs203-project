package com.group7.app.content.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import com.group7.app.content.model.Content;
import com.group7.app.content.service.ContentService;

import jakarta.validation.Valid;
import java.util.List;

@RestController
@RequestMapping("/api/contents")
@Tag(name = "Content", description = "Content submission and moderation endpoints")
public class ContentController {

    private final ContentService contentService;

    public ContentController(ContentService contentService) {
        this.contentService = contentService;
    }

    // Contributor submits a new term
    @PostMapping
    @Operation(summary = "Create new content")
    public Content submitContent(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody Content content) {
        String email = getEmail(jwt);
        content.setSubmittedBy(email);
        return contentService.submitContent(content);
    }

    // Admin reviews a term with reviewer username and optional comment
    @PutMapping("/{id}/review")
    @Operation(summary = "Review pending content")
    public Content reviewContent(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long id,
            @RequestParam String decision,
            @RequestParam(required = false) String reviewComment) {
        String reviewer = getEmail(jwt);
        if (decision == null || decision.isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "decision is required");
        }

        String normalizedDecision = decision.trim().toUpperCase();
        if ("APPROVE".equals(normalizedDecision) || "APPROVED".equals(normalizedDecision)) {
            return contentService.approveContent(id, reviewer, reviewComment);
        }

        if ("REJECT".equals(normalizedDecision) || "REJECTED".equals(normalizedDecision)) {
            if (reviewComment == null || reviewComment.isBlank()) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "reviewComment is required when rejecting content");
            }
            return contentService.rejectContent(id, reviewer, reviewComment);
        }

        throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "decision must be APPROVE/APPROVED or REJECT/REJECTED");
    }

    private static String getEmail(Jwt jwt) {
        String email = jwt.getClaimAsString("email");
        if (email == null || email.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "missing email claim");
        }
        return email;
    }

    // Get all approved terms (for normal users)
    @GetMapping("/approved")
    @Operation(summary = "Get approved content")
    public List<Content> getApprovedContents() {
        return contentService.getApprovedContents();
    }

    // Get all pending terms (for admin review)
    @GetMapping("/pending")
    @Operation(summary = "Get pending content")
    public List<Content> getPendingContents() {
        return contentService.getPendingContents();
    }

    // Get pending terms with pagination
    @GetMapping("/pending/paginated")
    @Operation(summary = "Get pending content (paginated)")
    public org.springframework.data.domain.Page<Content> getPendingContentsPaginated(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return contentService.getPendingContents(
                org.springframework.data.domain.PageRequest.of(page, size,
                        org.springframework.data.domain.Sort.by("createdAt").ascending()));
    }
}
