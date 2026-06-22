import { Router, type IRouter } from "express";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import {
  StartAttemptBody,
  GetAttemptParams,
  SaveAnswerParams,
  SaveAnswerBody,
  SubmitAttemptParams,
  GetAttemptResultParams,
  ListAttemptsResponse,
  GetAttemptResponse,
  SaveAnswerResponse,
  SubmitAttemptResponse,
  GetAttemptResultResponse,
} from "@workspace/api-zod";
import { getPool } from "../lib/db";
import { requireAuth, type AuthedRequest } from "../lib/auth";
import { getQuestionsForSource, getQuestionsByIds } from "../lib/examData";
import {
  loadAttempt,
  loadSavedAnswers,
  getAttemptQuestionOrder,
  remainingSeconds,
  isExpired,
  computeScore,
  persistScore,
  REAL_TEST_TIME_LIMIT,
  MOCKUP_DEFAULT_TIME_LIMIT,
  type AttemptRow,
  type ScoredResult,
} from "../lib/attempts";

const router: IRouter = Router();

async function buildAttemptDetail(attempt: AttemptRow) {
  const order = await getAttemptQuestionOrder(attempt.id);
  const answers = await loadSavedAnswers(attempt.id);
  const questionMap = await getQuestionsByIds(order);
  const isReal = Boolean(attempt.is_real_test);

  const questions = order
    .map((id, idx) => {
      const q = questionMap.get(id);
      if (!q) return null;
      const saved = answers.get(id);
      return {
        id: q.id,
        questionNo: idx + 1,
        scenario: q.scenario,
        questionText: q.questionText,
        options: q.options,
        selectedOption: saved?.selected_option ?? null,
        flagged: Boolean(saved?.flagged),
      };
    })
    .filter((q): q is NonNullable<typeof q> => Boolean(q));

  const [srcRows] = await getPool().query<RowDataPacket[]>(
    "SELECT title FROM exam_sources WHERE id = ?",
    [attempt.source_id],
  );
  const title = (srcRows[0]?.title as string) ?? "Exam";

  return {
    id: attempt.id,
    sourceId: attempt.source_id,
    isRealTest: isReal,
    title,
    startedAt: new Date(attempt.started_at).toISOString(),
    submittedAt: attempt.submitted_at
      ? new Date(attempt.submitted_at).toISOString()
      : null,
    timeLimitSeconds: attempt.time_limit_seconds,
    remainingSeconds: remainingSeconds(attempt),
    questions,
  };
}

function buildResult(attempt: AttemptRow, scored: ScoredResult, title: string) {
  const isReal = Boolean(attempt.is_real_test);
  return {
    id: attempt.id,
    isRealTest: isReal,
    title,
    submittedAt: attempt.submitted_at
      ? new Date(attempt.submitted_at).toISOString()
      : new Date().toISOString(),
    scoreRaw: scored.scoreRaw,
    scoreScaled: scored.scoreScaled,
    passed: scored.passed,
    correctCount: scored.correctCount,
    totalCount: scored.totalCount,
    percent: scored.percent,
    scenarioBreakdown: scored.scenarioBreakdown,
    wrongAnswers: scored.wrongAnswers,
  };
}

async function sourceTitle(sourceId: number): Promise<string> {
  const [rows] = await getPool().query<RowDataPacket[]>(
    "SELECT title FROM exam_sources WHERE id = ?",
    [sourceId],
  );
  return (rows[0]?.title as string) ?? "Exam";
}

router.get("/attempts", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT a.id, a.source_id, a.is_real_test, s.title, a.started_at,
            a.submitted_at, a.score_scaled, a.passed, a.correct_count, a.total_count
       FROM app_attempts a
       JOIN exam_sources s ON s.id = a.source_id
      WHERE a.user_id = ?
      ORDER BY a.started_at DESC`,
    [userId],
  );
  const data = rows.map((r) => {
    const totalCount = Number(r.total_count);
    const correctCount =
      r.correct_count == null ? null : Number(r.correct_count);
    return {
      id: r.id as number,
      sourceId: r.source_id as number,
      isRealTest: Boolean(r.is_real_test),
      title: r.title as string,
      startedAt: new Date(r.started_at).toISOString(),
      submittedAt: r.submitted_at
        ? new Date(r.submitted_at).toISOString()
        : null,
      scoreScaled: r.score_scaled == null ? null : Number(r.score_scaled),
      passed: r.passed == null ? null : Boolean(r.passed),
      correctCount,
      totalCount,
      percent:
        correctCount != null && totalCount > 0
          ? Math.round((correctCount / totalCount) * 1000) / 10
          : null,
    };
  });
  res.json(ListAttemptsResponse.parse(data));
});

router.post("/attempts", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const parsed = StartAttemptBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }
  const { sourceId } = parsed.data;
  const pool = getPool();

  const [srcRows] = await pool.query<RowDataPacket[]>(
    "SELECT id, is_real_test FROM exam_sources WHERE id = ?",
    [sourceId],
  );
  if (srcRows.length === 0) {
    res.status(400).json({ error: "Unknown source" });
    return;
  }
  const isReal = Boolean(srcRows[0].is_real_test);

  const questions = await getQuestionsForSource(sourceId);
  if (questions.length === 0) {
    res.status(400).json({ error: "Source has no questions" });
    return;
  }

  const timeLimit = isReal
    ? REAL_TEST_TIME_LIMIT
    : parsed.data.timeLimitSeconds && parsed.data.timeLimitSeconds > 0
      ? parsed.data.timeLimitSeconds
      : MOCKUP_DEFAULT_TIME_LIMIT;

  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO app_attempts
       (user_id, source_id, is_real_test, time_limit_seconds, total_count)
     VALUES (?, ?, ?, ?, ?)`,
    [userId, sourceId, isReal ? 1 : 0, timeLimit, questions.length],
  );
  const attemptId = result.insertId;

  const values = questions.map((q, idx) => [attemptId, q.id, idx + 1]);
  await pool.query(
    `INSERT INTO app_attempt_questions (attempt_id, question_id, position) VALUES ?`,
    [values],
  );

  const attempt = await loadAttempt(attemptId, userId);
  const detail = await buildAttemptDetail(attempt!);
  res.status(201).json(GetAttemptResponse.parse(detail));
});

