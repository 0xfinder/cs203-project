package com.group7.app.lesson.model;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.JsonDeserializer;
import java.io.IOException;

public class QuestionTypeDeserializer extends JsonDeserializer<QuestionType> {
  @Override
  public QuestionType deserialize(JsonParser p, DeserializationContext ctxt) throws IOException {
    String value = p.getValueAsString();
    if (value == null) {
      return null;
    }
    // Handle legacy CLOZE type by converting it to SHORT_ANSWER
    if ("CLOZE".equalsIgnoreCase(value)) {
      return QuestionType.SHORT_ANSWER;
    }
    try {
      return QuestionType.valueOf(value.toUpperCase());
    } catch (IllegalArgumentException e) {
      // Default to SHORT_ANSWER if type is unknown
      return QuestionType.SHORT_ANSWER;
    }
  }
}
