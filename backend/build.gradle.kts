plugins {
	java
	id("org.springframework.boot") version "3.5.10"
	id("io.spring.dependency-management") version "1.1.7"
}

group = "com.group7"
version = "0.0.1-SNAPSHOT"
description = "Spring Boot REST API backend"

java {
	toolchain {
		languageVersion = JavaLanguageVersion.of(21)
	}
}

repositories {
	mavenCentral()
}

dependencies {
	implementation("org.springframework.boot:spring-boot-starter-data-jpa")
	implementation("org.springframework.boot:spring-boot-starter-security")
	implementation("org.springframework.boot:spring-boot-starter-oauth2-resource-server")
	implementation("org.springframework.boot:spring-boot-starter-validation")
	implementation("org.springframework.boot:spring-boot-starter-web")
	developmentOnly("org.springframework.boot:spring-boot-devtools")
	runtimeOnly("org.postgresql:postgresql")
	testImplementation("org.springframework.boot:spring-boot-starter-test")
	testImplementation("org.springframework.security:spring-security-test")
	testRuntimeOnly("org.junit.platform:junit-platform-launcher")
	testImplementation("com.h2database:h2")
	// Swagger UI
	implementation("org.springdoc:springdoc-openapi-starter-webmvc-ui:2.8.15")
}

tasks.withType<Test> {
	useJUnitPlatform()
	environment("SPRINGDOTENV_DIRECTORY", projectDir.absolutePath)
	environment("SPRINGDOTENV_FILENAME", ".env")
}

tasks.named<org.springframework.boot.gradle.tasks.run.BootRun>("bootRun") {
	environment("SPRINGDOTENV_DIRECTORY", projectDir.absolutePath)
	environment("SPRINGDOTENV_FILENAME", ".env")
}
