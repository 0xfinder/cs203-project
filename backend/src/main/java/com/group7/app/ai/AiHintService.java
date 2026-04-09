package com.group7.app.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AiHintService {

  private static final Logger log = LoggerFactory.getLogger(AiHintService.class);
  private static final String RESPONSES_URL = "https://api.openai.com/v1/responses";

  private final String apiKey;
  private final String model;
  private final ObjectMapper objectMapper;
  private HttpClient httpClient;

  public AiHintService(
      @Value("${openai.api-key:}") String apiKey,
      @Value("${openai.hints.model:gpt-5-mini}") String model,
      ObjectMapper objectMapper) {
    this.apiKey = apiKey;
    this.model = model;
    this.objectMapper = objectMapper;
    this.httpClient = HttpClient.newHttpClient();
  }

  void setHttpClient(HttpClient httpClient) {
    this.httpClient = httpClient;
  }

  public String generateHint(HintInput input) {
    if (apiKey == null || apiKey.isBlank()) {
      throw new ResponseStatusException(
          HttpStatus.SERVICE_UNAVAILABLE, "AI hints are unavailable right now.");
    }

    Map<String, Object> body = Map.of("model", model, "input", buildPrompt(input));

    try {
      String jsonBody = objectMapper.writeValueAsString(body);
      HttpRequest request =
          HttpRequest.newBuilder()
              .uri(URI.create(RESPONSES_URL))
              .header("Content-Type", "application/json")
              .header("Authorization", "Bearer " + apiKey)
              .POST(HttpRequest.BodyPublishers.ofString(jsonBody))
              .build();

      HttpResponse<String> response =
          httpClient.send(request, HttpResponse.BodyHandlers.ofString());

      if (response.statusCode() < 200 || response.statusCode() >= 300) {
        log.error(
            "OpenAI hint request failed: status={}, body={}",
            response.statusCode(),
            response.body());
        throw new ResponseStatusException(
            HttpStatus.BAD_GATEWAY, "AI hints are unavailable right now.");
      }

      JsonNode responseJson = objectMapper.readTree(response.body());
      String hint = extractHintText(responseJson);
      if (hint == null || hint.isBlank()) {
        log.error("OpenAI hint request returned no text: {}", response.body());
        throw new ResponseStatusException(
            HttpStatus.BAD_GATEWAY, "AI hints are unavailable right now.");
      }

      return hint.trim();
    } catch (ResponseStatusException exception) {
      throw exception;
    } catch (Exception exception) {
      log.error("Failed to generate AI hint", exception);
      throw new ResponseStatusException(
          HttpStatus.BAD_GATEWAY, "AI hints are unavailable right now.");
    }
  }

  private String buildPrompt(HintInput input) {
    StringBuilder prompt = new StringBuilder();
    prompt.append(
        "You are helping a learner on AlphaLingo understand a Gen-Alpha culture concept.\n");
    prompt.append("Explain the concept behind the question clearly and directly.\n");
    prompt.append("Keep it concise but useful, and tailor it to the exact prompt.\n\n");
    prompt.append("lesson: ").append(input.lessonTitle()).append('\n');
    prompt.append("question type: ").append(input.questionType()).append('\n');
    prompt.append("prompt: ").append(input.prompt()).append('\n');

    if (input.choices() != null && !input.choices().isEmpty()) {
      prompt.append("choices:\n");
      for (String choice : input.choices()) {
        prompt.append("- ").append(choice).append('\n');
      }
    }

    if (input.matchPrompts() != null && !input.matchPrompts().isEmpty()) {
      prompt.append("match items:\n");
      for (String matchPrompt : input.matchPrompts()) {
        prompt.append("- ").append(matchPrompt).append('\n');
      }
    }

    if (input.currentAnswer() != null && !input.currentAnswer().isBlank()) {
      prompt.append("current learner answer: ").append(input.currentAnswer()).append('\n');
    }

    prompt.append(
        "\nWrite the explanation as short prose. Reference the concrete slang, context, or pattern in the question.");
    return prompt.toString();
  }

  private String extractHintText(JsonNode responseJson) {
    JsonNode outputText = responseJson.get("output_text");
    if (outputText != null && outputText.isTextual() && !outputText.asText().isBlank()) {
      return outputText.asText();
    }

    List<String> chunks = new ArrayList<>();
    JsonNode output = responseJson.get("output");
    if (output == null || !output.isArray()) {
      return null;
    }

    for (JsonNode item : output) {
      JsonNode content = item.get("content");
      if (content == null || !content.isArray()) {
        continue;
      }

      for (JsonNode part : content) {
        JsonNode text = part.get("text");
        if (text != null && text.isTextual() && !text.asText().isBlank()) {
          chunks.add(text.asText());
        }
      }
    }

    if (chunks.isEmpty()) {
      return null;
    }

    return String.join("\n\n", chunks);
  }

  public record HintInput(
      String lessonTitle,
      String questionType,
      String prompt,
      List<String> choices,
      List<String> matchPrompts,
      String currentAnswer) {}
}
