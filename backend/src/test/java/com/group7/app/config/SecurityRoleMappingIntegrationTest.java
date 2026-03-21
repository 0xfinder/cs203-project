package com.group7.app.config;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.group7.app.content.model.Content;
import com.group7.app.content.service.ContentService;
import com.group7.app.user.Role;
import com.group7.app.user.User;
import com.group7.app.user.UserRepository;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class SecurityRoleMappingIntegrationTest {

    private static final UUID CONTRIBUTOR_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final UUID MODERATOR_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @MockitoBean
    private ContentService contentService;

    @MockitoBean
    private JwtDecoder jwtDecoder;

    @BeforeEach
    void setUp() {
        userRepository.deleteAll();

        User contributor = new User(CONTRIBUTOR_ID, "contributor@example.com");
        contributor.setRole(Role.CONTRIBUTOR);
        userRepository.save(contributor);

        User moderator = new User(MODERATOR_ID, "moderator@example.com");
        moderator.setRole(Role.MODERATOR);
        userRepository.save(moderator);

        when(contentService.submitContent(any(Content.class)))
                .thenAnswer(invocation -> invocation.getArgument(0, Content.class));
        when(contentService.getPendingContents()).thenReturn(List.of());
    }

    @Test
    void contributorWithGrantedAuthorityCanSubmitContent() throws Exception {
        mockMvc.perform(post("/api/contents")
                        .with(jwt().jwt(token -> token
                                .subject(CONTRIBUTOR_ID.toString())
                                .claim("email", "contributor@example.com"))
                                .authorities(new SimpleGrantedAuthority("ROLE_CONTRIBUTOR")))
                        .contentType("application/json")
                        .content("""
                                {
                          "term": "rizz",
                          "definition": "charisma",
                          "submittedBy": "contributor@example.com"
                        }
                        """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.submittedBy").value("contributor@example.com"));

        ArgumentCaptor<Content> contentCaptor = ArgumentCaptor.forClass(Content.class);
        verify(contentService).submitContent(contentCaptor.capture());
        org.assertj.core.api.Assertions.assertThat(contentCaptor.getValue().getTerm()).isEqualTo("rizz");
        org.assertj.core.api.Assertions.assertThat(contentCaptor.getValue().getDefinition()).isEqualTo("charisma");
        org.assertj.core.api.Assertions.assertThat(contentCaptor.getValue().getSubmittedBy())
                .isEqualTo("contributor@example.com");
    }

    @Test
    void contributorWithDatabaseRoleCanSubmitContent() throws Exception {
        when(jwtDecoder.decode("contributor-token")).thenReturn(jwtFor(CONTRIBUTOR_ID, "contributor@example.com"));

        mockMvc.perform(post("/api/contents")
                        .header("Authorization", "Bearer contributor-token")
                        .contentType("application/json")
                        .content("""
                                {
                          "term": "rizz",
                          "definition": "charisma",
                                  "submittedBy": "contributor@example.com"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.submittedBy").value("contributor@example.com"));

        ArgumentCaptor<Content> contentCaptor = ArgumentCaptor.forClass(Content.class);
        verify(contentService).submitContent(contentCaptor.capture());
        org.assertj.core.api.Assertions.assertThat(contentCaptor.getValue().getSubmittedBy())
                .isEqualTo("contributor@example.com");
    }

    @Test
    void moderatorWithDatabaseRoleCanAccessPendingContent() throws Exception {
        when(jwtDecoder.decode("moderator-token")).thenReturn(jwtFor(MODERATOR_ID, "moderator@example.com"));

        mockMvc.perform(get("/api/contents/pending")
                        .header("Authorization", "Bearer moderator-token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());

        verify(contentService).getPendingContents();
    }

    private static Jwt jwtFor(UUID userId, String email) {
        return Jwt.withTokenValue("token-" + userId)
                .header("alg", "none")
                .subject(userId.toString())
                .claim("email", email)
                .build();
    }
}
