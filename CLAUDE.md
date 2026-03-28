# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run dev          # Run with nodemon + ts-node (hot reload)
npm start            # Run with ts-node

# Build
npm run build        # Compile TypeScript
npm run build:watch  # Compile with watch mode

# Testing
npm test             # Run all tests (Vitest)
npx vitest run path/to/test.ts  # Run a single test file

# Code quality
npm run lint         # ESLint
npm run format       # Prettier (3-space indent, single quotes)

# Database (Sequelize CLI)
npm run migrate          # Run pending migrations
npm run migrate:undo     # Rollback last migration
npm run migrate:status   # Show migration status
npm run migrate:create -- --name my-migration  # Create new migration
npm run seed             # Run all seeders
npm run seed:undo        # Undo all seeders

# Background workers
npm run worker:notification   # Notification worker
npm run worker:scheduled      # Scheduled jobs worker
npm run worker:recurring      # Recurring jobs worker
npm run worker:all            # All workers
```

## Architecture

### Overview

Multi-domain backend serving 4 stores (`StoreSlug` enum in `src/types.ts`): `nutrition`, `kids`, `halal`, `restaurant`. Single Express 5 app with a layered architecture per module.

All routes are registered under `/api/v1/` in `src/routers.ts`. Three separate Swagger UIs: `/api-docs` (e-commerce), `/api-docs-restaurants` (restaurant), `/api-docs-nutrition` (nutrition/foodtech).

### Module Structure

Each of the 10 feature modules follows this strict layered pattern:

```
src/<module>/
├── controller/    # HTTP handlers — parse request, call service, return apiResponse
├── service/       # Business logic — orchestrates repositories
├── repository/    # Data access — all Sequelize queries live here
├── model/         # Sequelize model definitions
├── dto/           # Zod schemas for request validation
└── <module>Router.ts
```

Modules: `admin`, `blog`, `cart`, `category`, `nutrition`, `order`, `payment`, `product`, `restaurant`, `site`.

The `nutrition` and `restaurant` modules also have a `jobs/` subdirectory for BullMQ workers.

### Shared Layer (`shared/`)

- `config/database.ts` — Sequelize with read replica support
- `config/redis.ts` — Redis connection
- `middleware/auth.ts` — JWT auth + permission-based authorization
- `middleware/storeContext.ts` — Injects current store into request
- `middleware/upload.ts` — Multer + Sharp image processing
- `models/Associations.ts` — **All** Sequelize associations defined centrally here
- `utils/apiResponse.ts` — Standardized success/error response format (use this everywhere)
- `utils/errors.ts` — Custom error classes thrown from services
- `utils/withDeadlockRetry.ts` — Wraps DB writes that may deadlock

### Database

PostgreSQL via Sequelize 6. Migrations and seeders live in `sequelize/`. Model classes live both in `sequelize/models/` (Sequelize CLI) and in `src/<module>/model/` (application code). All associations are centralized in `shared/models/Associations.ts`.

The `sequelize/config.js` reads from `.env`; the app itself uses `shared/config/database.ts`.

### Background Jobs

BullMQ on Redis. Workers are separate entry points (`npm run worker:*`). Job definitions and processors live inside the relevant module's `jobs/` directory.

### Key Patterns

- **Request validation:** Zod DTOs in `dto/`, errors formatted via `shared/utils/zodErrors.ts`
- **Auth:** JWT access + refresh tokens. Admin routes use `authenticate` middleware + permission checks defined in `src/admin/dto/permissionDto.ts`
- **Error flow:** Services throw custom errors from `shared/utils/errors.ts`; `shared/middleware/errorHandler.ts` catches them globally; controllers use `controllerErrorHandler.ts` wrapper
- **Logging:** Pino with request IDs, shipped to Loki. Use `shared/utils/logger.ts`, not `console.log`
- **Multi-tenancy:** Store context injected per-request; repositories filter by store slug where applicable
- **Prettier config:** 3-space indent, single quotes, trailing commas (see `.prettierrc.js`)
