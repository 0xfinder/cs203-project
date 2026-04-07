plugins {
	java
	id("org.springframework.boot") version "3.5.10"
	id("io.spring.dependency-management") version "1.1.7"
	id("jacoco")
	id("com.diffplug.spotless") version "8.4.0"
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

val coverageExclusions = listOf(
	"**/*Application.class",
	"**/content/service/ContentDataLoader.class"
)

dependencies {
	implementation("org.springframework.boot:spring-boot-starter-data-jpa")
	implementation("org.springframework.boot:spring-boot-starter-security")
	implementation("org.springframework.boot:spring-boot-starter-oauth2-resource-server")
	implementation("org.springframework.boot:spring-boot-starter-validation")
	implementation("org.springframework.boot:spring-boot-starter-web")
	developmentOnly("org.springframework.boot:spring-boot-devtools")
	runtimeOnly("org.postgresql:postgresql")
	runtimeOnly("com.h2database:h2")
	testImplementation("org.springframework.boot:spring-boot-starter-test")
	testImplementation("org.springframework.security:spring-security-test")
	testRuntimeOnly("org.junit.platform:junit-platform-launcher")
	testImplementation("com.h2database:h2")
	// Swagger UI
	implementation("org.springdoc:springdoc-openapi-starter-webmvc-ui:2.8.15")
}

// for code formatting
spotless {
	java {
		googleJavaFormat()
	}
}

tasks.withType<Test> {
	useJUnitPlatform()
	environment("SPRINGDOTENV_DIRECTORY", projectDir.absolutePath)
	environment("SPRINGDOTENV_FILENAME", ".env")
	finalizedBy(tasks.jacocoTestReport)
}

tasks.named<org.springframework.boot.gradle.tasks.run.BootRun>("bootRun") {
	environment("SPRINGDOTENV_DIRECTORY", projectDir.absolutePath)
	environment("SPRINGDOTENV_FILENAME", ".env")
}

jacoco {
	toolVersion = "0.8.12"
}

fun filteredCoverageDirectories(classDirectories: org.gradle.api.file.FileCollection) =
	files(classDirectories.files.map { directory ->
		fileTree(directory) {
			exclude(coverageExclusions)
		}
	})

tasks.jacocoTestReport {
	dependsOn(tasks.test)

	reports {
		xml.required.set(true)
		html.required.set(true)
		csv.required.set(false)
	}

	classDirectories.setFrom(filteredCoverageDirectories(classDirectories))
}

tasks.jacocoTestCoverageVerification {
	dependsOn(tasks.test)
	classDirectories.setFrom(filteredCoverageDirectories(classDirectories))

	violationRules {
		rule {
			limit {
				counter = "LINE"
				value = "COVEREDRATIO"
				minimum = "0.50".toBigDecimal()
			}
			limit {
				counter = "BRANCH"
				value = "COVEREDRATIO"
				minimum = "0.35".toBigDecimal()
			}
		}
	}
}

tasks.check {
	dependsOn(tasks.jacocoTestCoverageVerification)
}

tasks.register<JavaExec>("applyStoragePolicy") {
	group = "tools"
	description = "Apply storage RLS policy for forum-media using JDBC"
	classpath = sourceSets.main.get().runtimeClasspath
	mainClass.set("com.group7.app.tools.ApplyStoragePolicy")
	// ensure .env is available to the JVM
	environment("SPRINGDOTENV_DIRECTORY", projectDir.absolutePath)
	environment("SPRINGDOTENV_FILENAME", ".env")
}
