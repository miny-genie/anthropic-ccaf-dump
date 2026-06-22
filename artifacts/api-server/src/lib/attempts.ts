import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { getPool } from "./db";
import { getQuestionsByIds, type QuestionRow } from "./examData";

export const REAL_TEST_TIME_LIMIT = 2 * 60 * 60;
export const MOCKUP_DEFAULT_TIME_LIMIT = 2 * 60 * 60;
export const REAL_TEST_PASS = 720;
export const SCALED_MAX = 1000;

export interface AttemptRow {
  id: number;
  user_id: number;
  source_id: number;
  is_real_test: number;
  time_limit_seconds: number;
  current_position: number;
  started_at: Date;
  submitted_at: Date | null;
  score_raw: number | null;
  score_scaled: number | null;
  passed: number | null;
  correct_count: number | null;
  total_count: number;
}

export async function loadAttempt(
  attemptId: number,
  userId: number,
): Promise<AttemptRow | null> {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, user_id, source_id, is_real_test, time_limit_seconds, current_position,
            started_at, submitted_at, score_raw, score_scaled, passed, correct_count,
            total_count
       FROM app_attempts WHERE id = ? AND user_id = ?`,
    [attemptId, userId],
  );
  if (rows.length === 0) return null;
  return rows[0] as unknown as AttemptRow;
}

// Practice attempts are untimed; only real tests have a server-authoritative
// countdown. Returns null when there is no time limit.
export function remainingSeconds(a: AttemptRow): number | null {
  if (!a.is_real_test || a.time_limit_seconds <= 0) return null;
  if (a.submitted_at) return 0;
  const elapsed = Math.floor(
    (Date.now() - new Date(a.started_at).getTime()) / 1000,
  );
  return Math.max(0, a.time_limit_seconds - elapsed);
}

export function isExpired(a: AttemptRow): boolean {
  const rem = remainingSeconds(a);
  return rem !== null && !a.submitted_at && rem <= 0;
}

export function shuffle<T>(input: readonly T[]): T[] {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Reorder a question's options to match a stored "C,A,D,B" order string.
// Any labels missing from the stored order (e.g. data drift) are appended so
// no option is ever hidden, and an empty/invalid order falls back to default.
export function reorderOptions<T extends { label: string }>(
  orderStr: string | null | undefined,
  options: readonly T[],
): T[] {
  if (!orderStr) return [...options];
  const byLabel = new Map(options.map((o) => [o.label, o]));
  const seen = new Set<string>();
  const ordered: T[] = [];
  for (const label of orderStr.split(",")) {
    const opt = byLabel.get(label);
    if (opt && !seen.has(label)) {
      ordered.push(opt);
      seen.add(label);
    }
  }
  for (const o of options) {
    if (!seen.has(o.label)) ordered.push(o);
  }
  return ordered.length > 0 ? ordered : [...options];
}

interface SavedAnswer {
  question_id: number;
  selected_option: string | null;
  flagged: number;
  option_order: string | null;
}

export async function loadSavedAnswers(
  attemptId: number,
): Promise<Map<number, SavedAnswer>> {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT question_id, selected_option, flagged, option_order
       FROM app_attempt_questions WHERE attempt_id = ? ORDER BY position ASC`,
    [attemptId],
  );
  const map = new Map<number, SavedAnswer>();
  for (const r of rows) {
    map.set(r.question_id as number, {
      question_id: r.question_id as number,
      selected_option: (r.selected_option as string | null) ?? null,
      flagged: r.flagged as number,
      option_order: (r.option_order as string | null) ?? null,
    });
  }
  return map;
}

