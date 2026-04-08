package com.group7.app.forum.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

@Schema(
    name = "ForumMediaSignedUrlRequest",
    description = "Request payload for generating a signed URL for a forum media upload")
public record ForumMediaSignedUrlRequest(
    @Schema(
            description = "Supabase storage bucket that stores forum uploads",
            example = "forum-media",
            defaultValue = "forum-media")
        String bucket,
    @NotBlank
        @Schema(
            description = "Object path within the bucket",
            example = "forum/123e4567-e89b-12d3-a456-426614174000/1712572412_ab12cd.png")
        String path,
    @Min(1)
        @Schema(
            description = "Signed URL expiration time in seconds",
            example = "86400",
            defaultValue = "86400")
        Integer expires) {

  private static final String DEFAULT_BUCKET = "forum-media";
  private static final int DEFAULT_EXPIRES_SECONDS = 60 * 60 * 24;

  public String bucketOrDefault() {
    if (bucket == null || bucket.isBlank()) {
      return DEFAULT_BUCKET;
    }
    return bucket.trim();
  }

  public String normalizedPath() {
    return path.trim();
  }

  public int expiresOrDefault() {
    return expires == null ? DEFAULT_EXPIRES_SECONDS : expires;
  }
}
