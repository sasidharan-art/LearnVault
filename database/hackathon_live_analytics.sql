-- LearnVault Hackathon: Live Learning Intelligence
-- Run after the existing LearnVault schema/migrations.

CREATE TABLE IF NOT EXISTS user_presence (
    user_id INT NOT NULL,
    role_name VARCHAR(30) NOT NULL,
    current_page VARCHAR(255) NULL,
    session_started_at DATETIME NULL,
    last_seen DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id),
    INDEX idx_presence_last_seen (last_seen),
    INDEX idx_presence_role_last_seen (role_name, last_seen)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS learning_events (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id INT NOT NULL,
    role_name VARCHAR(30) NOT NULL,
    event_type VARCHAR(60) NOT NULL,
    entity_type VARCHAR(60) NULL,
    entity_id INT NULL,
    page_url VARCHAR(255) NULL,
    metadata_json JSON NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    INDEX idx_events_user_created (user_id, created_at),
    INDEX idx_events_type_created (event_type, created_at),
    INDEX idx_events_created (created_at),
    INDEX idx_events_role_created (role_name, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
