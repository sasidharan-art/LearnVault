USE learnvault_db;

-- Native LearnVault Live Classroom
-- Video stays inside LearnVault using WebRTC. The API only handles signaling,
-- attendance, chat, Q&A and permissions; media flows browser-to-browser.

ALTER TABLE live_classes
  ADD COLUMN IF NOT EXISTS native_enabled TINYINT(1) NOT NULL DEFAULT 1 AFTER chat_enabled;

CREATE TABLE IF NOT EXISTS live_class_signals (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    live_class_id INT NOT NULL,
    from_user_id INT NOT NULL,
    to_user_id INT NOT NULL,
    signal_type ENUM('offer','answer') NOT NULL,
    payload LONGTEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    consumed_at DATETIME NULL,
    INDEX idx_lcs_to_pending (live_class_id, to_user_id, signal_type, consumed_at, id),
    INDEX idx_lcs_from (live_class_id, from_user_id, signal_type, created_at),
    CONSTRAINT fk_lcs_class FOREIGN KEY (live_class_id) REFERENCES live_classes(id) ON DELETE CASCADE,
    CONSTRAINT fk_lcs_from FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_lcs_to FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE INDEX idx_live_attendance_active ON live_class_attendance (live_class_id, left_at, user_id);
