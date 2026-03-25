package com.group7.app.config;

import java.util.List;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
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
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {

        http
            // Enable CORS using our CorsConfigurationSource bean
            .cors(Customizer.withDefaults())

            // Disable CSRF for stateless APIs
            .csrf(csrf -> csrf.disable())

            // Configure endpoint security
            .authorizeHttpRequests(auth -> auth
                // Allow preflight requests
                .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()

                // Allow Swagger / root
                .requestMatchers(
                        "/",
                        "/swagger-ui.html",
                        "/swagger-ui/**",
                        "/v3/api-docs/**"
                ).permitAll()

                .requestMatchers(HttpMethod.GET, "/api/forum/**").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/forum/**").authenticated()
                .requestMatchers(HttpMethod.DELETE, "/api/forum/**").authenticated()                

                // Allow anyone to view approved content
                .requestMatchers(HttpMethod.GET, "/api/contents/approved/**").permitAll()

                // Allow any authenticated user to submit new content (will be PENDING for review)
                .requestMatchers(HttpMethod.POST, "/api/contents").authenticated()

                // Only Moderators and Admins can review pending content
                .requestMatchers("/api/contents/*/review").hasAnyRole("MODERATOR", "ADMIN")
                .requestMatchers("/api/contents/pending/**").hasAnyRole("MODERATOR", "ADMIN")

                // Temporary debug endpoints (permit local dev use)
                .requestMatchers("/api/debug/**").permitAll()

                // Restrict Admin-only endpoints
                .requestMatchers("/api/admin/**").hasRole("ADMIN")
                // Everything else requires authentication
                .anyRequest().authenticated()
            )

            // Enable JWT authentication (Supabase) and map DB role -> GrantedAuthority
            .oauth2ResourceServer(oauth2 -> oauth2.jwt(jwt -> {
                JwtAuthenticationConverter authConverter = new JwtAuthenticationConverter();

                Converter<Jwt, Collection<GrantedAuthority>> grantedAuthoritiesConverter = token -> {
                    List<GrantedAuthority> auths = new ArrayList<>();
                    try {
                        String subject = token.getSubject();
                        if (subject != null && !subject.isBlank()) {
                            UUID userId = UUID.fromString(subject);
                            Optional<User> u = userService.findById(userId);
                            if (u.isPresent() && u.get().getRole() != null) {
                                auths.add(new SimpleGrantedAuthority("ROLE_" + u.get().getRole().name()));
                            }
                        }
                    } catch (Exception ex) {
                        // ignore and fallback to no DB roles
                    }
                    return auths;
                };

                authConverter.setJwtGrantedAuthoritiesConverter(grantedAuthoritiesConverter);
                jwt.jwtAuthenticationConverter(authConverter);
            }));

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {

        CorsConfiguration config = new CorsConfiguration();

        // Frontend origin
        config.setAllowedOrigins(List.of("http://localhost:5173"));

        config.setAllowedMethods(List.of(
                "GET",
                "POST",
                "PUT",
                "DELETE",
                "PATCH",
                "OPTIONS"
        ));

        // Allow all headers (includes Authorization)
        config.setAllowedHeaders(List.of("*"));

        // Allow Authorization header & cookies
        config.setAllowCredentials(true);

        // (Optional but recommended for JWT)
        config.setExposedHeaders(List.of("Authorization"));

        UrlBasedCorsConfigurationSource source =
                new UrlBasedCorsConfigurationSource();

        // Apply CORS to all endpoints
        source.registerCorsConfiguration("/**", config);

        return source;
    }
}