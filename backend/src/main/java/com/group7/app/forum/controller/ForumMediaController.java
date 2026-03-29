package com.group7.app.forum.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/forum/media")
public class ForumMediaController {

  @Value("${SUPABASE_URL}")
  private String supabaseUrl;

  @Value("${SUPABASE_SERVICE_ROLE}")
  private String serviceRole;

  private final ObjectMapper mapper = new ObjectMapper();

  @PostMapping("/signed-url")
  public ResponseEntity<?> signedUrl(@RequestBody Map<String, Object> body)
      throws IOException, InterruptedException {
    String bucket = (String) body.getOrDefault("bucket", "forum-media");
    String path = (String) body.get("path");
    Integer expires = (Integer) body.getOrDefault("expires", 60 * 60 * 24);
    if (path == null || path.isBlank()) {
      return ResponseEntity.badRequest().body(Map.of("error", "missing path"));
    }

    String url =
        String.format(
            "%s/storage/v1/object/sign/%s/%s?expiresIn=%d", supabaseUrl, bucket, path, expires);

    HttpRequest req =
        HttpRequest.newBuilder()
            .uri(URI.create(url))
            .header("Authorization", "Bearer " + serviceRole)
            .POST(HttpRequest.BodyPublishers.noBody())
            .build();

    HttpClient client = HttpClient.newHttpClient();
    HttpResponse<String> resp = client.send(req, HttpResponse.BodyHandlers.ofString());

    if (resp.statusCode() >= 200 && resp.statusCode() < 300) {
      Map<?, ?> json = mapper.readValue(resp.body(), Map.class);
      return ResponseEntity.ok(json);
    }

    return ResponseEntity.status(resp.statusCode()).body(resp.body());
  }
}
