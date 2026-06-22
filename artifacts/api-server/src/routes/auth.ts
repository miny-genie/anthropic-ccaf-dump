import { Router, type IRouter } from "express";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { LoginBody, LoginResponse, GetCurrentUserResponse } from "@workspace/api-zod";
import { getPool } from "../lib/db";
import { setSession, clearSession, getUserId } from "../lib/auth";

const router: IRouter = Router();

function toUser(row: RowDataPacket) {
  return {
    id: row.id as number,
    username: row.username as string,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

router.post("/auth/login", async (req, res) => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid username" });
    return;
  }
  const username = parsed.data.username.trim();
  if (!username) {
    res.status(400).json({ error: "Username is required" });
    return;
  }

  const pool = getPool();
  const [existing] = await pool.query<RowDataPacket[]>(
    "SELECT id, username, created_at FROM app_users WHERE username = ?",
    [username],
  );

  let row: RowDataPacket;
  if (existing.length > 0) {
    row = existing[0];
  } else {
    const [result] = await pool.query<ResultSetHeader>(
      "INSERT INTO app_users (username) VALUES (?)",
      [username],
    );
    const [created] = await pool.query<RowDataPacket[]>(
      "SELECT id, username, created_at FROM app_users WHERE id = ?",
      [result.insertId],
    );
    row = created[0];
  }

  setSession(res, row.id as number);
  res.json(LoginResponse.parse(toUser(row)));
});

router.post("/auth/logout", (_req, res) => {
  clearSession(res);
  res.json({ ok: true });
});

router.get("/auth/me", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id, username, created_at FROM app_users WHERE id = ?",
    [userId],
  );
  if (rows.length === 0) {
    clearSession(res);
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  res.json(GetCurrentUserResponse.parse(toUser(rows[0])));
});

export default router;
