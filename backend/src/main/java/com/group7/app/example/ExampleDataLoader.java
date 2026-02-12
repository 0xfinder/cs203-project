package com.group7.app.example;

import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class ExampleDataLoader {

    @Bean
    CommandLineRunner seedExamples(ExampleRepository repository) {
        return args -> {
            if (repository.count() < 5) {
                repository.save(new Example("TanStack Query handles caching"));
                repository.save(new Example("Loading and error states are built in"));
                repository.save(new Example("This data comes from the Spring Boot API"));
                repository.save(new Example("ky is used as the HTTP client"));
                repository.save(new Example("JPA persists this to PostgreSQL"));
            }
        };
    }
}
