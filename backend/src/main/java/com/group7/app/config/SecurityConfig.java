package com.group7.app.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.convert.converter.Converter;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
public class SecurityConfig {

  @Bean
  public SecurityFilterChain filterChain(
      HttpSecurity http,
      Converter<Jwt, ? extends AbstractAuthenticationToken> databaseRoleJwtAuthenticationConverter)
      throws Exception {

    http.sessionManagement(
            session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
        .csrf(csrf -> csrf.disable())

        // Configure endpoint security
        .authorizeHttpRequests(
            auth ->
                auth
                    // Allow preflight requests
                    .requestMatchers(HttpMethod.OPTIONS, "/**")
                    .permitAll()

                    // Allow Swagger / root
                    .requestMatchers("/", "/swagger-ui.html", "/swagger-ui/**", "/v3/api-docs/**")
                    .permitAll()
                    .requestMatchers(HttpMethod.GET, "/api/forum/**")
                    .permitAll()
                    .requestMatchers(HttpMethod.POST, "/api/forum/**")
                    .authenticated()
                    .requestMatchers(HttpMethod.DELETE, "/api/forum/**")
                    .authenticated()

                    // Allow anyone to view approved content
                    .requestMatchers(HttpMethod.GET, "/api/contents/approved/**")
                    .permitAll()

                    // Only Contributors and Admins can submit new content
                    .requestMatchers(HttpMethod.POST, "/api/contents")
                    .hasAnyRole("CONTRIBUTOR", "ADMIN", "MODERATOR")

                    // Only Moderators and Admins can review pending content
                    .requestMatchers("/api/contents/*/review")
                    .hasAnyRole("MODERATOR", "ADMIN")
                    .requestMatchers("/api/contents/pending/**")
                    .hasAnyRole("MODERATOR", "ADMIN")

                    // Restrict Admin-only endpoints
                    .requestMatchers("/api/admin/**")
                    .hasRole("ADMIN")
                    // Everything else requires authentication
                    .anyRequest()
                    .authenticated())

        // Enable JWT authentication (Supabase)
        .oauth2ResourceServer(
            oauth2 ->
                oauth2.jwt(
                    jwt -> jwt.jwtAuthenticationConverter(databaseRoleJwtAuthenticationConverter)));

    return http.build();
  }
}
