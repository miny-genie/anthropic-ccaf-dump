import { Router, type IRouter } from "express";
import type { RowDataPacket } from "mysql2";
import { ListSourcesResponse } from "@workspace/api-zod";
import { getPool } from "../lib/db";
import { displaySourceTitle } from "../lib/examData";

const router: IRouter = Router();

router.get("/sources", async (_req, res) => {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT s.id, s.source_key, s.is_real_test, s.title,
            COUNT(q.id) AS question_count
       FROM exam_sources s
       LEFT JOIN exam_questions q ON q.source_id = s.id
      GROUP BY s.id, s.source_key, s.is_real_test, s.title
      ORDER BY s.is_real_test DESC, s.id ASC`,
  );
  const data = rows.map((r) => ({
    id: r.id as number,
    sourceKey: r.source_key as string,
    isRealTest: Boolean(r.is_real_test),
    title: displaySourceTitle(Boolean(r.is_real_test)),
    questionCount: Number(r.question_count),
  }));
  res.json(ListSourcesResponse.parse(data));
});

export default router;
