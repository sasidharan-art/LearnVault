USE learnvault_db;

ALTER TABLE live_classes
  ADD COLUMN IF NOT EXISTS active_host_user_id INT NULL AFTER faculty_user_id;

SET @lv_idx_exists := (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='live_classes' AND index_name='idx_live_classes_active_host');
SET @lv_idx_sql := IF(@lv_idx_exists=0, 'CREATE INDEX idx_live_classes_active_host ON live_classes(active_host_user_id, status)', 'SELECT 1');
PREPARE lv_idx_stmt FROM @lv_idx_sql;
EXECUTE lv_idx_stmt;
DEALLOCATE PREPARE lv_idx_stmt;

CREATE TABLE IF NOT EXISTS live_class_signals (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  live_class_id INT NOT NULL,
  sender_user_id INT NOT NULL,
  recipient_user_id INT NOT NULL,
  signal_type VARCHAR(20) NOT NULL,
  payload JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_lcs_class FOREIGN KEY (live_class_id) REFERENCES live_classes(id) ON DELETE CASCADE,
  CONSTRAINT fk_lcs_sender FOREIGN KEY (sender_user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_lcs_recipient FOREIGN KEY (recipient_user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_lcs_recipient (recipient_user_id, id),
  INDEX idx_lcs_class_time (live_class_id, created_at)
) ENGINE=InnoDB;
