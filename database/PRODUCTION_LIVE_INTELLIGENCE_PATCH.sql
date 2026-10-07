USE learnvault_db;

-- Safe incremental patch for the already-deployed LearnVault database.
-- Run once on Aiven. It does not drop or replace existing data.

ALTER TABLE live_classes
  ADD COLUMN IF NOT EXISTS stream_provider VARCHAR(30) NULL AFTER meeting_url,
  ADD COLUMN IF NOT EXISTS stream_url TEXT NULL AFTER stream_provider,
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT NULL AFTER stream_url,
  ADD COLUMN IF NOT EXISTS chat_enabled TINYINT(1) NOT NULL DEFAULT 1 AFTER thumbnail_url,
  ADD COLUMN IF NOT EXISTS native_enabled TINYINT(1) NOT NULL DEFAULT 1 AFTER chat_enabled,
  ADD COLUMN IF NOT EXISTS active_host_user_id INT NULL AFTER faculty_user_id;

CREATE TABLE IF NOT EXISTS live_class_attendance (
  id INT AUTO_INCREMENT PRIMARY KEY,
  live_class_id INT NOT NULL,
  user_id INT NOT NULL,
  joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  left_at DATETIME NULL,
  attendance_minutes INT NOT NULL DEFAULT 0,
  UNIQUE KEY uq_live_class_attendance (live_class_id,user_id),
  INDEX idx_live_attendance_user (user_id,joined_at),
  INDEX idx_live_attendance_active (live_class_id,left_at,user_id),
  CONSTRAINT fk_live_attendance_class_patch FOREIGN KEY (live_class_id) REFERENCES live_classes(id) ON DELETE CASCADE,
  CONSTRAINT fk_live_attendance_user_patch FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS live_class_messages (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  live_class_id INT NOT NULL,
  user_id INT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_lcm_class_time (live_class_id,created_at),
  CONSTRAINT fk_lcm_class_patch FOREIGN KEY (live_class_id) REFERENCES live_classes(id) ON DELETE CASCADE,
  CONSTRAINT fk_lcm_user_patch FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS live_class_questions (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  live_class_id INT NOT NULL,
  user_id INT NOT NULL,
  question TEXT NOT NULL,
  is_answered TINYINT(1) NOT NULL DEFAULT 0,
  faculty_answer TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  answered_at TIMESTAMP NULL,
  INDEX idx_lcq_class_time (live_class_id,created_at),
  INDEX idx_lcq_class_answered (live_class_id,is_answered),
  CONSTRAINT fk_lcq_class_patch FOREIGN KEY (live_class_id) REFERENCES live_classes(id) ON DELETE CASCADE,
  CONSTRAINT fk_lcq_user_patch FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS live_class_polls (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  live_class_id INT NOT NULL,
  created_by INT NOT NULL,
  question VARCHAR(1000) NOT NULL,
  poll_type ENUM('poll','quiz') NOT NULL DEFAULT 'poll',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  correct_option_id BIGINT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  closed_at TIMESTAMP NULL,
  INDEX idx_lcp_class_active (live_class_id,is_active,created_at),
  CONSTRAINT fk_lcp_class_patch FOREIGN KEY (live_class_id) REFERENCES live_classes(id) ON DELETE CASCADE,
  CONSTRAINT fk_lcp_user_patch FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS live_class_poll_options (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  poll_id BIGINT NOT NULL,
  option_text VARCHAR(500) NOT NULL,
  option_order INT NOT NULL DEFAULT 0,
  INDEX idx_lcpo_poll_order (poll_id,option_order),
  CONSTRAINT fk_lcpo_poll_patch FOREIGN KEY (poll_id) REFERENCES live_class_polls(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS live_class_poll_responses (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  poll_id BIGINT NOT NULL,
  user_id INT NOT NULL,
  option_id BIGINT NOT NULL,
  is_correct TINYINT(1) NULL,
  responded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_lcpr_poll_user (poll_id,user_id),
  INDEX idx_lcpr_poll_option (poll_id,option_id),
  CONSTRAINT fk_lcpr_poll_patch FOREIGN KEY (poll_id) REFERENCES live_class_polls(id) ON DELETE CASCADE,
  CONSTRAINT fk_lcpr_user_patch FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_lcpr_option_patch FOREIGN KEY (option_id) REFERENCES live_class_poll_options(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS live_class_materials (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  live_class_id INT NOT NULL,
  uploaded_by INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  resource_url TEXT NOT NULL,
  material_type VARCHAR(60) NOT NULL DEFAULT 'resource',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_lcmat_class_time (live_class_id,created_at),
  CONSTRAINT fk_lcmat_class_patch FOREIGN KEY (live_class_id) REFERENCES live_classes(id) ON DELETE CASCADE,
  CONSTRAINT fk_lcmat_user_patch FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS live_class_moderation (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  live_class_id INT NOT NULL,
  moderator_user_id INT NOT NULL,
  target_user_id INT NOT NULL,
  action ENUM('mute','unmute','remove','ban','unban') NOT NULL,
  reason VARCHAR(500) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_lcmod_class_target (live_class_id,target_user_id,created_at),
  CONSTRAINT fk_lcmod_class_patch FOREIGN KEY (live_class_id) REFERENCES live_classes(id) ON DELETE CASCADE,
  CONSTRAINT fk_lcmod_user_patch FOREIGN KEY (moderator_user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_lcmod_target_patch FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Use a new signaling table so older LearnVault WebRTC schemas cannot conflict.
CREATE TABLE IF NOT EXISTS live_class_signals_v2 (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  live_class_id INT NOT NULL,
  from_user_id INT NOT NULL,
  to_user_id INT NOT NULL,
  signal_type ENUM('offer','answer') NOT NULL,
  payload LONGTEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  consumed_at DATETIME NULL,
  INDEX idx_lcsv2_to (live_class_id,to_user_id,signal_type,consumed_at,id),
  INDEX idx_lcsv2_from (live_class_id,from_user_id,signal_type,created_at),
  CONSTRAINT fk_lcsv2_class_patch FOREIGN KEY (live_class_id) REFERENCES live_classes(id) ON DELETE CASCADE,
  CONSTRAINT fk_lcsv2_from_patch FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_lcsv2_to_patch FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS learning_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  role_name VARCHAR(30) NOT NULL,
  event_type VARCHAR(60) NOT NULL,
  entity_type VARCHAR(60) NULL,
  entity_id INT NULL,
  page_url VARCHAR(255) NULL,
  metadata_json JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_events_user_created (user_id,created_at),
  INDEX idx_events_created (created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS academic_interventions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_user_id INT NOT NULL,
  risk_score DECIMAL(5,2) NOT NULL,
  risk_level ENUM('low','medium','high') NOT NULL,
  trigger_reason VARCHAR(500) NOT NULL,
  recommended_action VARCHAR(500) NULL,
  status ENUM('open','acknowledged','resolved') NOT NULL DEFAULT 'open',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP NULL,
  INDEX idx_intervention_student_status (student_user_id,status,created_at),
  CONSTRAINT fk_intervention_student_patch FOREIGN KEY (student_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
