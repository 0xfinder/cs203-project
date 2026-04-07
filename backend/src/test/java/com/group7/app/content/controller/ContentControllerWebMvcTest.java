package com.group7.app.content.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.group7.app.config.DatabaseRoleJwtAuthenticationConverter;
import com.group7.app.config.SecurityConfig;
import com.group7.app.content.model.Content;
import com.group7.app.content.service.ContentService;
import com.group7.app.support.TestJwtFactory;
import com.group7.app.user.UserService;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(ContentController.class)
@Import(SecurityConfig.class)
@ActiveProfiles("test")
class ContentControllerWebMvcTest {

  @Autowired private MockMvc mockMvc;

  @MockitoBean private ContentService contentService;

  @MockitoBean private UserService userService;

  @MockitoBean private JwtDecoder jwtDecoder;

  @MockitoBean
  private DatabaseRoleJwtAuthenticationConverter databaseRoleJwtAuthenticationConverter;

  @Test
  void contributorCanSubmitContent() throws Exception {
    when(contentService.submitContent(any(Content.class)))
        .thenAnswer(
            invocation -> {
              Content content = invocation.getArgument(0);
              org.springframework.test.util.ReflectionTestUtils.setField(content, "id", 5L);
              return content;
            });

    mockMvc
        .perform(
            post("/api/contents")
                .with(
                    TestJwtFactory.jwt(UUID.randomUUID(), "contributor@example.com", "CONTRIBUTOR"))
                .contentType("application/json")
                .content(
                    """
                        {
                          "term": "rizz",
                          "definition": "charisma",
                          "example": "he has rizz",
                          "submittedBy": "ignored@example.com"
                        }
                        """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.submittedBy").value("contributor@example.com"))
        .andExpect(jsonPath("$.term").value("rizz"));
  }

  @Test
  void submitContentRejectsMissingEmailClaim() throws Exception {
    mockMvc
        .perform(
            post("/api/contents")
                .with(
                    org.springframework.security.test.web.servlet.request
                        .SecurityMockMvcRequestPostProcessors.jwt()
                        .jwt(token -> token.subject(UUID.randomUUID().toString()))
                        .authorities(
                            new org.springframework.security.core.authority.SimpleGrantedAuthority(
                                "ROLE_CONTRIBUTOR")))
                .contentType("application/json")
                .content(
                    """
                        {
                          "term": "rizz",
                          "definition": "charisma",
                          "submittedBy": "ignored@example.com"
                        }
                        """))
        .andExpect(status().isBadRequest());

    verifyNoInteractions(contentService);
  }

  @Test
  void reviewRejectDecisionRequiresComment() throws Exception {
    mockMvc
        .perform(
            put("/api/contents/5/review")
                .with(TestJwtFactory.jwt(UUID.randomUUID(), "moderator@example.com", "MODERATOR"))
                .param("decision", "REJECT"))
        .andExpect(status().isBadRequest());

    verifyNoInteractions(contentService);
  }

  @Test
  void moderatorCanApproveContent() throws Exception {
    Content approved = new Content("rizz", "charisma", "example", "contributor@example.com");
    approved.setStatus(Content.Status.APPROVED);
    approved.setReviewedBy("moderator@example.com");
    when(contentService.approveContent(5L, "moderator@example.com", null)).thenReturn(approved);

    mockMvc
        .perform(
            put("/api/contents/5/review")
                .with(TestJwtFactory.jwt(UUID.randomUUID(), "moderator@example.com", "MODERATOR"))
                .param("decision", "APPROVE"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("APPROVED"))
        .andExpect(jsonPath("$.reviewedBy").value("moderator@example.com"));
  }

  @Test
  void approvedContentEndpointIsPublic() throws Exception {
    Content approved = new Content("rizz", "charisma", "example", "contributor@example.com");
    approved.setStatus(Content.Status.APPROVED);
    when(contentService.getApprovedContents()).thenReturn(List.of(approved));

    mockMvc
        .perform(get("/api/contents/approved"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].term").value("rizz"));
  }

  @Test
  void pendingContentRequiresModeratorOrAdminRole() throws Exception {
    when(contentService.getPendingContents()).thenReturn(List.of());

    mockMvc
        .perform(
            get("/api/contents/pending")
                .with(TestJwtFactory.jwt(UUID.randomUUID(), "learner@example.com", "LEARNER")))
        .andExpect(status().isForbidden());

    verifyNoInteractions(contentService);
  }

  @Test
  void moderatorCanFetchPendingContent() throws Exception {
    when(contentService.getPendingContents()).thenReturn(List.of());

    mockMvc
        .perform(
            get("/api/contents/pending")
                .with(TestJwtFactory.jwt(UUID.randomUUID(), "moderator@example.com", "MODERATOR")))
        .andExpect(status().isOk());
  }

  @Test
  void moderatorCanFetchPaginatedPendingContent() throws Exception {
    when(contentService.getPendingContents(any(org.springframework.data.domain.Pageable.class)))
        .thenReturn(new org.springframework.data.domain.PageImpl<>(List.of()));

    mockMvc
        .perform(
            get("/api/contents/pending/paginated")
                .with(TestJwtFactory.jwt(UUID.randomUUID(), "moderator@example.com", "MODERATOR"))
                .param("page", "0")
                .param("size", "5"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content").isArray());
  }
}
