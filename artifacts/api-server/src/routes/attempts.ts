import { Router, type IRouter } from "express";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import {
  StartAttemptBody,
  GetAttemptParams,
  SaveAnswerParams,
  SaveAnswerBody,
  SubmitAttemptParams,
  GetAttemptResultParams,
  UpdateAttemptProgressParams,
  UpdateAttemptProgressBody,
  ListAttemptsResponse,
  GetAttemptResponse,
  SaveAnswerResponse,
  SubmitAttemptResponse,
  GetAttemptResultResponse,
  UpdateAttemptProgressResponse,
} from "@workspace/api-zod";
import { getPool } from "../lib/db";
import { requireAuth, type AuthedRequest } from "../lib/auth";
import { getQuestionsByIds, getPracticeSourceId } from "../lib/examData";
import {
  loadAttempt,
  loadSavedAnswers,
  getAttemptQuestionOrder,
  remainingSeconds,
  isExpired,
  computeScore,
  persistScore,
  reorderOptions,
  createAttempt,
  findActivePracticeAttempt,
  deletePracticeAttempts,
  type AttemptRow,
  type ScoredResult,
} from "../lib/attempts";

const router: IRouter = Router();

async function loadUserQuestionMeta(
  userId: number,
  questionIds: number[],
): Promise<{ bookmarked: Set<number>; notes: Map<number, string> }> {
  const bookmarked = new Set<number>();
  const notes = new Map<number, string>();
  if (questionIds.length === 0) return { bookmarked, notes };
  const pool = getPool();
  const placeholders = questionIds.map(() => "?").join(",");

  const [bmRows] = await pool.query<RowDataPacket[]>(
    `SELECT question_id FROM app_bookmarks
      WHERE user_id = ? AND question_id IN (${placeholders})`,
    [userId, ...questionIds],
  );
  for (const r of bmRows) bookmarked.add(r.question_id as number);

  const [noteRows] = await pool.query<RowDataPacket[]>(
    `SELECT question_id, note FROM app_notes
      WHERE user_id = ? AND question_id IN (${placeholders})`,
    [userId, ...questionIds],
  );
  for (const r of noteRows) {
    const note = (r.note as string | null) ?? null;
    if (note != null && note !== "") notes.set(r.question_id as number, note);
  }
  return { bookmarked, notes };
}

async function buildAttemptDetail(attempt: AttemptRow) {
  const order = await getAttemptQuestionOrder(attempt.id);
  const answers = await loadSavedAnswers(attempt.id);
  const questionMap = await getQuestionsByIds(order);
  const isReal = Boolean(attempt.is_real_test);
  const { bookmarked, notes } = await loadUserQuestionMeta(
    attempt.user_id,
    order,
  );

  const questions = order
    .map((id, idx) => {
      const q = questionMap.get(id);
      if (!q) return null;
      const saved = answers.get(id);
      const selected = saved?.selected_option ?? null;
      // Practice reveals correctness once a question is answered; real tests
      // never expose the correct option before submission.
      const revealed = !isReal && selected != null;
      return {
        id: q.id,
        questionNo: idx + 1,
        scenario: q.scenario,
        questionText: q.questionText,
        options: reorderOptions(saved?.option_order, q.options),
        selectedOption: selected,
        flagged: Boolean(saved?.flagged),
        bookmarked: bookmarked.has(q.id),
        note: notes.get(q.id) ?? null,
        isCorrect: revealed ? selected === q.correctOption : null,
        correctOption: revealed ? q.correctOption : null,
      };
    })
    .filter((q): q is NonNullable<typeof q> => Boolean(q));

  const [srcRows] = await getPool().query<RowDataPacket[]>(
    "SELECT title FROM exam_sources WHERE id = ?",
    [attempt.source_id],
  );
  const title = (srcRows[0]?.title as string) ?? "Exam";

  const totalQuestions = questions.length;
  const currentPosition = Math.min(
    Math.max(1, attempt.current_position || 1),
    Math.max(1, totalQuestions),
  );

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
    currentPosition,
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
  // Practice has a single persistent attempt managed only by /attempts/practice.
  // This generic endpoint may only start real-test attempts.
  if (!isReal) {
    res.status(400).json({ error: "Use /attempts/practice for practice attempts" });
    return;
  }

  let attemptId: number;
  try {
    attemptId = await createAttempt(userId, sourceId, isReal);
  } catch {
    res.status(400).json({ error: "Source has no questions" });
    return;
  }

  const attempt = await loadAttempt(attemptId, userId);
  const detail = await buildAttemptDetail(attempt!);
  res.status(201).json(GetAttemptResponse.parse(detail));
});