router.get("/attempts/:id", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const params = GetAttemptParams.safeParse(req.params);
  if (!params.success) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const attempt = await loadAttempt(params.data.id, userId);
  if (!attempt) {
    res.status(404).json({ error: "Attempt not found" });
    return;
  }

  if (isExpired(attempt) && !attempt.submitted_at) {
    const scored = await computeScore(attempt);
    await persistScore(attempt, scored);
    const refreshed = await loadAttempt(attempt.id, userId);
    const detail = await buildAttemptDetail(refreshed!);
    res.json(GetAttemptResponse.parse(detail));
    return;
  }

  const detail = await buildAttemptDetail(attempt);
  res.json(GetAttemptResponse.parse(detail));
});

router.post("/attempts/:id/answer", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const params = SaveAnswerParams.safeParse(req.params);
  const body = SaveAnswerBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }
  const attempt = await loadAttempt(params.data.id, userId);
  if (!attempt) {
    res.status(404).json({ error: "Attempt not found" });
    return;
  }
  if (attempt.submitted_at || isExpired(attempt)) {
    res.status(400).json({ error: "Attempt is no longer active" });
    return;
  }

  const { questionId, selectedOption, flagged } = body.data;
  const pool = getPool();

  const sets: string[] = [];
  const args: unknown[] = [];
  if (selectedOption !== undefined) {
    sets.push("selected_option = ?");
    args.push(selectedOption ?? null);
  }
  if (flagged !== undefined && flagged !== null) {
    sets.push("flagged = ?");
    args.push(flagged ? 1 : 0);
  }
  if (sets.length === 0) {
    res.json(SaveAnswerResponse.parse({ saved: true }));
    return;
  }

  args.push(attempt.id, questionId);
  const [upd] = await pool.query<ResultSetHeader>(
    `UPDATE app_attempt_questions SET ${sets.join(", ")}
      WHERE attempt_id = ? AND question_id = ?`,
    args,
  );
  if (upd.affectedRows === 0) {
    res.status(400).json({ error: "Question not part of this attempt" });
    return;
  }

  const isReal = Boolean(attempt.is_real_test);
  if (isReal || selectedOption == null) {
    res.json(SaveAnswerResponse.parse({ saved: true }));
    return;
  }

  const questionMap = await getQuestionsByIds([questionId]);
  const q = questionMap.get(questionId);
  const isCorrect = q ? selectedOption === q.correctOption : null;
  res.json(
    SaveAnswerResponse.parse({
      saved: true,
      isCorrect,
      correctOption: q ? q.correctOption : null,
    }),
  );
});

router.post("/attempts/:id/submit", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const params = SubmitAttemptParams.safeParse(req.params);
  if (!params.success) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const attempt = await loadAttempt(params.data.id, userId);
  if (!attempt) {
    res.status(404).json({ error: "Attempt not found" });
    return;
  }
  const scored = await computeScore(attempt);
  if (!attempt.submitted_at) {
    await persistScore(attempt, scored);
  }
  const refreshed = await loadAttempt(attempt.id, userId);
  const title = await sourceTitle(attempt.source_id);
  res.json(SubmitAttemptResponse.parse(buildResult(refreshed!, scored, title)));
});

router.get("/attempts/:id/result", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const params = GetAttemptResultParams.safeParse(req.params);
  if (!params.success) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const attempt = await loadAttempt(params.data.id, userId);
  if (!attempt) {
    res.status(404).json({ error: "Attempt not found" });
    return;
  }
  if (!attempt.submitted_at && isExpired(attempt)) {
    const scored = await computeScore(attempt);
    await persistScore(attempt, scored);
  } else if (!attempt.submitted_at) {
    res.status(400).json({ error: "Attempt has not been submitted yet" });
    return;
  }
  const scored = await computeScore(attempt);
  const refreshed = await loadAttempt(attempt.id, userId);
  const title = await sourceTitle(attempt.source_id);
  res.json(
    GetAttemptResultResponse.parse(buildResult(refreshed!, scored, title)),
  );
});

export default router;
