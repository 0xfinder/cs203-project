package com.group7.app.forum.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/forum/media")
public class ForumMediaController {

  private static final String JWK_SET_SUFFIX = "/auth/v1/.well-known/jwks.json";

  private final RestClient restClient;
  private final ObjectMapper mapper;
  private final String supabaseUrl;
  private final String serviceRole;

  public ForumMediaController(
      ObjectMapper mapper,
      RestClient.Builder restClientBuilder,
      @Value("${SUPABASE_URL:}") String configuredSupabaseUrl,
      @Value("${SUPABASE_JWK_SET_URI:}") String jwkSetUri,
      @Value("${SUPABASE_SERVICE_ROLE:}") String serviceRole) {
    this.mapper = mapper;
    this.restClient = restClientBuilder.build();
    this.supabaseUrl = resolveSupabaseUrl(configuredSupabaseUrl, jwkSetUri);
    this.serviceRole = trimToNull(serviceRole);
  }

  @PostMapping("/signed-url")
  public ResponseEntity<?> signedUrl(
      @AuthenticationPrincipal Jwt jwt, @RequestBody Map<String, Object> body)
      throws IOException, InterruptedException {
    String bucket = (String) body.getOrDefault("bucket", "forum-media");
    String path = (String) body.get("path");
    Integer expires = (Integer) body.getOrDefault("expires", 60 * 60 * 24);
    if (path == null || path.isBlank()) {
      return ResponseEntity.badRequest().body(Map.of("error", "missing path"));
    }
    if (supabaseUrl == null) {
      return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
          .body(Map.of("error", "forum media signing is not configured"));
    }

    String bearerToken = resolveBearerToken(serviceRole, jwt);
    if (bearerToken == null) {
      return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
          .body(Map.of("error", "forum media signing is unavailable"));
    }

    String url =
        String.format(
            "%s/storage/v1/object/sign/%s/%s?expiresIn=%d", supabaseUrl, bucket, path, expires);

    try {
      String responseBody =
          restClient
              .post()
              .uri(URI.create(url))
              .header(HttpHeaders.AUTHORIZATION, "Bearer " + bearerToken)
              .retrieve()
              .body(String.class);

      if (responseBody == null || responseBody.isBlank()) {
        throw new ResponseStatusException(
            HttpStatus.BAD_GATEWAY, "storage service returned an empty response");
      }

      Map<?, ?> json = mapper.readValue(responseBody, Map.class);
      return ResponseEntity.ok(json);
    } catch (RestClientResponseException ex) {
      String responseBody = trimToNull(ex.getResponseBodyAsString());
      return ResponseEntity.status(ex.getStatusCode())
          .body(responseBody != null ? responseBody : Map.of("error", "storage signing failed"));
    } catch (IllegalArgumentException ex) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "invalid storage signing request", ex);
    }
  }

  static String resolveSupabaseUrl(String configuredSupabaseUrl, String jwkSetUri) {
    String explicitUrl = trimToNull(configuredSupabaseUrl);
    if (explicitUrl != null) {
      return stripTrailingSlash(explicitUrl);
    }

    return deriveSupabaseUrlFromJwkSetUri(jwkSetUri);
  }

  static String deriveSupabaseUrlFromJwkSetUri(String jwkSetUri) {
    String value = trimToNull(jwkSetUri);
    if (value == null) {
      return null;
    }

    try {
      URI uri = URI.create(value);
      String path = uri.getPath();
      if (path == null || !path.endsWith(JWK_SET_SUFFIX)) {
        return null;
      }

      String basePath = path.substring(0, path.length() - JWK_SET_SUFFIX.length());
      URI baseUri =
          new URI(
              uri.getScheme(),
              uri.getAuthority(),
              basePath.isBlank() ? null : basePath,
              null,
              null);
      return stripTrailingSlash(baseUri.toString());
    } catch (IllegalArgumentException | URISyntaxException ex) {
      return null;
    }
  }

  static String resolveBearerToken(String serviceRole, Jwt jwt) {
    String configuredServiceRole = trimToNull(serviceRole);
    if (configuredServiceRole != null) {
      return configuredServiceRole;
    }

    if (jwt == null) {
      return null;
    }

    return trimToNull(jwt.getTokenValue());
  }

  private static String stripTrailingSlash(String value) {
    return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
  }

  private static String trimToNull(String value) {
    if (value == null) {
      return null;
    }

    String trimmed = value.trim();
    return trimmed.isEmpty() ? null : trimmed;
  }
}
