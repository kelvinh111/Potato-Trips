# 09 — AI Provider Foundation

Read `AGENTS.md` before starting.

Create and switch to a new Git branch before making changes:

`feature/09-ai-provider-foundation`

Do not implement this feature directly on `main`.

## Goal

Add the server-side AI provider foundation used by later clarification, itinerary generation, and refinement features.

Application code must depend on a Potato Trips-owned provider interface rather than directly on OpenAI-specific APIs.

This unit does not add an AI API route or any user-facing AI behaviour.

## AI SDK and Provider

Install:

- `ai`
- `@ai-sdk/openai`

Use OpenAI as the first provider.

Use `gpt-5.6-terra` as the initial model, configured through:

`AI_MODEL`

Use:

`OPENAI_API_KEY`

for the provider credential.

Do not hardcode the API key or model throughout application code.

Do not add an `AI_PROVIDER` selector yet.

## Provider Boundary

Create the AI foundation under:

`lib/ai/`

Keep provider-specific implementation isolated from provider-neutral application code.

Add an application-owned `AiProvider` interface supporting structured generation.

The provider input must support:

- system instructions
- messages or prompt content
- a Zod output schema

The provider result must expose:

- validated structured output
- model identifier
- normalized token usage

Token usage should include available input, output, and total token counts without exposing provider-specific response objects.

## OpenAI Adapter

Implement the first `AiProvider` adapter using the Vercel AI SDK and `@ai-sdk/openai`.

The OpenAI adapter must:

- use the configured model
- generate structured output validated against the supplied Zod schema
- normalize usage metadata into the application-owned result shape
- keep OpenAI-specific types and behaviour inside the adapter

Do not expose raw OpenAI or AI SDK response objects to domain callers.

## Configuration and Errors

Keep all provider configuration server-side.

Do not require an API key merely to import modules or run a normal application build.

Missing or invalid runtime configuration must fail with an application-owned AI error.

Add a small provider-neutral error boundary such as `AiProviderError`.

At minimum distinguish:

- configuration failure
- provider/request failure
- invalid structured output

Do not expose provider secrets or raw third-party errors.

## Server Boundary

AI provider code must remain server-only and must not be imported into client components.

Do not expose `OPENAI_API_KEY` through public environment variables.

## Live Smoke Test

Perform one real OpenAI structured-output smoke test using the application-owned provider interface.

Use a minimal prompt and small Zod schema so the test consumes very few tokens.

The smoke test must verify the complete path:

AI configuration → `AiProvider` → OpenAI adapter → live model request → Zod-validated structured output → normalized usage result.

Use the locally configured `OPENAI_API_KEY`.

Do not commit credentials.

Temporary smoke-test code may be removed after verification unless it is useful as a small developer-only script.

## Out of Scope

Do not implement:

- AI API or chat routes
- clarification questions
- itinerary generation
- itinerary refinement
- Trigger.dev
- streaming chat UI
- planning-session mutations
- usage persistence or `UsageEvent`
- Prisma schema changes or migrations
- provider switching UI or runtime provider selection

## Check When Done

- `ai` and `@ai-sdk/openai` are installed
- application code has a provider-neutral `AiProvider` interface
- OpenAI implementation is isolated behind that interface
- model selection uses `AI_MODEL`
- credentials use `OPENAI_API_KEY`
- structured output is validated with Zod
- provider result includes normalized model and token-usage metadata
- provider failures use application-owned errors
- provider secrets remain server-only
- normal build does not require a live AI request
- live structured-output smoke test succeeds through `AiProvider`
- no AI API route was added
- Trigger.dev was not added
- no Prisma schema or migration changes were made
- `npm run lint` passes
- `npm run build` passes
- `context/progress-tracker.md` is updated
- `10-trigger-setup.md` is listed as next