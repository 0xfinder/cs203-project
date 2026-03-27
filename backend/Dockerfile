FROM eclipse-temurin:21-jdk-jammy AS builder

WORKDIR /app

COPY gradlew settings.gradle.kts build.gradle.kts ./
COPY gradle ./gradle

RUN chmod +x gradlew

COPY src ./src

RUN ./gradlew --no-daemon bootJar

FROM eclipse-temurin:21-jre-jammy

WORKDIR /app

COPY --from=builder /app/build/libs/*.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75.0", "-jar", "/app/app.jar"]
