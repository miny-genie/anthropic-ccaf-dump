import { Router, type IRouter } from "express";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import {
  ListWrongAnswersQueryParams,
  GetWrongAnswerReviewQueryParams,
  UpdateWrongAnswerParams,
  UpdateWrongAnswerBody,
  ListWrongAnswersResponse,
  ListWrongAnswerScenariosResponse,
  GetWrongAnswerReviewResponse,
  UpdateWrongAnswerResponse,
} from "@workspace/api-zod";
import { getPool } from "../lib/db";
import { requireAuth, type AuthedRequest } from "../lib/auth";
import { getQuestionsByIds } from "../lib/examData";
import { setNote } from "../lib/notes";

const router: IRouter = Router();

// The generated query schemas validate booleans with `z.coerce.boolean()`,
// which treats any non-empty string as `true` (so the string "false" wrongly
// becomes `true`). Normalize the known boolean query params from their string
// form to real booleans before validation so filters like `isRealTest=false`
// behave correctly.
function normalizeBoolQuery(
  query: Record<string, unknown>,
  keys: string[],
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...query };
  for (const k of keys) {
    if (out[k] === "true") out[k] = true;
    else if (out[k] === "false") out[k] = false;
  }
  return out;
}

interface WaRow extends RowDataPacket {
  id: number;
  question_id: number;
  is_real_test: number;
  selected_option: string | null;
  correct_option: string;
  note: string | null;
  resolved_at: Date | null;
  created_at: Date;
}

async function buildWrongAnswers(rows: WaRow[]) {
  const ids = rows.map((r) => r.question_id);
  const questionMap = await getQuestionsByIds(ids);
  return rows.map((r) => {
    const q = questionMap.get(r.question_id);
    return {
      id: r.id,
      questionId: r.question_id,
      isRealTest: Boolean(r.is_real_test),
      scenario: q?.scenario ?? null,
      questionText: q?.questionText ?? "",
      options: q?.options ?? [],
      selectedOption: r.selected_option ?? null,
      correctOption: r.correct_option,
      note: r.note ?? null,
      resolvedAt: r.resolved_at ? new Date(r.resolved_at).toISOString() : null,
      createdAt: new Date(r.created_at).toISOString(),
    };
  });
}

router.get("/wrong-answers", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const params = ListWrongAnswersQueryParams.safeParse(
    normalizeBoolQuery(req.query as Record<string, unknown>, [
      "isRealTest",
      "resolved",
    ]),
  );
  if (!params.success) {
    res.status(400).json({ error: "Invalid query" });
    return;
  }
  const { isRealTest, scenario, resolved } = params.data;
  const pool = getPool();

  const where: string[] = ["wa.user_id = ?"];
  const args: unknown[] = [userId];
  if (isRealTest !== undefined) {
    where.push("wa.is_real_test = ?");
    args.push(isRealTest ? 1 : 0);
  }
  if (resolved !== undefined) {
    where.push(resolved ? "wa.resolved_at IS NOT NULL" : "wa.resolved_at IS NULL");
  }
  if (scenario !== undefined && scenario !== "") {
    where.push("q.scenario = ?");
    args.push(scenario);
  }

  const [rows] = await pool.query<WaRow[]>(
    `SELECT wa.id, wa.question_id, wa.is_real_test, wa.selected_option,
            wa.correct_option, n.note AS note, wa.resolved_at, wa.created_at
       FROM app_wrong_answers wa
       JOIN exam_questions q ON q.id = wa.question_id
       LEFT JOIN app_notes n
         ON n.user_id = wa.user_id AND n.question_id = wa.question_id
      WHERE ${where.join(" AND ")}
      ORDER BY wa.created_at DESC`,
    args,
  );

  res.json(ListWrongAnswersResponse.parse(await buildWrongAnswers(rows)));
});

