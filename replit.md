# Exam Practice

A study app for the Claude Certified Architect exam: timed real-test simulation, repeatable mock practice with instant feedback, and a personal wrong-answer notebook — all backed by the user's existing TiDB question bank.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server
- `pnpm --filter @workspace/exam-practice run dev` — run the web frontend
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- Required env (TiDB): `TIDB_HOST`, `TIDB_PORT`, `TIDB_USER`, `TIDB_PASSWORD`, `TIDB_DATABASE`, plus `SESSION_SECRET` (mandatory — server refuses to boot without it)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: **TiDB (MySQL-compatible) via `mysql2`** — NOT the workspace-default Postgres/Drizzle
- Validation: Zod, generated from OpenAPI via Orval
- Frontend: React + Vite + wouter + TanStack Query, generated API hooks from `@workspace/api-client-react`

## Where things live

- API contract: `lib/api-spec/openapi.yaml` (run codegen after edits)
- TiDB connection: `artifacts/api-server/src/lib/db.ts`
- App-table creation (runs on startup): `artifacts/api-server/src/lib/initDb.ts`
- Cookie session auth: `artifacts/api-server/src/lib/auth.ts`
- Scoring / timer / wrong-answer persistence: `artifacts/api-server/src/lib/attempts.ts`
- Reading the existing question bank: `artifacts/api-server/src/lib/examData.ts`
- Routes: `artifacts/api-server/src/routes/` (auth, sources, dashboard, attempts, bookmarks, wrongAnswers)
- Frontend theme tokens: `artifacts/exam-practice/src/index.css`; pages in `artifacts/exam-practice/src/pages/`

## Architecture decisions

- **Two table families in one TiDB database.** Existing read-only question bank (`exam_sources`, `exam_questions`, `exam_options`) is never written to. New app tables are prefixed `app_` (`app_users`, `app_attempts`, `app_attempt_questions`, `app_wrong_answers`, `app_bookmarks`) and auto-created on server boot.
- **Server-side scoring only.** Scaled score = round(correct/total × 1000), pass ≥ 720. Real-test mode hides correctness until submit; mock mode returns per-answer feedback.
- **Timer is server-authoritative.** `remainingSeconds` is derived from `started_at + time_limit_seconds`; expired attempts auto-submit, and answers/results are gated by expiry & submission state.
- **Simple username auth** — no password. Signed httpOnly cookie holds the user id; every query is scoped by `user_id`.

## Product

- Username login (no password); all progress is tied to the user.
- Real Test mode: strict 2-hour timer, no per-question feedback, scaled score out of 1000 with pass/fail and scenario breakdown.
- Mockup Practice mode: repeatable, optional timer, immediate correct/wrong feedback.
- Wrong-answer notebook: auto-populated on submit, filter by real/mock and scenario, add notes, mark resolved, and re-review unresolved questions.
- Bookmarks, attempt history, and a dashboard summarizing stats.

## User preferences

- Visual design follows the Anthropic/Claude warm editorial system (cream canvas `#faf9f5`, coral `#cc785c`, dark ink, serif display + sans body). No emojis in the UI.

## Gotchas

- **`TIDB_HOST` is stored with an `http://` prefix and trailing slash** — `db.ts` sanitizes it. Don't pass the raw env value to other MySQL clients without stripping protocol/slashes.
- TiDB requires TLS: `ssl: { minVersion: "TLSv1.2", rejectUnauthorized: true }` (system CA, no cert file).
- Do NOT reseed or modify the `exam_*` tables — they are the user's existing question data.
- Orval generates a response Zod schema only for the 200 response; the `startAttempt` 201 reuses `GetAttemptResponse` for validation.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
