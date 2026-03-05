package com.group7.app.content;

import com.group7.app.user.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/contents")
@Tag(name = "Content Votes", description = "Content voting endpoints")
public class ContentVoteController {

    private final ContentVoteService contentVoteService;
    private final UserService userService;

    public ContentVoteController(ContentVoteService contentVoteService, UserService userService) {
        this.contentVoteService = contentVoteService;
        this.userService = userService;
    }

    @PostMapping("/{contentId}/votes")
    @Operation(summary = "Cast or update a vote on content")
    public ContentVoteSummaryResponse castVote(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long contentId,
            @Valid @RequestBody ContentVoteRequest request) {
        UUID userId = parseUserId(jwt);
        userService.findById(userId)
                .orElseGet(() -> userService.createFromAuth(userId, getEmail(jwt)));
        return contentVoteService.castVote(contentId, userId, request.voteType());
    }

    @DeleteMapping("/{contentId}/votes")
    @Operation(summary = "Remove current user's vote")
    public ContentVoteSummaryResponse clearVote(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long contentId) {
        UUID userId = parseUserId(jwt);
        userService.findById(userId)
                .orElseGet(() -> userService.createFromAuth(userId, getEmail(jwt)));
        return contentVoteService.clearVote(contentId, userId);
    }

    @GetMapping("/{contentId}/votes")
    @Operation(summary = "Get vote totals for a content item")
    public ContentVoteSummaryResponse getSummary(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long contentId) {
        UUID userId = parseUserId(jwt);
        userService.findById(userId)
                .orElseGet(() -> userService.createFromAuth(userId, getEmail(jwt)));
        return contentVoteService.getSummary(contentId, userId);
    }

    @GetMapping("/approved-with-votes")
    @Operation(summary = "Get approved content with vote totals")
    public List<ContentWithVotesResponse> getApprovedWithVotes(
            @AuthenticationPrincipal Jwt jwt) {
        UUID userId = parseUserId(jwt);
        userService.findById(userId)
                .orElseGet(() -> userService.createFromAuth(userId, getEmail(jwt)));
        return contentVoteService.getApprovedContentsWithVotes(userId);
    }

    private static UUID parseUserId(Jwt jwt) {
        String subject = jwt.getSubject();
        if (subject == null || subject.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "missing token subject");
        }
        try {
            return UUID.fromString(subject);
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "invalid token subject");
        }
    }

    private static String getEmail(Jwt jwt) {
        String email = jwt.getClaimAsString("email");
        if (email == null || email.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "missing email claim");
        }
        return email;
    }
}
