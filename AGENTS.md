<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

## General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax

<!-- nx configuration end-->

# Project-Specific Instructions

## Required Reading

**ALWAYS** read and follow the guidelines in `.github/copilot-instructions.md` before working on any task in this repository. This file contains essential conventions, architecture decisions, and code quality standards for the entire QuizForge project.

## Context-Specific Instructions

When working on specific parts of the codebase, also consult the relevant instruction files:

- **Backend tasks** (anything in `apps/backend/**`): Read `.github/instructions/backend.instructions.md` for backend-specific conventions, API patterns, database schema, authentication flows, and Bun/Express guidelines.

- **Frontend tasks** (anything in `apps/frontend/**`): Read `.github/instructions/frontend.instructions.md` for frontend-specific conventions, Angular patterns, component structure, state management, and UI/UX guidelines.

These instruction files are mandatory reading before making code changes to ensure consistency with the project's architecture and design patterns.
