# 10 — Trigger.dev Setup

Read `AGENTS.md` before starting.

Create and switch to a new Git branch before making changes:

`feature/10-trigger-setup`

Do not implement this feature directly on `main`.

## Goal

Add the Trigger.dev foundation for long-running background work.

This unit establishes configuration, task structure, local development tooling, and one live smoke task.

It does not implement any real AI generation or product workflow.

## Existing Scaffold

The official Trigger.dev CLI scaffold has already been run for this project.

Build on the existing generated files and installed packages.

Do not rerun `trigger init` unless required to repair a broken installation.

Keep the existing Trigger.dev project reference.

## Trigger.dev Packages

Use the installed Trigger.dev v4 packages:

- `@trigger.dev/sdk`
- `@trigger.dev/build`

Keep Trigger.dev package versions aligned.

Do not use deprecated `/v3` imports.

Add a reproducible package script:

`trigger:dev`

It should run the Trigger.dev dev CLI using the same pinned Trigger.dev version used by this setup.

## Trigger Configuration

Keep `trigger.config.ts` at the repository root.

Configure it to:

- import `defineConfig` from `@trigger.dev/sdk`
- use the existing Trigger.dev project reference
- use runtime `node-22`
- explicitly use `./trigger` as the task directory
- disable automatic retries in development

Keep the configuration minimal.

Do not establish AI-specific retry, queue, concurrency, logging, or duration policies in this unit.

## Task Boundary

Use the existing root directory:

`trigger/`

Replace the generated Hello World example with:

`trigger/setup-smoke.ts`

Create one minimal deterministic Trigger.dev task with ID:

`setup-smoke`

Use `schemaTask` with Zod so its input is runtime validated.

Accept a small payload such as:

`{ message: string }`

Return a JSON-serializable result containing:

- `ok: true`
- the validated message

Do not use `any`.

The smoke task must not call external services.

## Local Environment

Use the locally configured:

`TRIGGER_SECRET_KEY`

Keep it in `.env.local` only.

Do not commit or expose Trigger.dev credentials.

A normal application build must not require Trigger.dev to make a live request.

## Developer Tooling

Keep the Trigger.dev developer tooling already installed by the CLI:

- `.github/copilot-instructions.md`
- `.github/skills/trigger-authoring-tasks/`
- `.github/skills/trigger-getting-started/`
- `.vscode/mcp.json`

The VS Code Trigger MCP must remain restricted to the development environment.

Do not place credentials in MCP configuration.

Keep `.trigger` ignored by Git.

Keep `trigger.config.ts` included in TypeScript configuration.

## Live Smoke Test

Run the Trigger.dev local development worker using:

`npm run trigger:dev`

Confirm the `setup-smoke` task is registered.

From the Trigger.dev development dashboard, run it with a valid test payload.

Verify:

- the local worker receives the run
- the task executes successfully
- the run reaches `COMPLETED`
- the returned output matches the submitted message

This live run is required before the feature is complete.

## Out of Scope

Do not implement:

- OpenAI or `AiProvider` calls
- clarification chat
- itinerary generation
- planning-session mutations
- API routes for triggering tasks
- Prisma schema changes or migrations
- production or staging deployment
- production Trigger.dev secrets
- scheduled tasks
- Trigger realtime UI
- queues or concurrency policies
- AI-specific retry behaviour

## Check When Done

- Trigger.dev v4 packages are installed and aligned
- no `@trigger.dev/sdk/v3` imports remain
- `trigger.config.ts` uses the existing project and `node-22`
- tasks are discovered from `./trigger`
- development retries are disabled
- `npm run trigger:dev` starts the local Trigger.dev worker
- `setup-smoke` uses runtime-validated input with no `any`
- the live smoke task completes successfully in the dev environment
- `.trigger` remains ignored
- Trigger.dev credentials are not committed
- normal Next.js build does not require a live Trigger.dev run
- no AI, API route, or Prisma work was added
- `npm run lint` passes
- `npm run build` passes
- `git diff --check` passes
- `context/progress-tracker.md` is updated
- `11-clarification-chat.md` is listed as next