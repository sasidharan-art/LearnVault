USE learnvault_db;

CREATE TABLE IF NOT EXISTS quizzes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    subject_id INT NOT NULL,
    unit_id INT NULL,
    created_by INT NOT NULL,
    title VARCHAR(180) NOT NULL,
    description TEXT NULL,
    time_limit_minutes INT NOT NULL DEFAULT 15,
    pass_percentage DECIMAL(5,2) NOT NULL DEFAULT 50.00,
    max_attempts INT NOT NULL DEFAULT 1,
    verification_status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
    is_published TINYINT(1) NOT NULL DEFAULT 0,
    verified_by INT NULL,
    verified_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_quiz_subject FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_quiz_unit FOREIGN KEY (unit_id) REFERENCES subject_units(id) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_quiz_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_quiz_verifier FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS quiz_questions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    quiz_id INT NOT NULL,
    question_id INT NOT NULL,
    question_order INT NOT NULL DEFAULT 1,
    marks_override DECIMAL(5,2) NULL,
    CONSTRAINT uq_quiz_question UNIQUE (quiz_id, question_id),
    CONSTRAINT fk_qq_quiz FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_qq_question FOREIGN KEY (question_id) REFERENCES question_bank(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS quiz_attempts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    quiz_id INT NOT NULL,
    student_user_id INT NOT NULL,
    attempt_number INT NOT NULL,
    status ENUM('in_progress','submitted') NOT NULL DEFAULT 'in_progress',
    started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    submitted_at DATETIME NULL,
    score DECIMAL(8,2) NOT NULL DEFAULT 0.00,
    total_marks DECIMAL(8,2) NOT NULL DEFAULT 0.00,
    percentage DECIMAL(6,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_student_quiz_attempt UNIQUE (quiz_id, student_user_id, attempt_number),
    CONSTRAINT fk_qa_quiz FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_qa_student FOREIGN KEY (student_user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS quiz_attempt_answers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    attempt_id INT NOT NULL,
    question_id INT NOT NULL,
    selected_option_id INT NULL,
    answer_text TEXT NULL,
    is_correct TINYINT(1) NOT NULL DEFAULT 0,
    marks_awarded DECIMAL(8,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_attempt_question UNIQUE (attempt_id, question_id),
    CONSTRAINT fk_qaa_attempt FOREIGN KEY (attempt_id) REFERENCES quiz_attempts(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_qaa_question FOREIGN KEY (question_id) REFERENCES question_bank(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_qaa_option FOREIGN KEY (selected_option_id) REFERENCES question_options(id) ON DELETE SET NULL ON UPDATE CASCADE
);

SHOW TABLES;
