# 04 — Prisma Foundation

Read `AGENTS.md` before starting.

## Goal

Set up the Prisma and PostgreSQL foundation for Potato Trips.

This unit adds database configuration, a reusable Prisma client, and the migration workflow. Do not add application data models yet; `PlanningSession` belongs to `05-planning-session-model.md`.

## Existing Setup

Prisma is already installed and initialized. A Prisma Postgres database exists, and `.env` contains the standard `postgres://` `DATABASE_URL`.

Do not create another database or replace the existing connection.

## Prisma Configuration

Configure the existing Prisma files for PostgreSQL:

- use the `prisma-client` generator
- generate the client to `app/generated/prisma`
- keep the datasource URL in `prisma.config.ts`
- load `DATABASE_URL` from the environment
- keep `prisma/schema.prisma` free of models and enums

Do not use Prisma Accelerate or `prisma+postgres://` in this project setup.

## Prisma Client

Create `lib/prisma.ts` as the shared server-side database client.

Requirements:

- use `@prisma/adapter-pg`
- import `PrismaClient` from the generated client
- export one named `prisma` instance
- cache the instance on `globalThis` during development
- fail clearly when `DATABASE_URL` is missing
- do not place queries or domain logic in this file

## Workflow

Add minimal npm scripts for:

- generating Prisma Client
- creating development migrations
- applying production migrations
- opening Prisma Studio

Generate Prisma Client and verify the database connection with a read-only query.

Do not create a migration in this unit because no models are being introduced.

## Out of Scope

- Prisma models or enums
- `PlanningSession`
- saved trips or user records
- repositories or application queries
- seed data
- route handlers
- UI changes

## Check When Done

- Prisma configuration validates
- Prisma Client generates successfully
- `lib/prisma.ts` exports one cached Prisma instance
- the read-only database connection check succeeds
- no models or migrations were created
- no database credentials are committed or logged
- `npm run lint` passes
- `npm run build` passes
- `context/progress-tracker.md` is updated
- `05-planning-session-model.md` is listed as next