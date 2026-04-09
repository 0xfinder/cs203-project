package com.group7.app.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.BeanPropertyBindingResult;
import org.springframework.validation.BindException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;

class GlobalExceptionHandlerTest {

  private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

  @Test
  void handleValidationExceptionFormatsMethodArgumentErrors() {
    MethodArgumentNotValidException exception = mock(MethodArgumentNotValidException.class);
    BeanPropertyBindingResult bindingResult =
        new BeanPropertyBindingResult(new Object(), "request");
    bindingResult.addError(new FieldError("request", "title", "must not be blank"));
    when(exception.getBindingResult()).thenReturn(bindingResult);

    ResponseEntity<?> response = handler.handleValidationException(exception);

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    @SuppressWarnings("unchecked")
    Map<String, Object> body = (Map<String, Object>) response.getBody();
    assertThat(body).isNotNull();
    assertThat(body.get("message")).isEqualTo("Validation failed for request");
    assertThat(body.get("details").toString()).contains("title: must not be blank");
  }

  @Test
  void handleValidationExceptionFormatsBindErrors() {
    BeanPropertyBindingResult bindingResult =
        new BeanPropertyBindingResult(new Object(), "request");
    bindingResult.addError(
        new FieldError("request", "email", "must be a well-formed email address"));
    BindException exception = new BindException(bindingResult);

    ResponseEntity<?> response = handler.handleValidationException(exception);

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    @SuppressWarnings("unchecked")
    Map<String, Object> body = (Map<String, Object>) response.getBody();
    assertThat(body).isNotNull();
    assertThat(body.get("details").toString())
        .contains("email: must be a well-formed email address");
  }

  @Test
  void handleDataIntegrityMapsKnownVocabConstraint() {
    DataIntegrityViolationException exception =
        new DataIntegrityViolationException("boom", new RuntimeException("vocab_items_term_key"));

    ResponseEntity<?> response = handler.handleDataIntegrity(exception);

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    @SuppressWarnings("unchecked")
    Map<String, Object> body = (Map<String, Object>) response.getBody();
    assertThat(body.get("message")).isEqualTo("[Definition] name already exists!");
  }

  @Test
  void handleDataIntegrityMapsLessonSlugConstraint() {
    DataIntegrityViolationException exception =
        new DataIntegrityViolationException("boom", new RuntimeException("lessons_slug_key"));

    ResponseEntity<?> response = handler.handleDataIntegrity(exception);

    @SuppressWarnings("unchecked")
    Map<String, Object> body = (Map<String, Object>) response.getBody();
    assertThat(body.get("message")).isEqualTo("[Lesson] name already exists!");
  }

  @Test
  void handleDataIntegrityMapsLessonOrderConstraint() {
    DataIntegrityViolationException exception =
        new DataIntegrityViolationException("boom", new RuntimeException("uq_lessons_unit_order"));

    ResponseEntity<?> response = handler.handleDataIntegrity(exception);

    @SuppressWarnings("unchecked")
    Map<String, Object> body = (Map<String, Object>) response.getBody();
    assertThat(body.get("message")).isEqualTo("Lesson order conflict — please try again.");
  }

  @Test
  void handleDataIntegrityFallsBackToGenericMessage() {
    DataIntegrityViolationException exception = new DataIntegrityViolationException("generic");

    ResponseEntity<?> response = handler.handleDataIntegrity(exception);

    @SuppressWarnings("unchecked")
    Map<String, Object> body = (Map<String, Object>) response.getBody();
    assertThat(body.get("message")).isEqualTo("Data integrity error");
    assertThat(body.get("detail").toString()).contains("generic");
  }
}
