# cs203-project

## Frontend

### Requirements

- [Bun](https://bun.sh)

### Setup

```bash
cd frontend && bun install
```

### Development

```bash
# start dev server
bun run dev

# lint / format
bun run lint
bun run fmt

# preview production build
bun run preview

# build
bun run build
```

### Tech Stack

- Runtime: Bun
- SPA: Vite
- Routing: Tanstack Router
- Frontend Framework: React
- Component Library: shadcn
- Styling: Tailwind CSS
- HTTP Client: ky

## Backend

### Requirements

- [Gradle](https://docs.gradle.org/current/userguide/installation.html)
- Java 21

### Setup

```bash
cd backend && ./gradlew build
```

### Development

```bash
# start dev server
./gradlew bootRun

# run tests
./gradlew test --rerun-tasks

# format code
./gradlew spotlessApply

# build
./gradlew build

# clean build
./gradlew clean build
```

### Tech Stack

- Build Tool: Gradle (Kotlin DSL)
- Runtime: Java 21
- Framework: Spring Boot 3.5.10
- Database: Supabase (PostgreSQL)
- ORM: Spring Data JPA
- Security: Spring Security
- Validation: Jakarta Bean Validation

## Deploying

Deployment is managed with docker compose, site starts at port 80, with /api requests routed to backend at 8080 by nginx

### Requirements

- [Docker](https://www.docker.com/)

### Instructions

```bash
# copy frontend .env to project root
cp frontend/.env ./

# docker compose
docker compose up --build

# stop containers
docker compose down
```