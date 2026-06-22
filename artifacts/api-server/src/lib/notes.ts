import type { ResultSetHeader } from "mysql2";
import { getPool } from "./db";

export const MAX_NOTE_LENGTH = 4000;

// Single source of truth for a user's per-question personal note, shared by
// practice mode and the wrong-answer notebook. An empty note removes the row.
export async function setNote(
  userId: number,
  questionId: number,
  note: string | null,
): Promise<string | null> {
  const pool = getPool();
  const value = (note ?? "").trim();
  if (value === "") {
    await pool.query<ResultSetHeader>(
      "DELETE FROM app_notes WHERE user_id = ? AND question_id = ?",
      [userId, questionId],
    );
    return null;
  }
  const truncated = value.slice(0, MAX_NOTE_LENGTH);
  await pool.query<ResultSetHeader>(
    `INSERT INTO app_notes (user_id, question_id, note) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE note = VALUES(note)`,
    [userId, questionId, truncated],
  );
  return truncated;
}
