package com.group7.app.example;

import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class ExampleService {

    private final ExampleRepository exampleRepository;

    public ExampleService(ExampleRepository exampleRepository) {
        this.exampleRepository = exampleRepository;
    }

    public List<Example> findAll() {
        return exampleRepository.findAll();
    }

    public Example findById(Long id) {
        return exampleRepository.findById(id)
                .orElseThrow(() -> new ExampleNotFoundException(id));
    }

    @Transactional
    public Example create(String title) {
        return exampleRepository.save(new Example(title));
    }
}
