USE learnvault_db;

ALTER TABLE live_classes
  ADD COLUMN IF NOT EXISTS stream_provider VARCHAR(30) NULL AFTER meeting_url,
  ADD COLUMN IF NOT EXISTS stream_url TEXT NULL AFTER stream_provider,
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT NULL AFTER stream_url,
  ADD COLUMN IF NOT EXISTS chat_enabled TINYINT(1) NOT NULL DEFAULT 1 AFTER thumbnail_url;

CREATE TABLE IF NOT EXISTS live_class_messages (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  live_class_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_lcm_class FOREIGN KEY (live_class_id) REFERENCES live_classes(id) ON DELETE CASCADE,
  CONSTRAINT fk_lcm_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_lcm_class_time (live_class_id, created_at),
  INDEX idx_lcm_user_time (user_id, created_at)
);

CREATE TABLE IF NOT EXISTS live_class_questions (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  live_class_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  question TEXT NOT NULL,
  is_answered TINYINT(1) NOT NULL DEFAULT 0,
  faculty_answer TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  answered_at TIMESTAMP NULL,
  CONSTRAINT fk_lcq_class FOREIGN KEY (live_class_id) REFERENCES live_classes(id) ON DELETE CASCADE,
  CONSTRAINT fk_lcq_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_lcq_class_time (live_class_id, created_at),
  INDEX idx_lcq_class_answered (live_class_id, is_answered)
);

CREATE INDEX idx_live_classes_status_start ON live_classes(status, starts_at);
CREATE INDEX idx_live_classes_course_level ON live_classes(course_id, course_level_id, starts_at);
CREATE INDEX idx_live_attendance_class_user ON live_class_attendance(live_class_id, user_id);

CREATE OR REPLACE VIEW vw_live_class_engagement AS
SELECT lc.id live_class_id,
       lc.title,
       lc.status,
       lc.starts_at,
       lc.ends_at,
       COUNT(DISTINCT a.user_id) participants,
       COUNT(DISTINCT q.id) questions,
       COUNT(DISTINCT CASE WHEN q.is_answered=1 THEN q.id END) answered_questions,
       COALESCE(AVG(a.attendance_minutes),0) avg_attendance_minutes
FROM live_classes lc
LEFT JOIN live_class_attendance a ON a.live_class_id=lc.id
LEFT JOIN live_class_questions q ON q.live_class_id=lc.id
GROUP BY lc.id;
