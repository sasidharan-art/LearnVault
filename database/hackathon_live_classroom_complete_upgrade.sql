
USE learnvault_db;

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
  CONSTRAINT fk_lcp_class FOREIGN KEY (live_class_id) REFERENCES live_classes(id) ON DELETE CASCADE,
  CONSTRAINT fk_lcp_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_lcp_class_active (live_class_id,is_active,created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS live_class_poll_options (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  poll_id BIGINT NOT NULL,
  option_text VARCHAR(500) NOT NULL,
  option_order INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_lcpo_poll FOREIGN KEY (poll_id) REFERENCES live_class_polls(id) ON DELETE CASCADE,
  INDEX idx_lcpo_poll_order (poll_id,option_order)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS live_class_poll_responses (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  poll_id BIGINT NOT NULL,
  user_id INT NOT NULL,
  option_id BIGINT NOT NULL,
  is_correct TINYINT(1) NULL,
  responded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_lcpr_poll_user (poll_id,user_id),
  CONSTRAINT fk_lcpr_poll FOREIGN KEY (poll_id) REFERENCES live_class_polls(id) ON DELETE CASCADE,
  CONSTRAINT fk_lcpr_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_lcpr_option FOREIGN KEY (option_id) REFERENCES live_class_poll_options(id) ON DELETE CASCADE,
  INDEX idx_lcpr_poll_option (poll_id,option_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS live_class_materials (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  live_class_id INT NOT NULL,
  uploaded_by INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  resource_url TEXT NOT NULL,
  material_type VARCHAR(60) NOT NULL DEFAULT 'resource',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_lcmat_class FOREIGN KEY (live_class_id) REFERENCES live_classes(id) ON DELETE CASCADE,
  CONSTRAINT fk_lcmat_user FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_lcmat_class_time (live_class_id,created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS live_class_moderation (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  live_class_id INT NOT NULL,
  moderator_user_id INT NOT NULL,
  target_user_id INT NOT NULL,
  action ENUM('mute','unmute','remove','ban','unban') NOT NULL,
  reason VARCHAR(500) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_lcmod_class FOREIGN KEY (live_class_id) REFERENCES live_classes(id) ON DELETE CASCADE,
  CONSTRAINT fk_lcmod_user FOREIGN KEY (moderator_user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_lcmod_target FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_lcmod_class_target (live_class_id,target_user_id,created_at)
) ENGINE=InnoDB;
