package com.group7.app.forum.controller;

import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice(assignableTypes = {ForumController.class, ForumMediaController.class})
public class ForumExceptionHandler {

  @ExceptionHandler(ResponseStatusException.class)
  public ResponseEntity<Map<String, String>> handleResponseStatusException(
      ResponseStatusException ex) {
    String message = ex.getReason() != null ? ex.getReason() : ex.getStatusCode().toString();
    return ResponseEntity.status(ex.getStatusCode()).body(Map.of("message", message));
  }
}
