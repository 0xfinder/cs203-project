package com.group7.app.ai;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

class AiHintServiceTest {

  private final ObjectMapper objectMapper = new ObjectMapper();

  @SuppressWarnings("unchecked")
  private AiHintService createService(String apiKey, int statusCode, String body) throws Exception {
    HttpClient client = mock(HttpClient.class);
    HttpResponse<String> response = mock(HttpResponse.class);
    when(response.statusCode()).thenReturn(statusCode);
    when(response.body()).thenReturn(body);
    when(client.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
        .thenReturn(response);

    AiHintService service = new AiHintService(apiKey, "gpt-5-mini", objectMapper);
    service.setHttpClient(client);
    return service;
  }

  private AiHintService.HintInput input() {
    return new AiHintService.HintInput(
        "For You Page",
        "MCQ",
        "What does FYP mean in this sentence?",
        List.of("A personalized feed", "A private message"),
        List.of(),
        "A private message");
  }

  @Test
  void generatesHintFromOutputText() throws Exception {
    AiHintService service =
        createService(
            "sk-test", 200, "{\"output_text\":\"FYP usually refers to a personalized feed.\"}");

    String hint = service.generateHint(input());

    assertThat(hint).contains("personalized feed");
  }

  @Test
  void generatesHintFromOutputContentText() throws Exception {
    String responseJson =
        """
        {
          "output": [
            {
              "content": [
                {
                  "type": "output_text",
                  "text": "Aura is about perceived coolness or social presence."
                }
              ]
            }
          ]
        }
        """;
    AiHintService service = createService("sk-test", 200, responseJson);

    String hint = service.generateHint(input());

    assertThat(hint).contains("social presence");
  }

  @Test
  void missingApiKeyReturnsServiceUnavailable() {
    AiHintService service = new AiHintService("", "gpt-5-mini", objectMapper);

    assertThatThrownBy(() -> service.generateHint(input()))
        .isInstanceOf(ResponseStatusException.class)
        .hasMessageContaining("AI hints are unavailable right now.");
  }

  @Test
  void upstreamFailureReturnsBadGateway() throws Exception {
    AiHintService service = createService("sk-test", 500, "upstream error");

    assertThatThrownBy(() -> service.generateHint(input()))
        .isInstanceOf(ResponseStatusException.class)
        .hasMessageContaining("AI hints are unavailable right now.");
  }
}
