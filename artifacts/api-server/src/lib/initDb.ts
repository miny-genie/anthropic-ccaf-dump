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
];

export async function initDb(): Promise<void> {
  const pool = getPool();
  for (const stmt of STATEMENTS) {
    await pool.query(stmt);
  }
  logger.info("App tables initialized");
}
