package com.group7.app.config;

import java.util.List;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.convert.converter.Converter;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.core.convert.converter.Converter;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import com.group7.app.user.UserService;
import com.group7.app.user.User;
import java.util.*;

@Configuration
public class SecurityConfig {

    private final UserService userService;

    public SecurityConfig(UserService userService) {
        this.userService = userService;
    }

  @Bean
  public SecurityFilterChain filterChain(
      HttpSecurity http,
      Converter<Jwt, ? extends AbstractAuthenticationToken> databaseRoleJwtAuthenticationConverter)
      throws Exception {

    http
        // Enable CORS using our CorsConfigurationSource bean
        .cors(Customizer.withDefaults())

        // Disable CSRF for stateless APIs
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
                    .hasAnyRole("CONTRIBUTOR", "ADMIN")

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

  @Bean
  public CorsConfigurationSource corsConfigurationSource() {

    CorsConfiguration config = new CorsConfiguration();

    // Frontend origin
    config.setAllowedOrigins(List.of("http://localhost:5173"));

    config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));

    // Allow all headers (includes Authorization)
    config.setAllowedHeaders(List.of("*"));

    // Allow Authorization header & cookies
    config.setAllowCredentials(true);

    // (Optional but recommended for JWT)
    config.setExposedHeaders(List.of("Authorization"));

    UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();

    // Apply CORS to all endpoints
    source.registerCorsConfiguration("/**", config);

    return source;
  }
}
