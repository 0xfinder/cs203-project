package com.group7.app.content.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** DTO for creating new content. submittedBy is set by the backend from the authenticated user. */
public class ContentCreateRequest {

  @NotBlank
  @Size(max = 100)
  private String term;

  @NotBlank
  @Size(max = 500)
  private String definition;

  @Size(max = 500)
  private String example;

  public ContentCreateRequest() {}

  public ContentCreateRequest(String term, String definition, String example) {
    this.term = term;
    this.definition = definition;
    this.example = example;
  }

  public String getTerm() {
    return term;
  }

  public void setTerm(String term) {
    this.term = term;
  }

  public String getDefinition() {
    return definition;
  }

  public void setDefinition(String definition) {
    this.definition = definition;
  }

  public String getExample() {
    return example;
  }

  public void setExample(String example) {
    this.example = example;
  }
}
