USE learnvault_db;

CREATE TABLE IF NOT EXISTS student_academic_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_user_id INT NOT NULL,
    from_course_id INT NULL,
    from_course_level_id INT NULL,
    to_course_id INT NOT NULL,
    to_course_level_id INT NULL,
    change_type ENUM(
        'initial','promotion','level_change','course_change',
        'stream_change','correction','completion'
    ) NOT NULL DEFAULT 'level_change',
    requested_by INT NULL,
    changed_by INT NULL,
    note VARCHAR(500) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_lv_academic_history_student (student_user_id, created_at),
    INDEX idx_lv_academic_history_destination (to_course_id, to_course_level_id),
    FOREIGN KEY (student_user_id) REFERENCES users(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (from_course_id) REFERENCES courses(id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    FOREIGN KEY (from_course_level_id) REFERENCES course_levels(id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    FOREIGN KEY (to_course_id) REFERENCES courses(id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    FOREIGN KEY (to_course_level_id) REFERENCES course_levels(id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    FOREIGN KEY (requested_by) REFERENCES users(id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    FOREIGN KEY (changed_by) REFERENCES users(id)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS student_academic_change_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_user_id INT NOT NULL,
    from_course_id INT NULL,
    from_course_level_id INT NULL,
    requested_course_id INT NOT NULL,
    requested_course_level_id INT NULL,
    reason VARCHAR(700) NULL,
    status ENUM('pending','approved','rejected','cancelled')
        NOT NULL DEFAULT 'pending',
    reviewed_by INT NULL,
    reviewed_at DATETIME NULL,
    review_note VARCHAR(700) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_lv_academic_request_student (student_user_id, status, created_at),
    INDEX idx_lv_academic_request_status (status, created_at),
    FOREIGN KEY (student_user_id) REFERENCES users(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (from_course_id) REFERENCES courses(id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    FOREIGN KEY (from_course_level_id) REFERENCES course_levels(id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    FOREIGN KEY (requested_course_id) REFERENCES courses(id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    FOREIGN KEY (requested_course_level_id) REFERENCES course_levels(id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    FOREIGN KEY (reviewed_by) REFERENCES users(id)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS announcements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    created_by INT NOT NULL,
    target_type ENUM('all','role','course','level','subject','user')
        NOT NULL DEFAULT 'all',
    target_role ENUM('student','faculty','admin') NULL,
    course_id INT NULL,
    course_level_id INT NULL,
    subject_id INT NULL,
    target_user_id INT NULL,
    title VARCHAR(180) NOT NULL,
    body TEXT NOT NULL,
    priority ENUM('normal','important','urgent')
        NOT NULL DEFAULT 'normal',
    status ENUM('published','hidden')
        NOT NULL DEFAULT 'published',
    starts_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_lv_announcement_status (status, starts_at, expires_at),
    INDEX idx_lv_announcement_target (target_type, target_role),
    FOREIGN KEY (created_by) REFERENCES users(id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (course_level_id) REFERENCES course_levels(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES subjects(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (target_user_id) REFERENCES users(id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS user_notification_reads (
    user_id INT NOT NULL,
    notification_key VARCHAR(190) NOT NULL,
    read_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, notification_key),
    INDEX idx_lv_notification_read_time (read_at),
    FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

INSERT INTO student_academic_history
(
    student_user_id,
    from_course_id,
    from_course_level_id,
    to_course_id,
    to_course_level_id,
    change_type,
    note
)
SELECT
    sp.user_id,
    NULL,
    NULL,
    sp.course_id,
    sp.course_level_id,
    'initial',
    'Current academic profile imported into progression history'
FROM student_profiles sp
WHERE
    sp.course_id IS NOT NULL
    AND NOT EXISTS
    (
        SELECT 1
        FROM student_academic_history sah
        WHERE sah.student_user_id = sp.user_id
    );

SHOW TABLES LIKE '%academic%';
SHOW TABLES LIKE '%announcement%';
SHOW TABLES LIKE '%notification%';
SELECT COUNT(*) AS academic_history_rows
FROM student_academic_history;
