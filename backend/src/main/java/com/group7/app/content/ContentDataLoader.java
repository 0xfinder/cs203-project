package com.group7.app.content;

import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class ContentDataLoader {

    @Bean
    CommandLineRunner seedContents(ContentRepository repository) {
        return args -> {
            System.out.println("Running ContentDataLoader...");
            System.out.println("Current count: " + repository.count());
            if (repository.count() < 5) {
                System.out.println("Seeding 5 Gen Alpha records...");
                repository.save(new Content("Simp", "Someone who does way too much for someone they like",
                        "He bought her three Roblox skins, such a simp", "Luna"));
                repository.save(new Content("Sus", "Suspicious or shady; often from Among Us game slang",
                        "Red is acting kinda sus in this round", "Kai"));
                repository.save(new Content("Drip", "Cool style or outfit",
                        "Check out his drip, those sneakers are fire", "Mila"));
                repository.save(new Content("FYP", "For You Page – the TikTok feed curated for you",
                        "That dance went viral on my FYP", "Leo"));
                repository.save(new Content("Yeet", "To throw something with excitement or force, or as an exclamation",
                        "He yeeted the ball across the field", "Sofia"));
                System.out.println("Seeding complete!");
            }
        };
    }

}
