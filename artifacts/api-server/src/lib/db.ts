import mysql, { type Pool } from "mysql2/promise";

function sanitizeHost(raw: string | undefined): string {
  return (raw ?? "")
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "")
    .trim();
}

let pool: Pool | null = null;

export function getPool(): Pool {
  if (pool) return pool;

  const host = sanitizeHost(process.env.TIDB_HOST);
  const port = Number(process.env.TIDB_PORT ?? 4000);
  const user = process.env.TIDB_USER;
  const password = process.env.TIDB_PASSWORD;
  const database = process.env.TIDB_DATABASE;

  if (!host || !user || !database) {
    throw new Error(
      "Missing TiDB configuration: TIDB_HOST, TIDB_USER, TIDB_DATABASE are required.",
    );
  }

  pool = mysql.createPool({
    host,
    port,
    user,
    password,
    database,
    waitForConnections: true,
    connectionLimit: 8,
    enableKeepAlive: true,
    ssl: { minVersion: "TLSv1.2", rejectUnauthorized: true },
  });

  return pool;
}
