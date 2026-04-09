package com.group7.app.forum.dto;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class ForumMediaSignedUrlRequestTest {

  @Test
  void bucketOrDefaultFallsBackWhenBlank() {
    ForumMediaSignedUrlRequest request = new ForumMediaSignedUrlRequest("   ", " path ", null);

    assertThat(request.bucketOrDefault()).isEqualTo("forum-media");
  }

  @Test
  void bucketOrDefaultTrimsExplicitBucket() {
    ForumMediaSignedUrlRequest request =
        new ForumMediaSignedUrlRequest(" custom-bucket ", " path ", null);

    assertThat(request.bucketOrDefault()).isEqualTo("custom-bucket");
  }

  @Test
  void normalizedPathTrimsWhitespace() {
    ForumMediaSignedUrlRequest request =
        new ForumMediaSignedUrlRequest(null, " forum/user/image.png ", null);

    assertThat(request.normalizedPath()).isEqualTo("forum/user/image.png");
  }

  @Test
  void expiresOrDefaultUsesDefaultWhenMissing() {
    ForumMediaSignedUrlRequest request = new ForumMediaSignedUrlRequest(null, "path", null);

    assertThat(request.expiresOrDefault()).isEqualTo(60 * 60 * 24);
  }

  @Test
  void expiresOrDefaultUsesExplicitValue() {
    ForumMediaSignedUrlRequest request = new ForumMediaSignedUrlRequest(null, "path", 600);

    assertThat(request.expiresOrDefault()).isEqualTo(600);
  }
}
