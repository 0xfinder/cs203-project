package com.group7.app.lesson.service;

import com.group7.app.user.User;
import com.group7.app.user.UserService;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AuthContextService {

    private final UserService userService;

    public AuthContextService(UserService userService) {
        this.userService = userService;
    }

    public User resolveUser(Jwt jwt) {
        UUID userId = parseUserId(jwt);
        String email = getEmail(jwt);
        return userService.findById(userId).orElseGet(() -> userService.createFromAuth(userId, email));
    }

    private static UUID parseUserId(Jwt jwt) {
        String subject = jwt.getSubject();
        if (subject == null || subject.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "missing token subject");
        }
        try {
            return UUID.fromString(subject);
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "invalid token subject");
        }
    }

    private static String getEmail(Jwt jwt) {
        String email = jwt.getClaimAsString("email");
        if (email == null || email.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "missing email claim");
        }
        return email;
    }
}
