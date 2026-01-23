# Sprint 1 - Detailed Task Breakdown

This file contains granular implementation tasks for Sprint 1 user stories.

## PB-00: Git Repository Setup (1 SP)

- **T-00.1:** Initialize Git repository with .gitignore for Node.js
- **T-00.2:** Create branch protection rules (main, develop)
- **T-00.3:** Setup basic GitHub Actions CI workflow

## PB-01: Node.js + Express Scaffold (1 SP)

- **T-01.1:** Initialize npm project with TypeScript
- **T-01.2:** Install Express, configure basic server
- **T-01.3:** Research and document backend tech stack choices

## PB-04: Environment Configuration (1 SP)

- **T-04.1:** Create .env.example with all required variables
- **T-04.2:** Setup dotenv package and configuration loader
- **T-04.3:** Document environment variables in README

## PB-05: Database Schema (2 SP)

- **T-05.1:** Design ERD for users, quizzes, questions, sessions tables
- **T-05.2:** Write SQL DDL scripts for schema creation
- **T-05.3:** Setup OracleXE connection pool in Node.js

## PB-06: Database Migrations (2 SP)

- **T-06.1:** Choose and setup migration tool (e.g., node-oracledb migrations)
- **T-06.2:** Create initial migration scripts
- **T-06.3:** Create seed data scripts for testing

## PB-09: Authentication (5 SP)

- **T-09.1:** Implement JWT token generation utilities (2 SP)
- **T-09.2:** Create authentication middleware for protected routes (2 SP)
- **T-09.3:** Implement POST /api/auth/register endpoint (1 SP)
- **T-09.4:** Implement POST /api/auth/login endpoint (1 SP)
- **T-09.5:** Implement GET /api/auth/me endpoint (1 SP)
- **T-09.6:** Add password hashing with bcrypt (1 SP)

## PB-10: Quiz CRUD (4 SP)

- **T-10.1:** Implement POST /api/quizzes endpoint (2 SP)
- **T-10.2:** Implement GET /api/quizzes and GET /api/quizzes/:id endpoints (1 SP)
- **T-10.3:** Implement PUT /api/quizzes/:id endpoint (1 SP)
- **T-10.4:** Implement DELETE /api/quizzes/:id endpoint (1 SP)
- **T-10.5:** Add ownership validation middleware (1 SP)

## PB-16: Error Handling (1 SP)

- **T-16.1:** Create error handler middleware
- **T-16.2:** Standardize error response format (JSON)

## PB-17: Logging (1 SP)

- **T-17.1:** Setup Morgan for HTTP request logging
- **T-17.2:** Setup Winston for application logging

## PB-03: OpenAPI Specification (2 SP)

- **T-03.1:** Setup Swagger/OpenAPI tools
- **T-03.2:** Document authentication endpoints
- **T-03.3:** Setup Swagger UI route

---

**Total Detailed Tasks:** 20+ individual tasks
**Parallelization:** Multiple developers can work on T-09.x, T-10.x tasks simultaneously
