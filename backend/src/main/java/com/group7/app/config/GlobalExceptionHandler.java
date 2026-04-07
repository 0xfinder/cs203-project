package com.group7.app.config;

import java.util.Optional;
import java.util.stream.Collectors;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.BindException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {

  @ExceptionHandler({MethodArgumentNotValidException.class, BindException.class})
  public ResponseEntity<?> handleValidationException(Exception ex) {
    var errors =
        (ex instanceof MethodArgumentNotValidException)
            ? ((MethodArgumentNotValidException) ex).getBindingResult().getFieldErrors()
            : ((BindException) ex).getBindingResult().getFieldErrors();

    String message = "Validation failed for request";
    String details =
        errors.stream()
            .map(fe -> fe.getField() + ": " + fe.getDefaultMessage())
            .collect(Collectors.joining("; "));

    var body =
        java.util.Map.of(
            "message", message,
            "errors", errors.stream().map(FieldError::toString).collect(Collectors.toList()),
            "details", details);

    return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
  }

  @ExceptionHandler(DataIntegrityViolationException.class)
  public ResponseEntity<?> handleDataIntegrity(DataIntegrityViolationException ex) {
    String rootMsg =
        Optional.ofNullable(ex.getRootCause()).map(Object::toString).orElse(ex.getMessage());
    String userMessage = "Data integrity error";

    String lc = rootMsg.toLowerCase();
    if (lc.contains("vocab_items_term") || lc.contains("vocab_items_term_key")) {
      userMessage = "[Definition] name already exists!";
    } else if (lc.contains("lessons_slug")
        || lc.contains("lessons_slug_key")
        || lc.contains("slug")) {
      userMessage = "[Lesson] name already exists!";
    } else if (lc.contains("uq_lessons_unit_order") || lc.contains("order_index")) {
      userMessage = "Lesson order conflict — please try again.";
    }

    var body = java.util.Map.of("message", userMessage, "detail", rootMsg);
    return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
  }
}
