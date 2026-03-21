package com.group7.app.config;

import com.group7.app.lesson.service.AuthContextService;
import com.group7.app.user.User;
import java.util.LinkedHashSet;
import java.util.Set;
import org.springframework.core.convert.converter.Converter;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter;
import org.springframework.stereotype.Component;

@Component
public class DatabaseRoleJwtAuthenticationConverter implements Converter<Jwt, AbstractAuthenticationToken> {

    private final AuthContextService authContextService;
    private final JwtGrantedAuthoritiesConverter jwtGrantedAuthoritiesConverter =
            new JwtGrantedAuthoritiesConverter();

    public DatabaseRoleJwtAuthenticationConverter(AuthContextService authContextService) {
        this.authContextService = authContextService;
    }

    @Override
    public AbstractAuthenticationToken convert(Jwt jwt) {
        User user = authContextService.resolveUser(jwt);

        Set<GrantedAuthority> authorities = new LinkedHashSet<>(jwtGrantedAuthoritiesConverter.convert(jwt));
        authorities.add(new SimpleGrantedAuthority("ROLE_" + user.getRole().name()));

        return new JwtAuthenticationToken(jwt, authorities, jwt.getSubject());
    }
}
