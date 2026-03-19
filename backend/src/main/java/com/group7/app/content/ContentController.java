package com.group7.app.content;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import jakarta.validation.Valid; // 
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
    @Operation(summary = "Create new content", description = "Submit a new content item. Contributors can use this endpoint to submit new terms or to appeal existing content; submitted items are created with status=PENDING for moderator review.")
    // Added @Valid so Spring actually checks your @NotBlank and @Size constraints
    public Content submitContent(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody Content content) {
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

        // Moderator/admin reviews a pending content item (approve or reject an appeal)
        @PutMapping("/{id}/review")
        @Operation(summary = "Review pending content", description = "Approve or reject a pending content item (used by moderators to resolve appeals). 'decision' must be APPROVE or REJECT. When rejecting, a reviewComment is required.")
        public Content reviewContent(
            @PathVariable Long id,
            @AuthenticationPrincipal org.springframework.security.oauth2.jwt.Jwt jwt,
            @RequestParam(required = false) String reviewer,
            @RequestParam String decision,
            @RequestParam(required = false) String reviewComment) {
        if (decision == null || decision.isBlank()) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.BAD_REQUEST,
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
            if (resolvedReviewer == null || resolvedReviewer.isBlank()) {
                throw new org.springframework.web.server.ResponseStatusException(
                        org.springframework.http.HttpStatus.BAD_REQUEST,
                        "reviewer is required");
            }
            return contentService.rejectContent(id, resolvedReviewer, reviewComment);
        }

        throw new org.springframework.web.server.ResponseStatusException(
                org.springframework.http.HttpStatus.BAD_REQUEST,
                "decision must be APPROVE/APPROVED or REJECT/REJECTED");
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
