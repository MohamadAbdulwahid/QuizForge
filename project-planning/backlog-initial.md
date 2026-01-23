# QuizForge Product Backlog

**Story Point Scale:** 1 SP ≈ 2 hours of work

## High Priority - Foundation & Core Features

| ID | User Story | Story Points | Priority | Sprint |
|----|-----------|--------------|----------|--------|
| PB-00 | As a **Team**, we want a Git repository with branching and CI basics so development can start in a controlled way. | 1 | High | 1 |
| PB-01 | As a **Developer**, I want a Node.js + Express project scaffold so backend development can begin. | 1 | High | 1 |
| PB-02 | As a **Developer**, I want an Angular 17+ project scaffold so the frontend can be developed consistently. | 1 | High | 2 |
| PB-03 | As a **Developer**, I want an OpenAPI/Swagger specification for authentication endpoints so the API contract is clear. | 2 | High | 1 |
| PB-04 | As a **Developer**, I want a shared environment configuration (env files) so local and production setups are separated. | 1 | High | 1 |
| PB-05 | As a **System**, I want an OracleXE database schema so quizzes, users, and sessions can be stored reliably. | 2 | High | 1 |
| PB-06 | As a **Developer**, I want database migration and seed scripts so environments are reproducible. | 2 | High | 1 |
| PB-07 | As a **System**, I want Socket.IO integrated so real-time communication is possible. | 5 | High | 2 |
| PB-08 | As a **System**, I want a basic session state machine so live quizzes can be controlled centrally. | 6 | High | 2 |
| PB-09 | As a **User**, I want to authenticate securely so only I can modify my own quizzes. | 5 | High | 1 |
| PB-10 | As a **User**, I want to create and edit quizzes so that I could host them. | 4 | High | 1 |
| PB-11 | As a **Host**, I want to start a live session that generates a unique 6-digit PIN. | 5 | High | 2 |
| PB-12 | As a **Participant**, I want to join a session using a PIN and nickname so I can play without an account. | 6 | High | 2 |
| PB-13 | As a **System**, I want to validate PINs and nicknames so sessions remain consistent. | 3 | High | 2 |
| PB-14 | As a **System**, I want to synchronize questions and timers across clients within <200ms. | 10 | High | 3 |
| PB-15 | As a **Participant**, I want to submit answers within a time limit so scoring is fair. | 5 | High | 3 |
| PB-16 | As a **Developer**, I want error handling middleware so all errors return consistent JSON responses. | 1 | High | 1 |
| PB-17 | As a **Developer**, I want logging middleware (e.g., Morgan, Winston) so requests and errors are tracked. | 1 | High | 1 |
| PB-18 | As a **Host**, I want to control game flow (start question, next question, end game). | 5 | High | 3 |
| PB-21 | As an **Administrator**, I want full GDPR compliance so no student data leaves the local system. | 9 | High | 4 |
| PB-22 | As a **System**, I want stable performance on devices with only 2GB RAM. | 13 | High | 4 |

## Medium Priority - Enhancement Features

| ID | User Story | Story Points | Priority | Sprint |
|----|-----------|--------------|----------|--------|
| PB-19 | As a **Participant**, I want to see rankings and feedback so the quiz feels engaging. | 4 | Medium | 3 |
| PB-20 | As a **System**, I want to support multiple concurrent lobbies so several classes can play simultaneously. | 10 | Medium | 3 |
| PB-23 | As a **Host**, I want post-game analytics so I can evaluate student performance. | 4 | Medium | 4 |
| PB-24 | As a **System**, I want multiple game modes so quizzes are dynamic and innovative. | 13 | Medium | 5 |
| PB-25 | As a **System**, I want to detect disconnects and auto-reconnect participants. | 8 | Medium | 4 |
| PB-26 | As a **System**, I want to discard late answers but notify participants transparently. | 3 | Medium | 3 |

## Low Priority - Deployment & Operations

| ID | User Story | Story Points | Priority | Sprint |
|----|-----------|--------------|----------|--------|
| PB-27 | As an **Administrator**, I want a Dockerized system so QuizForge can be self-hosted in schools. | 2 | Low | 5 |

**Total Story Points:** 132
