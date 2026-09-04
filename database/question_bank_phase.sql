USE learnvault_db;

CREATE TABLE IF NOT EXISTS subject_units (
    id INT AUTO_INCREMENT PRIMARY KEY,
    subject_id INT NOT NULL,
    unit_name VARCHAR(150) NOT NULL,
    unit_order INT NOT NULL DEFAULT 1,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_subject_unit_name UNIQUE (subject_id, unit_name),
    CONSTRAINT fk_subject_unit_subject
        FOREIGN KEY (subject_id) REFERENCES subjects(id)
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS question_bank (
    id INT AUTO_INCREMENT PRIMARY KEY,
    subject_id INT NOT NULL,
    unit_id INT NULL,
    created_by INT NOT NULL,
    question_type ENUM('mcq','true_false','short_answer') NOT NULL,
    question_text TEXT NOT NULL,
    correct_answer TEXT NULL,
    explanation TEXT NULL,
    difficulty ENUM('easy','medium','hard') NOT NULL DEFAULT 'medium',
    marks DECIMAL(5,2) NOT NULL DEFAULT 1.00,
    verification_status ENUM('pending','approved','rejected')
        NOT NULL DEFAULT 'pending',
    verified_by INT NULL,
    verified_at DATETIME NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_question_subject
        FOREIGN KEY (subject_id) REFERENCES subjects(id)
        ON DELETE CASCADE ON UPDATE CASCADE,

    CONSTRAINT fk_question_unit
        FOREIGN KEY (unit_id) REFERENCES subject_units(id)
        ON DELETE SET NULL ON UPDATE CASCADE,

    CONSTRAINT fk_question_creator
        FOREIGN KEY (created_by) REFERENCES users(id)
        ON DELETE RESTRICT ON UPDATE CASCADE,

    CONSTRAINT fk_question_verifier
        FOREIGN KEY (verified_by) REFERENCES users(id)
        ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS question_options (
    id INT AUTO_INCREMENT PRIMARY KEY,
    question_id INT NOT NULL,
    option_label VARCHAR(5) NOT NULL,
    option_text TEXT NOT NULL,
    is_correct TINYINT(1) NOT NULL DEFAULT 0,
    option_order INT NOT NULL DEFAULT 1,

    CONSTRAINT uq_question_option_label
        UNIQUE (question_id, option_label),

    CONSTRAINT fk_question_option_question
        FOREIGN KEY (question_id) REFERENCES question_bank(id)
        ON DELETE CASCADE ON UPDATE CASCADE
);

SHOW TABLES;
DESCRIBE subject_units;
DESCRIBE question_bank;
DESCRIBE question_options;
