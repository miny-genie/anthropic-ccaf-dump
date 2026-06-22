---
name: TiDB connection quirks
description: How to connect to the project's TiDB (MySQL) cloud DB without hitting DNS/TLS failures
---

# TiDB connection

The project uses **TiDB Cloud (MySQL-compatible) via `mysql2`**, not the workspace-default Postgres/Drizzle. The exam question bank lives there.

## The `TIDB_HOST` trap
The `TIDB_HOST` secret is stored **with an `http://` prefix and a trailing slash** (e.g. `http://gateway01.<...>.tidbcloud.com/`). Passing it raw to a MySQL client throws `getaddrinfo ENOTFOUND http://...`. Always sanitize:

```
host.replace(/^https?:\/\//, "").replace(/\/+$/, "").trim()
```

**Why:** the value was pasted with a URL scheme; MySQL drivers expect a bare hostname.
**How to apply:** any new code (probe scripts, migrations, a second client) that reads `TIDB_HOST` must strip protocol + trailing slash first. `artifacts/api-server/src/lib/db.ts` already does this.

## TLS is required
Connect with `ssl: { minVersion: "TLSv1.2", rejectUnauthorized: true }` — system CA works, no cert file needed.

## Probing from the shell
`node` can't resolve `mysql2` from `/tmp`. Put the probe `.mjs` inside `artifacts/api-server/` (so it resolves workspace node_modules) and run it from there. There is **no `python3`** in this environment — parse JSON from curl with `node -e` instead.
