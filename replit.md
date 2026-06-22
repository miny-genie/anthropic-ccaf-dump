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

- **Two table families in one TiDB database.** Existing read-only question bank (`exam_sources`, `exam_questions`, `exam_options`) is never written to. New app tables are prefixed `app_` (`app_users`, `app_attempts`, `app_attempt_questions`, `app_wrong_answers`, `app_bookmarks`, `app_notes`) and auto-created on server boot. `initDb.ts` runs idempotent migrations (`columnExists`/`indexExists`) for added columns (`app_attempt_questions.option_order`, `app_attempts.current_position`) and the `app_notes` table.
- **Randomized, persisted order in both modes.** On attempt start, question order is shuffled and each question's option labels are shuffled and stored in `app_attempt_questions.option_order`. Detail responses reorder options by that stored order, so a refresh always shows the same layout. Scoring and answer validation compare option **labels**, never positions.
- **Single persistent practice attempt per user.** Practice runs against one source (`claude_cert_mock_exam_html`, resolved via `getPracticeSourceId()` by `source_key`). `POST /attempts/practice` is get-or-create (`findActivePracticeAttempt` → reuse the unsubmitted practice attempt, else `createAttempt`); `POST /attempts/practice/reset` deletes the user's practice attempts and creates a fresh one. Both routes are registered **before** `/attempts/:id` so the literal paths aren't swallowed by the param route. Practice attempts are never submitted. The answer handler reconciles the wrong-answer notebook live: clearing (null) or a correct answer DELETEs the notebook row, a wrong answer upserts it, and a flag-only update (selectedOption undefined) leaves it untouched.
- **Dashboard practice card shows live progress, not submitted-mock stats.** Since practice never submits, `practiceProgress` (`answered`/`total`/`percentComplete`) is derived from the active practice attempt's `app_attempt_questions` (count of non-null `selected_option` over total). Replaces the old `mockupStats` shape.
- **Per-question notes live in `app_notes`** (one row per `user_id`+`question_id`, shared across attempts), separate from `app_wrong_answers` (which only tracks `resolved` state, keyed by `user_id`+`question_id`+`is_real_test`). Bookmarks live in `app_bookmarks`.
- **Server-side scoring only.** Scaled score = round(correct/total × 1000), pass ≥ 720. Real-test mode hides correctness until submit; practice mode returns + persists per-answer feedback (`isCorrect`/`correctOption` appear in question detail only when not a real test and the question is answered).
- **Timer is server-authoritative; practice is untimed.** For real tests `remainingSeconds` is derived from `started_at + time_limit_seconds` (7200s) and expired attempts auto-submit. Practice attempts store `time_limit_seconds = 0`; `remainingSeconds` is `null`, `isExpired` is always false, and there is no auto-submit.
- **Resumable position.** `app_attempts.current_position` (1-based) is persisted via `PATCH /attempts/:id/progress` and returned as `currentPosition` so the frontend reopens the attempt on the last viewed question.
- **Simple username auth** — no password. Signed httpOnly cookie holds the user id; every query is scoped by `user_id`.

## Product

- Username login (no password); all progress is tied to the user.
- Real Test mode: strict 2-hour timer, no per-question feedback; the scenario shows as a subtle right-aligned "Scenario : {…}" line under the question (no large heading). Scaled score out of 1000 with pass/fail and scenario breakdown.
- Practice mode: one persistent attempt per user against the single practice source (`claude_cert_mock_exam_html`) — no source picker; the Practice button goes straight into questions. Untimed and never submitted. Each answer immediately reveals correct/wrong and the correct option, and that feedback persists across refresh/logout. Answers are not locked: re-clicking the selected option clears it (hiding feedback), and you can change answers freely. "Reset Practice" (confirm dialog) reshuffles into a brand-new attempt; nothing else ever resets the attempt. Every question supports a bookmark toggle and a personal note.
- Both modes randomize question order and option order per attempt; the order is stored so a refresh preserves it. Current position is saved so an attempt resumes where it was left off.
- Wrong-answer notebook: auto-populated (practice misses on answer, real-test misses on submit), filter by real/mock and scenario, edit per-question notes, mark resolved, and re-review unresolved questions.
- Bookmarks, attempt history, and a dashboard summarizing stats.

## User preferences

- Visual design follows the Anthropic/Claude warm editorial system (cream canvas `#faf9f5`, coral `#cc785c`, dark ink, serif display + sans body). No emojis in the UI.

## Gotchas

- **`TIDB_HOST` is stored with an `http://` prefix and trailing slash** — `db.ts` sanitizes it. Don't pass the raw env value to other MySQL clients without stripping protocol/slashes.
- TiDB requires TLS: `ssl: { minVersion: "TLSv1.2", rejectUnauthorized: true }` (system CA, no cert file).
- Do NOT reseed or modify the `exam_*` tables — they are the user's existing question data.
- Orval generates a response Zod schema only for the 200 response; the `startAttempt` 201 reuses `GetAttemptResponse` for validation.
- **Orval emits `z.coerce.boolean()` for boolean query params, which is a footgun:** `z.coerce.boolean()` does JS truthiness, so the string `"false"` coerces to `true`. The wrong-answer notebook's `isRealTest=false` filter silently matched nothing until `normalizeBoolQuery()` (in `routes/wrongAnswers.ts`) parsed the raw query string itself. Don't trust coerced booleans from query strings — parse `"true"`/`"false"` explicitly.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
