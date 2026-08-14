import { Router, type IRouter } from "express";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import {
  ToggleBookmarkBody,
  ToggleBookmarkResponse,
  ListBookmarksResponse,
} from "@workspace/api-zod";
import { getPool } from "../lib/db";
import { requireAuth, type AuthedRequest } from "../lib/auth";
import { normalizeLocale } from "../lib/locale";

const router: IRouter = Router();

router.get("/bookmarks", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const locale = normalizeLocale(req.query.locale);
  const pool = getPool();
  const translationLocale = locale === "ko" ? "ko" : null;
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT b.id, b.question_id, b.created_at,
            COALESCE(qt.scenario, q.scenario) AS scenario,
            COALESCE(qt.question_text, q.question_text) AS question_text,
            s.is_real_test
       FROM app_bookmarks b
       JOIN exam_questions q ON q.id = b.question_id
       JOIN exam_sources s ON s.id = q.source_id
       LEFT JOIN exam_question_translations qt
         ON qt.question_id = q.id AND qt.locale = ?
      WHERE b.user_id = ?
      ORDER BY b.created_at DESC`,
    [translationLocale, userId],
  );
  const data = rows.map((r) => ({
    id: r.id as number,
    questionId: r.question_id as number,
    scenario: (r.scenario as string | null) ?? null,
    questionText: r.question_text as string,
    isRealTest: Boolean(r.is_real_test),
    createdAt: new Date(r.created_at).toISOString(),
  }));
  res.json(ListBookmarksResponse.parse(data));
});

router.post("/bookmarks", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const body = ToggleBookmarkBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }
  const { questionId } = body.data;
  const pool = getPool();

  const [existing] = await pool.query<RowDataPacket[]>(
    "SELECT id FROM app_bookmarks WHERE user_id = ? AND question_id = ?",
    [userId, questionId],
  );

  if (existing.length > 0) {
    await pool.query<ResultSetHeader>(
      "DELETE FROM app_bookmarks WHERE user_id = ? AND question_id = ?",
      [userId, questionId],
    );
    res.json(ToggleBookmarkResponse.parse({ bookmarked: false }));
    return;
  }

  await pool.query<ResultSetHeader>(
    "INSERT INTO app_bookmarks (user_id, question_id) VALUES (?, ?)",
    [userId, questionId],
  );
  res.json(ToggleBookmarkResponse.parse({ bookmarked: true }));
});

export default router;
