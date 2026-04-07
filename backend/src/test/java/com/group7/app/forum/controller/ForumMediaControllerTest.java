package com.group7.app.forum.controller;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.Jwt;

class ForumMediaControllerTest {

  @Test
  void resolveSupabaseUrlPrefersExplicitConfiguration() {
    String resolved =
        ForumMediaController.resolveSupabaseUrl(
            "https://demo-project.supabase.co/", "https://ignored/.well-known/jwks.json");

    assertThat(resolved).isEqualTo("https://demo-project.supabase.co");
  }

  @Test
  void resolveSupabaseUrlFallsBackToJwkSetUri() {
    String resolved =
        ForumMediaController.resolveSupabaseUrl(
            null, "https://demo-project.supabase.co/auth/v1/.well-known/jwks.json");

    assertThat(resolved).isEqualTo("https://demo-project.supabase.co");
  }

  @Test
  void resolveBearerTokenPrefersServiceRole() {
    Jwt jwt =
        Jwt.withTokenValue("user-token")
            .header("alg", "none")
            .subject("123e4567-e89b-12d3-a456-426614174000")
            .claim("email", "user@example.com")
            .build();

    String resolved = ForumMediaController.resolveBearerToken("service-role", jwt);

    assertThat(resolved).isEqualTo("service-role");
  }

  @Test
  void resolveBearerTokenFallsBackToJwtToken() {
    Jwt jwt =
        Jwt.withTokenValue("user-token")
            .header("alg", "none")
            .subject("123e4567-e89b-12d3-a456-426614174000")
            .claim("email", "user@example.com")
            .build();

    String resolved = ForumMediaController.resolveBearerToken(null, jwt);

    assertThat(resolved).isEqualTo("user-token");
  }
}
