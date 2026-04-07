package com.group7.app.lesson.model;

import com.fasterxml.jackson.databind.annotation.JsonDeserialize;

@JsonDeserialize(using = QuestionTypeDeserializer.class)
public enum QuestionType {
  MCQ,
  MATCH,
  SHORT_ANSWER
}
