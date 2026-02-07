

<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# General Guidelines for working with Nx

- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- You have access to the Nx MCP server and its tools, use them to help the user
- When answering questions about the repository, use the `nx_workspace` tool first to gain an understanding of the workspace architecture where applicable.
- When working in individual projects, use the `nx_project_details` mcp tool to analyze and understand the specific project structure and dependencies
- For questions around nx configuration, best practices or if you're unsure, use the `nx_docs` tool to get relevant, up-to-date docs. Always use this instead of assuming things about nx configuration
- If the user needs help with an Nx configuration or project graph error, use the `nx_workspace` tool to get any errors
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.

<!-- nx configuration end-->

# Project-Specific Instructions

## Required Reading

**ALWAYS** read and follow the guidelines in `.github/copilot-instructions.md` before working on any task in this repository. This file contains essential conventions, architecture decisions, and code quality standards for the entire QuizForge project.

## Context-Specific Instructions

When working on specific parts of the codebase, also consult the relevant instruction files:

- **Backend tasks** (anything in `apps/backend/**`): Read `.github/instructions/backend.instructions.md` for backend-specific conventions, API patterns, database schema, authentication flows, and Bun/Express guidelines.

- **Frontend tasks** (anything in `apps/frontend/**`): Read `.github/instructions/frontend.instructions.md` for frontend-specific conventions, Angular patterns, component structure, state management, and UI/UX guidelines.

These instruction files are mandatory reading before making code changes to ensure consistency with the project's architecture and design patterns.