router.get("/wrong-answers/scenarios", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT DISTINCT q.scenario
       FROM app_wrong_answers wa
       JOIN exam_questions q ON q.id = wa.question_id
      WHERE wa.user_id = ? AND q.scenario IS NOT NULL AND q.scenario <> ''
      ORDER BY q.scenario ASC`,
    [userId],
  );
  const data = rows.map((r) => r.scenario as string);
  res.json(ListWrongAnswerScenariosResponse.parse(data));
});

router.get("/wrong-answers/review", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const params = GetWrongAnswerReviewQueryParams.safeParse(
    normalizeBoolQuery(req.query as Record<string, unknown>, ["isRealTest"]),
  );
  if (!params.success) {
    res.status(400).json({ error: "Invalid query" });
    return;
  }
  const { isRealTest, scenario } = params.data;
  const pool = getPool();

  const where: string[] = ["wa.user_id = ?", "wa.resolved_at IS NULL"];
  const args: unknown[] = [userId];
  if (isRealTest !== undefined) {
    where.push("wa.is_real_test = ?");
    args.push(isRealTest ? 1 : 0);
  }
  if (scenario !== undefined && scenario !== "") {
    where.push("q.scenario = ?");
    args.push(scenario);
  }

  const [rows] = await pool.query<WaRow[]>(
    `SELECT wa.id, wa.question_id, wa.is_real_test, wa.selected_option,
            wa.correct_option, n.note AS note
       FROM app_wrong_answers wa
       JOIN exam_questions q ON q.id = wa.question_id
       LEFT JOIN app_notes n
         ON n.user_id = wa.user_id AND n.question_id = wa.question_id
      WHERE ${where.join(" AND ")}
      ORDER BY wa.created_at DESC`,
    args,
  );

  const ids = rows.map((r) => r.question_id);
  const questionMap = await getQuestionsByIds(ids);
  const data = rows.map((r) => {
    const q = questionMap.get(r.question_id);
    return {
      wrongAnswerId: r.id,
      questionId: r.question_id,
      isRealTest: Boolean(r.is_real_test),
      scenario: q?.scenario ?? null,
      questionText: q?.questionText ?? "",
      options: q?.options ?? [],
      correctOption: r.correct_option,
      previousSelected: r.selected_option ?? null,
      note: r.note ?? null,
    };
  });
  res.json(GetWrongAnswerReviewResponse.parse(data));
});

router.patch("/wrong-answers/:id", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const params = UpdateWrongAnswerParams.safeParse(req.params);
  const body = UpdateWrongAnswerBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }
  const pool = getPool();

  const [ownRows] = await pool.query<WaRow[]>(
    "SELECT id, question_id FROM app_wrong_answers WHERE id = ? AND user_id = ?",
    [params.data.id, userId],
  );
  if (ownRows.length === 0) {
    res.status(404).json({ error: "Wrong answer not found" });
    return;
  }
  const questionId = ownRows[0].question_id;

  if (body.data.resolved !== undefined && body.data.resolved !== null) {
    await pool.query<ResultSetHeader>(
      "UPDATE app_wrong_answers SET resolved_at = ? WHERE id = ? AND user_id = ?",
      [body.data.resolved ? new Date() : null, params.data.id, userId],
    );
  }
  if (body.data.note !== undefined) {
    await setNote(userId, questionId, body.data.note ?? null);
  }

  const [rows] = await pool.query<WaRow[]>(
    `SELECT wa.id, wa.question_id, wa.is_real_test, wa.selected_option,
            wa.correct_option, n.note AS note, wa.resolved_at, wa.created_at
       FROM app_wrong_answers wa
       LEFT JOIN app_notes n
         ON n.user_id = wa.user_id AND n.question_id = wa.question_id
      WHERE wa.id = ? AND wa.user_id = ?`,
    [params.data.id, userId],
  );
  if (rows.length === 0) {
    res.status(404).json({ error: "Wrong answer not found" });
    return;
  }
  const [built] = await buildWrongAnswers(rows);
  res.json(UpdateWrongAnswerResponse.parse(built));
});

export default router;
