package com.group7.app.forum.service;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

class ModerationServiceTest {

  private final ObjectMapper objectMapper = new ObjectMapper();

  @SuppressWarnings("unchecked")
  private ModerationService createService(
      String apiKey, boolean enabled, int statusCode, String body) throws Exception {
    HttpClient client = mock(HttpClient.class);
    HttpResponse<String> response = mock(HttpResponse.class);
    when(response.statusCode()).thenReturn(statusCode);
    when(response.body()).thenReturn(body);
    when(client.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
        .thenReturn(response);

    ModerationService service = new ModerationService(apiKey, enabled, objectMapper);
    service.setHttpClient(client);
    return service;
  }

  @Test
  void safeContentPassesModeration() throws Exception {
    String responseJson =
        """
        {
          "results": [{
            "flagged": false,
            "categories": {
              "harassment": false,
              "violence": false
            }
          }]
        }
        """;
    ModerationService service = createService("sk-test", true, 200, responseJson);

    assertThatCode(() -> service.moderateText("What does skibidi mean?"))
        .doesNotThrowAnyException();
  }

  @Test
  void flaggedContentThrows400() throws Exception {
    String responseJson =
        """
        {
          "results": [{
            "flagged": true,
            "categories": {
              "harassment": true,
              "violence": false,
              "hate": true
            }
          }]
        }
        """;
    ModerationService service = createService("sk-test", true, 200, responseJson);

    assertThatThrownBy(() -> service.moderateText("some bad content"))
        .isInstanceOf(ResponseStatusException.class)
        .hasMessageContaining("flagged by our content moderation system")
        .hasMessageContaining("harassment")
        .hasMessageContaining("hate");
  }

  @Test
  void apiErrorFailsOpen() throws Exception {
    ModerationService service = createService("sk-test", true, 500, "Internal Server Error");

    assertThatCode(() -> service.moderateText("anything")).doesNotThrowAnyException();
  }

  @Test
  void disabledModerationSkipsCheck() {
    ModerationService service = new ModerationService("sk-test", false, objectMapper);

    assertThatCode(() -> service.moderateText("anything")).doesNotThrowAnyException();
  }

  @Test
  void missingApiKeySkipsCheck() {
    ModerationService service = new ModerationService("", true, objectMapper);

    assertThatCode(() -> service.moderateText("anything")).doesNotThrowAnyException();
  }

  @Test
  void moderateContentSupportsMarkdownImages() throws Exception {
    String responseJson =
        """
        {
          "results": [{
            "flagged": false,
            "categories": {
              "harassment": false
            }
          }]
        }
        """;
    ModerationService service = createService("sk-test", true, 200, responseJson);

    assertThatCode(
            () ->
                service.moderateContent(
                    "look at this ![alt](https://cdn.example.com/test.png) and explain it"))
        .doesNotThrowAnyException();
  }

  @Test
  void malformedModerationResponseFailsOpen() throws Exception {
    ModerationService service = createService("sk-test", true, 200, "{\"unexpected\":true}");

    assertThatCode(
            () -> service.moderateTextAndImageUrl("caption", "https://cdn.example.com/a.png"))
        .doesNotThrowAnyException();
  }

  @Test
  void invalidJsonResponseFailsOpen() throws Exception {
    ModerationService service = createService("sk-test", true, 200, "not-json");

    assertThatCode(() -> service.moderateImageUrl("https://cdn.example.com/a.png"))
        .doesNotThrowAnyException();
  }
}
