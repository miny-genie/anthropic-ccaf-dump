import type { RowDataPacket } from "mysql2";
import { getPool } from "./db";
import { logger } from "./logger";

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS app_users (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(60) NOT NULL UNIQUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS app_attempts (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    source_id BIGINT NOT NULL,
    is_real_test TINYINT NOT NULL,
    time_limit_seconds INT NOT NULL,
    current_position INT NOT NULL DEFAULT 1,
    started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    submitted_at TIMESTAMP NULL,
    score_raw INT NULL,
    score_scaled INT NULL,
    passed TINYINT NULL,
    correct_count INT NULL,
    total_count INT NOT NULL,
    INDEX idx_attempts_user (user_id),
    INDEX idx_attempts_user_submitted (user_id, submitted_at)
  )`,
  `CREATE TABLE IF NOT EXISTS app_attempt_questions (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    attempt_id BIGINT NOT NULL,
    question_id BIGINT NOT NULL,
    position INT NOT NULL,
    option_order VARCHAR(64) NULL,
    selected_option VARCHAR(8) NULL,
    flagged TINYINT NOT NULL DEFAULT 0,
    UNIQUE KEY uniq_attempt_question (attempt_id, question_id),
    INDEX idx_aq_attempt (attempt_id)
  )`,
  `CREATE TABLE IF NOT EXISTS app_wrong_answers (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    question_id BIGINT NOT NULL,
    is_real_test TINYINT NOT NULL,
    selected_option VARCHAR(8) NULL,
    correct_option VARCHAR(8) NOT NULL,
    note TEXT NULL,
    resolved_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_user_question (user_id, question_id),
    INDEX idx_wa_user (user_id)
  )`,
  `CREATE TABLE IF NOT EXISTS app_bookmarks (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    question_id BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_user_question_bm (user_id, question_id),
    INDEX idx_bm_user (user_id)
  )`,
  `CREATE TABLE IF NOT EXISTS app_notes (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    question_id BIGINT NOT NULL,
    note TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_user_question_note (user_id, question_id),
    INDEX idx_notes_user (user_id)
  )`,
];

async function columnExists(table: string, column: string): Promise<boolean> {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT 1 FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?
      LIMIT 1`,
    [table, column],
  );
  return rows.length > 0;
}

async function indexExists(table: string, indexName: string): Promise<boolean> {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT 1 FROM information_schema.statistics
      WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?
      LIMIT 1`,
    [table, indexName],
  );
  return rows.length > 0;
}

async function runMigrations(): Promise<void> {
  const pool = getPool();

  // Older deployments may predate these columns.
  if (!(await columnExists("app_attempt_questions", "option_order"))) {
    await pool.query(
      "ALTER TABLE app_attempt_questions ADD COLUMN option_order VARCHAR(64) NULL",
    );
    logger.info("Migration: added app_attempt_questions.option_order");
  }
  if (!(await columnExists("app_attempts", "current_position"))) {
    await pool.query(
      "ALTER TABLE app_attempts ADD COLUMN current_position INT NOT NULL DEFAULT 1",
    );
    logger.info("Migration: added app_attempts.current_position");
  }

  // Personal per-question notes used to live on app_wrong_answers.note.
  // Move any existing notes into app_notes (the new single source of truth).
  await pool.query(
    `INSERT IGNORE INTO app_notes (user_id, question_id, note)
       SELECT user_id, question_id, note
         FROM app_wrong_answers
        WHERE note IS NOT NULL AND note <> ''`,
  );

  // Wrong answers must distinguish real vs mock for the same question, so the
  // notebook's real/mock filter is accurate. Upgrade the unique key if needed.
  if (
    (await indexExists("app_wrong_answers", "uniq_user_question")) &&
    !(await indexExists("app_wrong_answers", "uniq_user_question_real"))
  ) {
    await pool.query(
      "ALTER TABLE app_wrong_answers DROP INDEX uniq_user_question",
    );
    await pool.query(
      `ALTER TABLE app_wrong_answers
         ADD UNIQUE KEY uniq_user_question_real (user_id, question_id, is_real_test)`,
    );
    logger.info("Migration: app_wrong_answers unique key now includes is_real_test");
  }
}

export async function initDb(): Promise<void> {
  const pool = getPool();
  for (const stmt of STATEMENTS) {
    await pool.query(stmt);
  }
  await runMigrations();
  logger.info("App tables initialized");
}
