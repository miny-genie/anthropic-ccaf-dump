# Hosting

This app can run without Replit as a single Node service.

- `/api/*` is handled by the Express API.
- All other browser routes are served from the Vite React build.
- Keep the API and web app on the same domain so the httpOnly session cookie works normally.

## Required environment

Use Node.js 24 and pnpm.

Required runtime variables:

```sh
NODE_ENV=production
PORT=8080
BASE_PATH=/
CLIENT_DIST_DIR=artifacts/exam-practice/dist/public
SESSION_SECRET=replace-with-a-long-random-string
TIDB_HOST=replace-with-tidb-host
TIDB_PORT=4000
TIDB_USER=replace-with-tidb-user
TIDB_PASSWORD=replace-with-tidb-password
TIDB_DATABASE=replace-with-tidb-database
TIDB_CA_PATH=certs/isrgrootx1.pem
```

`CLIENT_DIST_DIR` and `TIDB_CA_PATH` may be absolute or relative to the project root.

## Build and run directly

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm run build:host
pnpm run start:host
```

The host or process manager must provide the runtime environment variables above.

## Build and run with Docker

```sh
docker build -t quiz-exam-builder .
docker run --env-file .env.hosting -p 8080:8080 quiz-exam-builder
```

Copy `.env.hosting.example` to `.env.hosting` on the server and fill in real secrets there. Do not commit the real file.

Or use Docker Compose:

```sh
docker compose up -d --build
```

## Reverse proxy

Point your domain to the Node service. For example:

```text
https://example.com/      -> http://127.0.0.1:8080/
https://example.com/api/* -> http://127.0.0.1:8080/api/*
```

The Node service already serves both the API and the React app, so the proxy does not need separate frontend/API routing.
