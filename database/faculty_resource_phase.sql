USE learnvault_db;

/* =====================================================
   PHASE: SUBJECT MANAGEMENT + FACULTY ASSIGNMENTS
===================================================== */

ALTER TABLE subjects
ADD COLUMN course_level_id INT NULL
AFTER course_id;

ALTER TABLE subjects
ADD COLUMN is_active TINYINT(1)
NOT NULL DEFAULT 1
AFTER semester;

ALTER TABLE subjects
ADD CONSTRAINT fk_subject_course_level
FOREIGN KEY (course_level_id)
REFERENCES course_levels(id)
ON DELETE SET NULL
ON UPDATE CASCADE;

CREATE TABLE faculty_subject_assignments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    faculty_user_id INT NOT NULL,
    subject_id INT NOT NULL,
    assigned_by INT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT uq_faculty_subject
        UNIQUE (faculty_user_id, subject_id),

    CONSTRAINT fk_assignment_faculty
        FOREIGN KEY (faculty_user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT fk_assignment_subject
        FOREIGN KEY (subject_id)
        REFERENCES subjects(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT fk_assignment_admin
        FOREIGN KEY (assigned_by)
        REFERENCES users(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
);

/* Map current B.Tech CSE sample subjects to the existing 2nd Year level. */
UPDATE subjects s
JOIN courses c
    ON s.course_id = c.id
JOIN course_levels cl
    ON cl.course_id = c.id
   AND cl.level_name = '2nd Year'
SET s.course_level_id = cl.id
WHERE c.course_code = 'BTECH-CSE'
  AND s.study_year = 2
  AND s.course_level_id IS NULL;

DESCRIBE subjects;
DESCRIBE faculty_subject_assignments;
SHOW TABLES;
