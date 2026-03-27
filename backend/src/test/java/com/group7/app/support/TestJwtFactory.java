package com.group7.app.support;

import java.util.Arrays;
import java.util.Collection;
import java.util.UUID;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor;

public final class TestJwtFactory {

  private TestJwtFactory() {}

  public static JwtRequestPostProcessor jwt(UUID userId, String email, String... roles) {
    JwtRequestPostProcessor processor =
        SecurityMockMvcRequestPostProcessors.jwt()
            .jwt(token -> token.subject(userId.toString()).claim("email", email));

    if (roles.length == 0) {
      return processor;
    }

    Collection<GrantedAuthority> authorities =
        Arrays.stream(roles)
            .map(role -> new SimpleGrantedAuthority("ROLE_" + role))
            .map(GrantedAuthority.class::cast)
            .toList();
    return processor.authorities(authorities);
  }
}
