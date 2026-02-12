package com.group7.app.example;

import java.net.URI;
import java.util.List;

import jakarta.validation.Valid;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/examples")
public class ExampleController {

    private final ExampleService exampleService;

    public ExampleController(ExampleService exampleService) {
        this.exampleService = exampleService;
    }

    @GetMapping
    public List<Example> getAll() {
        return exampleService.findAll();
    }

    @GetMapping("/{id}")
    public Example getById(@PathVariable Long id) {
        return exampleService.findById(id);
    }

    @PostMapping
    public ResponseEntity<Example> create(@Valid @RequestBody CreateExampleRequest request) {
        Example created = exampleService.create(request.title());
        return ResponseEntity
                .created(URI.create("/api/examples/" + created.getId()))
                .body(created);
    }

    public record CreateExampleRequest(@jakarta.validation.constraints.NotBlank String title) {}
}
