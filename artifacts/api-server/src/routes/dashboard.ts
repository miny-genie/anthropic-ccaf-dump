import { Router, type IRouter } from "express";
import type { RowDataPacket } from "mysql2";
import { GetDashboardResponse } from "@workspace/api-zod";
import { getPool } from "../lib/db";
import { requireAuth, type AuthedRequest } from "../lib/auth";

const router: IRouter = Router();

function attemptSummary(r: RowDataPacket) {
  const submittedAt = r.submitted_at
    ? new Date(r.submitted_at).toISOString()
    : null;
  const totalCount = Number(r.total_count);
  const correctCount = r.correct_count == null ? null : Number(r.correct_count);
  const percent =
    correctCount != null && totalCount > 0
      ? Math.round((correctCount / totalCount) * 1000) / 10
      : null;
  return {
    id: r.id as number,
    sourceId: r.source_id as number,
    isRealTest: Boolean(r.is_real_test),
    title: r.title as string,
    startedAt: new Date(r.started_at).toISOString(),
    submittedAt,
    scoreScaled: r.score_scaled == null ? null : Number(r.score_scaled),
    passed: r.passed == null ? null : Boolean(r.passed),
    correctCount,
    totalCount,
    percent,
  };
}

router.get("/dashboard", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const pool = getPool();

  const [userRows] = await pool.query<RowDataPacket[]>(
    "SELECT id, username, created_at FROM app_users WHERE id = ?",
    [userId],
  );
  const u = userRows[0];

  const [recent] = await pool.query<RowDataPacket[]>(
    `SELECT a.id, a.source_id, a.is_real_test, s.title, a.started_at,
            a.submitted_at, a.score_scaled, a.passed, a.correct_count, a.total_count
       FROM app_attempts a
       JOIN exam_sources s ON s.id = a.source_id
      WHERE a.user_id = ?
      ORDER BY a.started_at DESC
      LIMIT 5`,
    [userId],
  );

  const [mockRows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS attempts,
            AVG(correct_count / total_count) AS avg_ratio,
            MAX(correct_count / total_count) AS best_ratio
       FROM app_attempts
      WHERE user_id = ? AND is_real_test = 0 AND submitted_at IS NOT NULL
        AND total_count > 0`,
    [userId],
  );
  const m = mockRows[0];

  const [realRows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS attempts,
            SUM(CASE WHEN passed = 1 THEN 1 ELSE 0 END) AS passes,
            MAX(score_scaled) AS best_scaled
       FROM app_attempts
      WHERE user_id = ? AND is_real_test = 1 AND submitted_at IS NOT NULL`,
    [userId],
  );
  const rt = realRows[0];

  const [waRows] = await pool.query<RowDataPacket[]>(
    "SELECT COUNT(*) AS c FROM app_wrong_answers WHERE user_id = ? AND resolved_at IS NULL",
    [userId],
  );
  const [bmRows] = await pool.query<RowDataPacket[]>(
    "SELECT COUNT(*) AS c FROM app_bookmarks WHERE user_id = ?",
    [userId],
  );

  const data = {
    user: {
      id: u.id as number,
      username: u.username as string,
      createdAt: new Date(u.created_at).toISOString(),
    },
    recentAttempts: recent.map(attemptSummary),
    mockupStats: {
      attempts: Number(m.attempts),
      avgPercent: m.avg_ratio == null ? 0 : Math.round(Number(m.avg_ratio) * 1000) / 10,
      bestPercent: m.best_ratio == null ? 0 : Math.round(Number(m.best_ratio) * 1000) / 10,
    },
    realTestStat: {
      attempts: Number(rt.attempts),
      passes: Number(rt.passes ?? 0),
      bestScaled: rt.best_scaled == null ? 0 : Number(rt.best_scaled),
    },
    wrongAnswerCount: Number(waRows[0].c),
    bookmarkCount: Number(bmRows[0].c),
  };

  res.json(GetDashboardResponse.parse(data));
});

export default router;
