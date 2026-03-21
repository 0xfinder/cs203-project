package com.group7.app.user;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.group7.app.config.DatabaseRoleJwtAuthenticationConverter;
import com.group7.app.config.SecurityConfig;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(UserController.class)
@Import(SecurityConfig.class)
@ActiveProfiles("test")
class UserControllerWebMvcTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private UserService userService;

    @MockitoBean
    private JwtDecoder jwtDecoder;

    @MockitoBean
    private DatabaseRoleJwtAuthenticationConverter databaseRoleJwtAuthenticationConverter;

    @Test
    void getMeBootstrapsUserFromJwtWhenMissing() throws Exception {
        UUID userId = UUID.randomUUID();
        User created = new User(userId, "new@example.com");
        created.setDisplayName("Kai");
        created.setRole(Role.LEARNER);

        when(userService.findById(userId)).thenReturn(Optional.empty());
        when(userService.createFromAuth(userId, "new@example.com")).thenReturn(created);
        when(userService.isOnboardingCompleted(created)).thenReturn(true);

        mockMvc.perform(get("/api/users/me")
                        .with(jwt().jwt(token -> token.subject(userId.toString()).claim("email", "new@example.com"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(userId.toString()))
                .andExpect(jsonPath("$.email").value("new@example.com"))
                .andExpect(jsonPath("$.onboardingCompleted").value(true));
    }

    @Test
    void patchMeUpdatesProfileAndMapsContributorIntent() throws Exception {
        UUID userId = UUID.randomUUID();
        User existing = new User(userId, "user@example.com");
        existing.setRole(Role.LEARNER);

        User updated = new User(userId, "user@example.com");
        updated.setDisplayName("AlphaKid");
        updated.setRole(Role.CONTRIBUTOR);
        updated.setBio("bio");
        updated.setAge(15);
        updated.setGender("non-binary");
        updated.setAvatarColor("#112233");
        updated.setAvatarPath("uploads/" + userId + "/avatar.png");

        when(userService.findById(userId)).thenReturn(Optional.of(existing));
        when(userService.updateProfile(
                eq(userId),
                eq("AlphaKid"),
                eq(Role.CONTRIBUTOR),
                eq("bio"),
                eq(15),
                eq("non-binary"),
                eq("#112233"),
                eq("uploads/" + userId + "/avatar.png")))
                .thenReturn(updated);
        when(userService.isOnboardingCompleted(updated)).thenReturn(true);

        mockMvc.perform(patch("/api/users/me")
                        .with(jwt().jwt(token -> token.subject(userId.toString()).claim("email", "user@example.com")))
                        .contentType("application/json")
                        .content("""
                                {
                                  "displayName": " AlphaKid ",
                                  "roleIntent": "CONTRIBUTOR",
                                  "bio": " bio ",
                                  "age": 15,
                                  "gender": " non-binary ",
                                  "avatarColor": "#112233",
                                  "avatarPath": "uploads/%s/avatar.png"
                                }
                                """.formatted(userId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.displayName").value("AlphaKid"))
                .andExpect(jsonPath("$.role").value("CONTRIBUTOR"))
                .andExpect(jsonPath("$.avatarPath").value("uploads/" + userId + "/avatar.png"));
    }

    @Test
    void patchMeRejectsAvatarPathOutsideAuthenticatedUsersFolder() throws Exception {
        UUID userId = UUID.randomUUID();
        User existing = new User(userId, "user@example.com");
        existing.setRole(Role.LEARNER);
        when(userService.findById(userId)).thenReturn(Optional.of(existing));

        mockMvc.perform(patch("/api/users/me")
                        .with(jwt().jwt(token -> token.subject(userId.toString()).claim("email", "user@example.com")))
                        .contentType("application/json")
                        .content("""
                                {
                                  "displayName": "AlphaKid",
                                  "avatarPath": "uploads/another-user/avatar.png"
                                }
                                """))
                .andExpect(status().isBadRequest());

        verify(userService).findById(userId);
        verify(userService, never()).updateProfile(
                any(UUID.class),
                any(String.class),
                any(Role.class),
                any(String.class),
                any(Integer.class),
                any(String.class),
                any(String.class),
                any(String.class));
    }

    @Test
    void getMeRequiresAuthentication() throws Exception {
        mockMvc.perform(get("/api/users/me"))
                .andExpect(status().isUnauthorized());

        verifyNoInteractions(userService);
    }
}
