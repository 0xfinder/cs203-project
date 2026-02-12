package com.group7.app.example;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

@ResponseStatus(HttpStatus.NOT_FOUND)
public class ExampleNotFoundException extends RuntimeException {

    public ExampleNotFoundException(Long id) {
        super("Example not found: " + id);
    }
}
