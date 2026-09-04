USE learnvault_db;

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
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_lv_assign_subject_status (subject_id, status),

    FOREIGN KEY (subject_id)
        REFERENCES subjects(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    FOREIGN KEY (created_by)
        REFERENCES users(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
) ENGINE=InnoDB;


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
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uq_lv_assignment_student (assignment_id, student_user_id),
    INDEX idx_lv_sub_student_status (student_user_id, status),
    INDEX idx_lv_sub_assignment_status (assignment_id, status),

    FOREIGN KEY (assignment_id)
        REFERENCES assignments(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    FOREIGN KEY (student_user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    FOREIGN KEY (graded_by)
        REFERENCES users(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
) ENGINE=InnoDB;


SHOW TABLES LIKE '%assignment%';

DESCRIBE assignments;
DESCRIBE assignment_submissions;
