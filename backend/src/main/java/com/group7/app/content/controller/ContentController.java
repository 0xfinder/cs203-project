package com.group7.app.content.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import com.group7.app.content.model.Content;
import com.group7.app.content.service.ContentService;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import jakarta.validation.Valid;
import java.util.List;
import com.group7.app.user.UserService;
import com.group7.app.user.User;
import com.group7.app.user.Role;

@RestController
@RequestMapping("/api/contents")
@Tag(name = "Content", description = "Content submission and moderation endpoints")
public class ContentController {

    private final ContentService contentService;
    private final UserService userService;

    public ContentController(ContentService contentService, UserService userService) {
        this.contentService = contentService;
        this.userService = userService;
    }

    // Contributor submits a new term (also used as an appeal submission)
    @PostMapping
    @PreAuthorize("hasAnyRole('CONTRIBUTOR', 'MODERATOR', 'ADMIN')")
    @Operation(summary = "Create new content", description = "Submit a new content item. Contributors can use this endpoint to submit new terms or to appeal existing content; submitted items are created with status=PENDING for moderator review.")
    public Content submitContent(
            @AuthenticationPrincipal Jwt jwt,
            @AuthenticationPrincipal Jwt jwt, @Valid @RequestBody Content content) {
        String email = getEmail(jwt);
        content.setSubmittedBy(email);
        // If the authenticated user is an admin/moderator, auto-approve the submission
        try {
            String email = jwt.getClaimAsString("email");
            if (email != null) {
                User user = userService.findByEmail(email).orElse(null);
                if (user != null) {
                    Role role = user.getRole();
                    if (role == Role.ADMIN || role == Role.MODERATOR) {
                        content.setStatus(Content.Status.APPROVED);
                        String reviewer = user.getDisplayName() != null && !user.getDisplayName().isBlank()
                                ? user.getDisplayName()
                                : user.getEmail();
                        content.setReviewedBy(reviewer);
                    }
                } else {
                    // If user record not found, allow a test admin override for Shu (email or name)
                    String nameClaim = jwt.getClaimAsString("name");
                    if ("shubhangiskps@gmail.com".equalsIgnoreCase(email) || "Shu".equals(nameClaim)) {
                        content.setStatus(Content.Status.APPROVED);
                        content.setReviewedBy(nameClaim != null && !nameClaim.isBlank() ? nameClaim : email);
                    }
                }
            }
        } catch (Exception ex) {
            // if anything goes wrong reading auth info, fall back to normal pending flow
        }

        return contentService.submitContent(content);
    }

    // Admin reviews a term with reviewer username and optional comment
    @PutMapping("/{id}/review")
    @PreAuthorize("hasAnyRole('MODERATOR', 'ADMIN')")
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
        // If reviewer not supplied, try to derive from the authenticated JWT (email or subject)
        String resolvedReviewer = reviewer;
        if ((resolvedReviewer == null || resolvedReviewer.isBlank()) && jwt != null) {
            try {
                resolvedReviewer = jwt.getClaimAsString("email");
                if (resolvedReviewer == null || resolvedReviewer.isBlank()) {
                    resolvedReviewer = jwt.getSubject();
                }
            } catch (Exception ex) {
                // ignore and fall back to provided reviewer or null
            }
        }

        if ("APPROVE".equals(normalizedDecision) || "APPROVED".equals(normalizedDecision)) {
            if (resolvedReviewer == null || resolvedReviewer.isBlank()) {
                throw new org.springframework.web.server.ResponseStatusException(
                        org.springframework.http.HttpStatus.BAD_REQUEST,
                        "reviewer is required");
            }
            return contentService.approveContent(id, resolvedReviewer, reviewComment);
        }

        if ("REJECT".equals(normalizedDecision) || "REJECTED".equals(normalizedDecision)) {
            if (reviewComment == null || reviewComment.isBlank()) {
                throw new org.springframework.web.server.ResponseStatusException(
                        org.springframework.http.HttpStatus.BAD_REQUEST,
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
    @PreAuthorize("hasAnyRole('MODERATOR', 'ADMIN')")
    @Operation(summary = "Get pending content")
    public List<Content> getPendingContents() {
        return contentService.getPendingContents();
    }

    // Get pending terms with pagination
    @GetMapping("/pending/paginated")
    @PreAuthorize("hasAnyRole('MODERATOR', 'ADMIN')")
    @Operation(summary = "Get pending content (paginated)")
    public org.springframework.data.domain.Page<Content> getPendingContentsPaginated(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return contentService.getPendingContents(
                org.springframework.data.domain.PageRequest.of(page, size,
                        org.springframework.data.domain.Sort.by("createdAt").ascending()));
    }
}
