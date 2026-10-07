USE learnvault_db;

/*
   LEARNVAULT - ACADEMIC INTELLIGENCE & ATTENDANCE INNOVATION
   ----------------------------------------------------------
   Novel DBMS component:
   Explainable Early Intervention Engine.
   Risk is derived from relational learning signals using transparent
   SQL calculations rather than an opaque label.
*/

CREATE TABLE IF NOT EXISTS attendance_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    subject_id INT NOT NULL,
    faculty_user_id INT NOT NULL,
    session_date DATE NOT NULL,
    topic VARCHAR(220) NULL,
    status ENUM('open','closed','cancelled') NOT NULL DEFAULT 'open',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMP NULL,
    INDEX idx_attendance_session_subject_date (subject_id, session_date),
    INDEX idx_attendance_session_faculty_date (faculty_user_id, session_date),
    CONSTRAINT fk_att_session_subject FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
    CONSTRAINT fk_att_session_faculty FOREIGN KEY (faculty_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS attendance_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id INT NOT NULL,
    student_user_id INT NOT NULL,
    attendance_status ENUM('present','absent','late') NOT NULL DEFAULT 'present',
    marked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_attendance_student_session (session_id, student_user_id),
    INDEX idx_attendance_student_status (student_user_id, attendance_status),
    CONSTRAINT fk_att_record_session FOREIGN KEY (session_id) REFERENCES attendance_sessions(id) ON DELETE CASCADE,
    CONSTRAINT fk_att_record_student FOREIGN KEY (student_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS academic_interventions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_user_id INT NOT NULL,
    risk_score DECIMAL(5,2) NOT NULL,
    risk_level ENUM('low','medium','high') NOT NULL,
    trigger_reason VARCHAR(500) NOT NULL,
    recommended_action VARCHAR(500) NULL,
    status ENUM('open','acknowledged','resolved') NOT NULL DEFAULT 'open',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP NULL,
    INDEX idx_intervention_student_status (student_user_id, status, created_at),
    INDEX idx_intervention_risk (risk_level, created_at),
    CONSTRAINT fk_intervention_student FOREIGN KEY (student_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE OR REPLACE VIEW vw_student_academic_signals AS
SELECT
    u.id AS student_user_id,
    u.full_name,
    u.username,
    c.id AS course_id,
    c.course_name,
    COALESCE(att.attendance_rate, 0) AS attendance_rate,
    COALESCE(qz.quiz_average, 0) AS quiz_average,
    COALESCE(asg.assignment_completion_rate, 0) AS assignment_completion_rate,
    COALESCE(ev.learning_events_30d, 0) AS learning_events_30d
FROM users u
INNER JOIN student_profiles sp ON sp.user_id = u.id
INNER JOIN courses c ON c.id = sp.course_id
LEFT JOIN (
    SELECT
        ar.student_user_id,
        ROUND(100 * SUM(ar.attendance_status = 'present') / NULLIF(COUNT(*),0), 2) AS attendance_rate
    FROM attendance_records ar
    INNER JOIN attendance_sessions ats ON ats.id = ar.session_id
    WHERE ats.status <> 'cancelled'
    GROUP BY ar.student_user_id
) att ON att.student_user_id = u.id
LEFT JOIN (
    SELECT student_user_id, ROUND(AVG(percentage),2) AS quiz_average
    FROM quiz_attempts
    WHERE status='submitted'
    GROUP BY student_user_id
) qz ON qz.student_user_id = u.id
LEFT JOIN (
    SELECT
        a.course_id,
        s.student_user_id,
        ROUND(100 * COUNT(DISTINCT CASE WHEN s.status IN ('submitted','graded','late') THEN a.id END) / NULLIF(COUNT(DISTINCT a.id),0), 2) AS assignment_completion_rate
    FROM assignments a
    INNER JOIN assignment_submissions s ON s.assignment_id = a.id
    GROUP BY a.course_id, s.student_user_id
) asg ON asg.student_user_id = u.id AND asg.course_id = sp.course_id
LEFT JOIN (
    SELECT user_id, COUNT(*) AS learning_events_30d
    FROM learning_events
    WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    GROUP BY user_id
) ev ON ev.user_id = u.id
WHERE u.status='active';

/* Seed a few intervention-friendly badges if the gamification migration already exists. */
INSERT INTO gamification_badges (badge_key,badge_name,description,xp_reward,icon)
SELECT 'early_improver','Early Improver','Improved academic signals after an intervention.',180,'↗'
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='gamification_badges')
  AND NOT EXISTS (SELECT 1 FROM gamification_badges WHERE badge_key='early_improver');
