import type { RowDataPacket } from "mysql2";
import { getPool } from "./db";

// The single source used by Practice Mode. Practice never shows a source picker.
export const PRACTICE_SOURCE_KEY = "claude_cert_mock_exam_html";

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
): Promise<QuestionRow[]> {
  const pool = getPool();
  const [qRows] = await pool.query<RowDataPacket[]>(
    `SELECT q.id, q.question_no, q.scenario, q.question_text, q.correct_option,
            q.source_id, s.is_real_test
       FROM exam_questions q
       JOIN exam_sources s ON s.id = q.source_id
      WHERE q.source_id = ?
      ORDER BY q.question_no ASC`,
    [sourceId],
  );
  if (qRows.length === 0) return [];

  const ids = qRows.map((r) => r.id as number);
  const optionsByQ = await getOptionsForQuestions(ids);

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
): Promise<Map<number, QuestionRow>> {
  const result = new Map<number, QuestionRow>();
  if (ids.length === 0) return result;
  const pool = getPool();
  const placeholders = ids.map(() => "?").join(",");
  const [qRows] = await pool.query<RowDataPacket[]>(
    `SELECT q.id, q.question_no, q.scenario, q.question_text, q.correct_option,
            q.source_id, s.is_real_test
       FROM exam_questions q
       JOIN exam_sources s ON s.id = q.source_id
      WHERE q.id IN (${placeholders})`,
    ids,
  );
  const optionsByQ = await getOptionsForQuestions(
    qRows.map((r) => r.id as number),
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
): Promise<Map<number, OptionRow[]>> {
  const byQ = new Map<number, OptionRow[]>();
  if (ids.length === 0) return byQ;
  const pool = getPool();
  const placeholders = ids.map(() => "?").join(",");
  const [oRows] = await pool.query<RowDataPacket[]>(
    `SELECT question_id, option_label, option_text
       FROM exam_options
      WHERE question_id IN (${placeholders})
      ORDER BY option_label ASC`,
    ids,
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
