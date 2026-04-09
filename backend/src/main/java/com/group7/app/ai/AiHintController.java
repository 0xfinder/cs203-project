package com.group7.app.ai;

import com.group7.app.lesson.service.AuthContextService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.util.List;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/ai")
@Tag(name = "AI", description = "AI learning assistance endpoints")
public class AiHintController {

  private final AiHintService aiHintService;
  private final AuthContextService authContextService;

  public AiHintController(AiHintService aiHintService, AuthContextService authContextService) {
    this.aiHintService = aiHintService;
    this.authContextService = authContextService;
  }

  @PostMapping("/hint")
  @Operation(summary = "Generate a contextual hint for a revise question")
  public HintResponse createHint(
      @AuthenticationPrincipal Jwt jwt, @Valid @RequestBody HintRequest request) {
    authContextService.resolveUser(jwt);

    String hint =
        aiHintService.generateHint(
            new AiHintService.HintInput(
                request.lessonTitle().trim(),
                request.questionType().trim(),
                request.prompt().trim(),
                request.choices(),
                request.matchPrompts(),
                request.currentAnswer() == null ? null : request.currentAnswer().trim()));

    return new HintResponse(hint);
  }

  public record HintRequest(
      @NotBlank String lessonTitle,
      @NotBlank String questionType,
      @NotBlank String prompt,
      List<String> choices,
      List<String> matchPrompts,
      String currentAnswer) {}

  public record HintResponse(String hint) {}
}
