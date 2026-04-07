package com.group7.app.forum.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ModerationService {

  private static final Logger log = LoggerFactory.getLogger(ModerationService.class);
  private static final String MODERATION_URL = "https://api.openai.com/v1/moderations";
  private static final Pattern MARKDOWN_IMAGE_PATTERN = Pattern.compile("!\\[[^]]*]\\(([^)]+)\\)");

  private final String apiKey;
  private final boolean enabled;
  private HttpClient httpClient;
  private final ObjectMapper objectMapper;

  public ModerationService(
      @Value("${openai.api-key:}") String apiKey,
      @Value("${openai.moderation.enabled:true}") boolean enabled,
      ObjectMapper objectMapper) {
    this.apiKey = apiKey;
    this.enabled = enabled;
    this.httpClient = HttpClient.newHttpClient();
    this.objectMapper = objectMapper;
    log.info(
        "ModerationService initialized: enabled={}, apiKey={}",
        enabled,
        (apiKey != null && apiKey.length() > 8) ? apiKey.substring(0, 8) + "..." : "(empty)");
  }

  /** Override the HTTP client (for testing). */
  void setHttpClient(HttpClient httpClient) {
    this.httpClient = httpClient;
  }

  /** Moderate text content. Throws 400 if flagged. */
  public void moderateText(String text) {
    if (!enabled || apiKey == null || apiKey.isBlank()) {
      log.debug("Moderation skipped (disabled or no API key)");
      return;
    }

    Map<String, Object> body =
        Map.of(
            "model",
            "omni-moderation-latest",
            "input",
            List.of(Map.of("type", "text", "text", text)));
    JsonNode result = callModerationApi(body);
    checkResults(result);
  }

  /**
   * Moderate markdown content — extracts text and any embedded image URLs, then sends them all in a
   * single moderation call.
   */
  public void moderateContent(String markdownContent) {
    if (!enabled || apiKey == null || apiKey.isBlank()) {
      log.debug("Moderation skipped (disabled or no API key)");
      return;
    }

    // Extract image URLs from markdown ![alt](url)
    List<String> imageUrls = new ArrayList<>();
    Matcher matcher = MARKDOWN_IMAGE_PATTERN.matcher(markdownContent);
    while (matcher.find()) {
      imageUrls.add(matcher.group(1));
    }

    // Build multi-modal input array
    List<Map<String, Object>> input = new ArrayList<>();
    input.add(Map.of("type", "text", "text", markdownContent));
    for (String url : imageUrls) {
      input.add(Map.of("type", "image_url", "image_url", Map.of("url", url)));
    }

    log.debug("Moderating content: text + {} image(s)", imageUrls.size());
    Map<String, Object> body = Map.of("model", "omni-moderation-latest", "input", input);
    JsonNode result = callModerationApi(body);
    checkResults(result);
  }

  /** Moderate an image by URL. Throws 400 if flagged. */
  public void moderateImageUrl(String imageUrl) {
    if (!enabled || apiKey == null || apiKey.isBlank()) {
      return;
    }

    Map<String, Object> body =
        Map.of(
            "model",
            "omni-moderation-latest",
            "input",
            List.of(Map.of("type", "image_url", "image_url", Map.of("url", imageUrl))));
    JsonNode result = callModerationApi(body);
    checkResults(result);
  }

  /** Moderate text + image together in one call. */
  public void moderateTextAndImageUrl(String text, String imageUrl) {
    if (!enabled || apiKey == null || apiKey.isBlank()) {
      return;
    }

    List<Map<String, Object>> input = new ArrayList<>();
    input.add(Map.of("type", "text", "text", text));
    input.add(Map.of("type", "image_url", "image_url", Map.of("url", imageUrl)));

    Map<String, Object> body = Map.of("model", "omni-moderation-latest", "input", input);
    JsonNode result = callModerationApi(body);
    checkResults(result);
  }

  private JsonNode callModerationApi(Map<String, Object> body) {
    try {
      String jsonBody = objectMapper.writeValueAsString(body);

      HttpRequest request =
          HttpRequest.newBuilder()
              .uri(URI.create(MODERATION_URL))
              .header("Content-Type", "application/json")
              .header("Authorization", "Bearer " + apiKey)
              .POST(HttpRequest.BodyPublishers.ofString(jsonBody))
              .build();

      HttpResponse<String> response =
          httpClient.send(request, HttpResponse.BodyHandlers.ofString());

      if (response.statusCode() != 200) {
        log.error("OpenAI Moderation API error: {} {}", response.statusCode(), response.body());
        // fail open — don't block the user if the API is down
        return null;
      }

      return objectMapper.readTree(response.body());
    } catch (Exception e) {
      log.error("Failed to call OpenAI Moderation API", e);
      // fail open
      return null;
    }
  }

  private void checkResults(JsonNode response) {
    if (response == null) {
      return; // fail open
    }

    JsonNode results = response.get("results");
    if (results == null || !results.isArray() || results.isEmpty()) {
      return;
    }

    JsonNode first = results.get(0);
    if (first.has("flagged") && first.get("flagged").asBoolean()) {
      List<String> flaggedCategories = new ArrayList<>();
      JsonNode categories = first.get("categories");
      if (categories != null) {
        var it = categories.fieldNames();
        while (it.hasNext()) {
          String field = it.next();
          if (categories.get(field).asBoolean()) {
            flaggedCategories.add(field);
          }
        }
      }

      log.info("Content flagged by moderation. Categories: {}", flaggedCategories);
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST,
          "Your post was flagged by our content moderation system and cannot be published. "
              + "Flagged categories: "
              + String.join(", ", flaggedCategories));
    }
  }
}
