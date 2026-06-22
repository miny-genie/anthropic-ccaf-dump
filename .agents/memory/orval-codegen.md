---
name: Orval codegen ordering
description: How OpenAPI operations map to generated Zod/React-Query names, and why the spec must lead the route code.
---

# Orval codegen in this repo

- Generated Zod schema names are `PascalCase(operationId)` + suffix: `Body` (request body), `Params` (path params), `QueryParams`, `Response`. Example: `operationId: setNote` → `SetNoteBody`, `SetNoteResponse`; `updateAttemptProgress` → `UpdateAttemptProgressParams`, `UpdateAttemptProgressBody`, `UpdateAttemptProgressResponse`.
- React Query hooks are `use` + `PascalCase(operationId)` (e.g. `useSetNote`, `useUpdateAttemptProgress`, `useToggleBookmark`); query-key helpers are `getXxxQueryKey`.

**Rule:** define the OpenAPI path + operation (with `operationId`) **before** writing server/client code that imports its generated types. Server routes import the `*Body`/`*Response` Zod schemas for validation; if the operation is missing from `openapi.yaml`, `pnpm --filter @workspace/api-spec run codegen` won't emit those names and the next typecheck fails.

**Why:** the contract is the source of truth; route + frontend code is generated-name-coupled to it. Editing routes first then forgetting the spec produces confusing "missing export" errors that look like bad imports but are really a stale/absent codegen output.

**How to apply:** when adding an endpoint — (1) add the path/schemas to `lib/api-spec/openapi.yaml`, (2) run codegen, (3) then wire server route + frontend hook. `info.title` controls generated filenames — don't change it.