export async function getAttemptQuestionOrder(
  attemptId: number,
): Promise<number[]> {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT question_id FROM app_attempt_questions WHERE attempt_id = ? ORDER BY position ASC`,
    [attemptId],
  );
  return rows.map((r) => r.question_id as number);
}

export interface ScoredResult {
  scoreRaw: number;
  scoreScaled: number;
  passed: boolean;
  correctCount: number;
  totalCount: number;
  percent: number;
  scenarioBreakdown: {
    scenario: string;
    correct: number;
    total: number;
    percent: number;
  }[];
  wrongAnswers: {
    questionId: number;
    scenario: string | null;
    questionText: string;
    options: { label: string; text: string }[];
    selectedOption: string | null;
    correctOption: string;
  }[];
  questions: QuestionRow[];
  answers: Map<number, SavedAnswer>;
}

export async function computeScore(attempt: AttemptRow): Promise<ScoredResult> {
  const order = await getAttemptQuestionOrder(attempt.id);
  const answers = await loadSavedAnswers(attempt.id);
  const questionMap = await getQuestionsByIds(order);
  const questions = order
    .map((id) => questionMap.get(id))
    .filter((q): q is QuestionRow => Boolean(q));

  let correctCount = 0;
  const scenarioMap = new Map<string, { correct: number; total: number }>();
  const wrongAnswers: ScoredResult["wrongAnswers"] = [];

  for (const q of questions) {
    const selected = answers.get(q.id)?.selected_option ?? null;
    const isCorrect = selected != null && selected === q.correctOption;
    if (isCorrect) correctCount += 1;

    const scenarioKey = q.scenario ?? "Uncategorized";
    if (!scenarioMap.has(scenarioKey)) {
      scenarioMap.set(scenarioKey, { correct: 0, total: 0 });
    }
    const s = scenarioMap.get(scenarioKey)!;
    s.total += 1;
    if (isCorrect) s.correct += 1;

    if (!isCorrect) {
      wrongAnswers.push({
        questionId: q.id,
        scenario: q.scenario,
        questionText: q.questionText,
        options: q.options,
        selectedOption: selected,
        correctOption: q.correctOption,
      });
    }
  }

  const totalCount = questions.length;
  const scoreScaled =
    totalCount > 0 ? Math.round((correctCount / totalCount) * SCALED_MAX) : 0;
  const percent =
    totalCount > 0 ? Math.round((correctCount / totalCount) * 1000) / 10 : 0;
  const passed = scoreScaled >= REAL_TEST_PASS;

  const scenarioBreakdown = Array.from(scenarioMap.entries())
    .map(([scenario, v]) => ({
      scenario,
      correct: v.correct,
      total: v.total,
      percent: v.total > 0 ? Math.round((v.correct / v.total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => a.scenario.localeCompare(b.scenario));

  return {
    scoreRaw: correctCount,
    scoreScaled,
    passed,
    correctCount,
    totalCount,
    percent,
    scenarioBreakdown,
    wrongAnswers,
    questions,
    answers,
  };
}

export async function persistScore(
  attempt: AttemptRow,
  scored: ScoredResult,
): Promise<void> {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.query<ResultSetHeader>(
      `UPDATE app_attempts
          SET submitted_at = COALESCE(submitted_at, CURRENT_TIMESTAMP),
              score_raw = ?, score_scaled = ?, passed = ?, correct_count = ?
        WHERE id = ?`,
      [
        scored.scoreRaw,
        scored.scoreScaled,
        scored.passed ? 1 : 0,
        scored.correctCount,
        attempt.id,
      ],
    );

    for (const wa of scored.wrongAnswers) {
      await conn.query<ResultSetHeader>(
        `INSERT INTO app_wrong_answers
           (user_id, question_id, is_real_test, selected_option, correct_option, resolved_at)
         VALUES (?, ?, ?, ?, ?, NULL)
         ON DUPLICATE KEY UPDATE
           is_real_test = VALUES(is_real_test),
           selected_option = VALUES(selected_option),
           correct_option = VALUES(correct_option),
           resolved_at = NULL`,
        [
          attempt.user_id,
          wa.questionId,
          attempt.is_real_test,
          wa.selectedOption,
          wa.correctOption,
        ],
      );
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
