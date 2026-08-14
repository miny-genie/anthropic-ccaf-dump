import type { RowDataPacket } from "mysql2";
import { getPool } from "./db";
import { translationLocale } from "./locale";

// The single source used by Practice Mode. Practice never shows a source picker.
export const PRACTICE_SOURCE_KEY = "claude_cert_mock_exam_html";

// User-facing source names. The raw DB titles carry internal prep wording
// ("OCR" / "HTML") that must never be shown in the UI. There are exactly two
// sources: the real certification exam (is_real_test) and the mock-up question
// bank. Always render titles through this helper, never the raw exam_sources.title.
export function displaySourceTitle(isRealTest: boolean): string {
  return isRealTest ? "CCAF Real Exam" : "CCAF Mock-up Questions";
}

// Resolve the practice source id by its stable key. Returns null if missing.
export async function getPracticeSourceId(): Promise<number | null> {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id FROM exam_sources WHERE source_key = ? LIMIT 1",
    [PRACTICE_SOURCE_KEY],
  );
  return rows.length > 0 ? (rows[0].id as number) : null;
}

export interface OptionRow {
  label: string;
  text: string;
}

export interface QuestionRow {
  id: number;
  questionNo: number;
  scenario: string | null;
  questionText: string;
  correctOption: string;
  sourceId: number;
  isRealTest: boolean;
  options: OptionRow[];
}

export async function getQuestionsForSource(
  sourceId: number,
  locale?: string | null,
): Promise<QuestionRow[]> {
  const pool = getPool();
  const translated = translationLocale(locale);
  const [qRows] = await pool.query<RowDataPacket[]>(
    `SELECT q.id, q.question_no,
            COALESCE(qt.scenario, q.scenario) AS scenario,
            COALESCE(qt.question_text, q.question_text) AS question_text,
            q.correct_option,
            q.source_id, s.is_real_test
       FROM exam_questions q
       JOIN exam_sources s ON s.id = q.source_id
       LEFT JOIN exam_question_translations qt
         ON qt.question_id = q.id AND qt.locale = ?
      WHERE q.source_id = ?
      ORDER BY q.question_no ASC`,
    [translated, sourceId],
  );
  if (qRows.length === 0) return [];

  const ids = qRows.map((r) => r.id as number);
  const optionsByQ = await getOptionsForQuestions(ids, translated);

  return qRows.map((r) => ({
    id: r.id as number,
    questionNo: r.question_no as number,
    scenario: (r.scenario as string | null) ?? null,
    questionText: r.question_text as string,
    correctOption: r.correct_option as string,
    sourceId: r.source_id as number,
    isRealTest: Boolean(r.is_real_test),
    options: optionsByQ.get(r.id as number) ?? [],
  }));
}

export async function getQuestionsByIds(
  ids: number[],
  locale?: string | null,
): Promise<Map<number, QuestionRow>> {
  const result = new Map<number, QuestionRow>();
  if (ids.length === 0) return result;
  const pool = getPool();
  const translated = translationLocale(locale);
  const placeholders = ids.map(() => "?").join(",");
  const [qRows] = await pool.query<RowDataPacket[]>(
    `SELECT q.id, q.question_no,
            COALESCE(qt.scenario, q.scenario) AS scenario,
            COALESCE(qt.question_text, q.question_text) AS question_text,
            q.correct_option,
            q.source_id, s.is_real_test
       FROM exam_questions q
       JOIN exam_sources s ON s.id = q.source_id
       LEFT JOIN exam_question_translations qt
         ON qt.question_id = q.id AND qt.locale = ?
      WHERE q.id IN (${placeholders})`,
    [translated, ...ids],
  );
  const optionsByQ = await getOptionsForQuestions(
    qRows.map((r) => r.id as number),
    translated,
  );
  for (const r of qRows) {
    result.set(r.id as number, {
      id: r.id as number,
      questionNo: r.question_no as number,
      scenario: (r.scenario as string | null) ?? null,
      questionText: r.question_text as string,
      correctOption: r.correct_option as string,
      sourceId: r.source_id as number,
      isRealTest: Boolean(r.is_real_test),
      options: optionsByQ.get(r.id as number) ?? [],
    });
  }
  return result;
}

async function getOptionsForQuestions(
  ids: number[],
  locale?: string | null,
): Promise<Map<number, OptionRow[]>> {
  const byQ = new Map<number, OptionRow[]>();
  if (ids.length === 0) return byQ;
  const pool = getPool();
  const translated = translationLocale(locale);
  const placeholders = ids.map(() => "?").join(",");
  const [oRows] = await pool.query<RowDataPacket[]>(
    `SELECT o.question_id, o.option_label,
            COALESCE(ot.option_text, o.option_text) AS option_text
       FROM exam_options o
       LEFT JOIN exam_option_translations ot
         ON ot.option_id = o.id AND ot.locale = ?
      WHERE o.question_id IN (${placeholders})
      ORDER BY o.option_label ASC`,
    [translated, ...ids],
  );
  for (const o of oRows) {
    const qid = o.question_id as number;
    if (!byQ.has(qid)) byQ.set(qid, []);
    byQ.get(qid)!.push({
      label: o.option_label as string,
      text: o.option_text as string,
    });
  }
  return byQ;
}