// Practice Mode uses a single, persistent attempt against one fixed source.
// Return the user's active practice attempt, creating one only if none exists.
router.post("/attempts/practice", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const sourceId = await getPracticeSourceId();
  if (sourceId == null) {
    res.status(400).json({ error: "Practice source is not configured" });
    return;
  }

  let attempt = await findActivePracticeAttempt(userId, sourceId);
  if (!attempt) {
    let attemptId: number;
    try {
      attemptId = await createAttempt(userId, sourceId, false);
    } catch {
      res.status(400).json({ error: "Practice source has no questions" });
      return;
    }
    attempt = await loadAttempt(attemptId, userId);
  }

  const detail = await buildAttemptDetail(attempt!);
  res.json(GetAttemptResponse.parse(detail));
});

// Explicit "Start Over": discard the active practice attempt and begin a fresh
// one (re-shuffled). Cross-attempt study data is preserved by design.
router.post("/attempts/practice/reset", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const sourceId = await getPracticeSourceId();
  if (sourceId == null) {
    res.status(400).json({ error: "Practice source is not configured" });
    return;
  }

  await deletePracticeAttempts(userId, sourceId);

  let attemptId: number;
  try {
    attemptId = await createAttempt(userId, sourceId, false);
  } catch {
    res.status(400).json({ error: "Practice source has no questions" });
    return;
  }

  const attempt = await loadAttempt(attemptId, userId);
  const detail = await buildAttemptDetail(attempt!);
  res.json(GetAttemptResponse.parse(detail));
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

  const questionMap = await getQuestionsByIds([questionId]);
  const q = questionMap.get(questionId);

  // Validate the chosen option is a real label for this question.
  if (selectedOption != null) {
    if (!q || !q.options.some((o) => o.label === selectedOption)) {
      res.status(400).json({ error: "Invalid option for this question" });
      return;
    }
  }

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
  if (isReal) {
    res.json(SaveAnswerResponse.parse({ saved: true }));
    return;
  }

  // Flag-only updates (selectedOption omitted) must not touch the notebook.
  if (selectedOption === undefined) {
    res.json(SaveAnswerResponse.parse({ saved: true }));
    return;
  }

  // Practice answers can be changed or cleared freely. Keep the wrong-answer
  // notebook consistent: drop the entry when the selection is cleared or now
  // correct, and (re)record it only while the current answer is wrong.
  if (selectedOption === null) {
    await pool.query<ResultSetHeader>(
      `DELETE FROM app_wrong_answers
        WHERE user_id = ? AND question_id = ? AND is_real_test = 0`,
      [userId, questionId],
    );
    res.json(SaveAnswerResponse.parse({ saved: true }));
    return;
  }

  const isCorrect = q ? selectedOption === q.correctOption : null;

  if (q && isCorrect === false) {
    await pool.query<ResultSetHeader>(
      `INSERT INTO app_wrong_answers
         (user_id, question_id, is_real_test, selected_option, correct_option, resolved_at)
       VALUES (?, ?, 0, ?, ?, NULL)
       ON DUPLICATE KEY UPDATE
         selected_option = VALUES(selected_option),
         correct_option = VALUES(correct_option),
         resolved_at = NULL`,
      [userId, questionId, selectedOption, q.correctOption],
    );
  } else if (q && isCorrect === true) {
    await pool.query<ResultSetHeader>(
      `DELETE FROM app_wrong_answers
        WHERE user_id = ? AND question_id = ? AND is_real_test = 0`,
      [userId, questionId],
    );
  }

  res.json(
    SaveAnswerResponse.parse({
      saved: true,
      isCorrect,
      correctOption: q ? q.correctOption : null,
    }),
  );
});

router.patch("/attempts/:id/progress", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const params = UpdateAttemptProgressParams.safeParse(req.params);
  const body = UpdateAttemptProgressBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }
  const attempt = await loadAttempt(params.data.id, userId);
  if (!attempt) {
    res.status(404).json({ error: "Attempt not found" });
    return;
  }
  const clamped = Math.min(
    Math.max(1, body.data.currentPosition),
    Math.max(1, attempt.total_count),
  );
  const pool = getPool();
  await pool.query<ResultSetHeader>(
    "UPDATE app_attempts SET current_position = ? WHERE id = ? AND user_id = ?",
    [clamped, attempt.id, userId],
  );
  res.json(UpdateAttemptProgressResponse.parse({ ok: true }));
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
  // Practice attempts are never submitted — they persist until explicit reset.
  if (!attempt.is_real_test) {
    res.status(400).json({ error: "Practice attempts cannot be submitted" });
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
