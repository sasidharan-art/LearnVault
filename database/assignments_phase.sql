USE learnvault_db;

/* ==========================================================
   LEARNVAULT — ASSIGNMENTS + SUBMISSIONS + GRADING

   Faculty controls assignments inside assigned subjects.
   Admin has full oversight, not routine approval.
========================================================== */

CREATE TABLE IF NOT EXISTS assignments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    subject_id INT NOT NULL,
    created_by INT NOT NULL,
    title VARCHAR(180) NOT NULL,
    description TEXT NULL,
    instructions TEXT NULL,
    due_at DATETIME NULL,
    total_marks DECIMAL(8,2) NOT NULL DEFAULT 100.00,
    allow_late_submission TINYINT(1) NOT NULL DEFAULT 0,
    status ENUM('published','hidden') NOT NULL DEFAULT 'published',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_assignment_subject
        FOREIGN KEY (subject_id)
        REFERENCES subjects(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT fk_assignment_creator
        FOREIGN KEY (created_by)
        REFERENCES users(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
);


CREATE TABLE IF NOT EXISTS assignment_submissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    assignment_id INT NOT NULL,
    student_user_id INT NOT NULL,
    submission_text TEXT NULL,
    submission_url VARCHAR(1000) NULL,
    original_file_name VARCHAR(255) NULL,
    stored_file_name VARCHAR(255) NULL,
    file_path VARCHAR(1000) NULL,
    mime_type VARCHAR(150) NULL,
    file_size BIGINT NULL,
    submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status ENUM('submitted','graded') NOT NULL DEFAULT 'submitted',
    marks_awarded DECIMAL(8,2) NULL,
    feedback TEXT NULL,
    graded_by INT NULL,
    graded_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT uq_assignment_student_submission
        UNIQUE (assignment_id, student_user_id),

    CONSTRAINT fk_submission_assignment
        FOREIGN KEY (assignment_id)
        REFERENCES assignments(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT fk_submission_student
        FOREIGN KEY (student_user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT fk_submission_grader
        FOREIGN KEY (graded_by)
        REFERENCES users(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
);

CREATE INDEX idx_assignments_subject_status
    ON assignments(subject_id, status);

CREATE INDEX idx_assignment_submissions_student
    ON assignment_submissions(student_user_id, status);

CREATE INDEX idx_assignment_submissions_assignment
    ON assignment_submissions(assignment_id, status);

SHOW TABLES;
DESCRIBE assignments;
DESCRIBE assignment_submissions;
