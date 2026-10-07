USE defaultdb;

-- LearnVault Next-Generation Hackathon Extension
-- AI Student Success + Career Development + Community Impact + Gamification

CREATE TABLE IF NOT EXISTS career_profiles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    target_role VARCHAR(180) NULL,
    target_domain VARCHAR(120) NULL,
    bio TEXT NULL,
    resume_url VARCHAR(1000) NULL,
    portfolio_url VARCHAR(1000) NULL,
    readiness_score DECIMAL(5,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_career_profile_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS career_certifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    name VARCHAR(220) NOT NULL,
    issuer VARCHAR(180) NULL,
    credential_url VARCHAR(1000) NULL,
    issued_on DATE NULL,
    expires_on DATE NULL,
    status ENUM('planned','in_progress','completed') NOT NULL DEFAULT 'planned',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_career_cert_user (user_id, status),
    CONSTRAINT fk_career_cert_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS community_projects (
    id INT AUTO_INCREMENT PRIMARY KEY,
    created_by INT NULL,
    title VARCHAR(220) NOT NULL,
    category VARCHAR(120) NOT NULL,
    description TEXT NOT NULL,
    impact_goal TEXT NULL,
    students_helped INT NOT NULL DEFAULT 0,
    hours_contributed INT NOT NULL DEFAULT 0,
    people_reached INT NOT NULL DEFAULT 0,
    status ENUM('open','active','completed','archived') NOT NULL DEFAULT 'open',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_community_status (status, created_at),
    CONSTRAINT fk_community_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS community_participation (
    id INT AUTO_INCREMENT PRIMARY KEY,
    project_id INT NOT NULL,
    user_id INT NOT NULL,
    contribution_hours DECIMAL(8,2) NOT NULL DEFAULT 0,
    contribution_note TEXT NULL,
    status ENUM('joined','active','completed') NOT NULL DEFAULT 'joined',
    joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_community_member (project_id, user_id),
    INDEX idx_community_user (user_id, status),
    CONSTRAINT fk_community_part_project FOREIGN KEY (project_id) REFERENCES community_projects(id) ON DELETE CASCADE,
    CONSTRAINT fk_community_part_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS gamification_badges (
    id INT AUTO_INCREMENT PRIMARY KEY,
    badge_key VARCHAR(80) NOT NULL UNIQUE,
    badge_name VARCHAR(140) NOT NULL,
    description VARCHAR(300) NOT NULL,
    xp_reward INT NOT NULL DEFAULT 0,
    icon VARCHAR(20) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS user_xp_ledger (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    source_type VARCHAR(80) NOT NULL,
    source_id INT NULL,
    xp INT NOT NULL,
    description VARCHAR(300) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_xp_user (user_id, created_at),
    CONSTRAINT fk_xp_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS user_badges (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    badge_id INT NOT NULL,
    awarded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_user_badge (user_id, badge_id),
    CONSTRAINT fk_user_badge_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_user_badge_badge FOREIGN KEY (badge_id) REFERENCES gamification_badges(id) ON DELETE CASCADE
) ENGINE=InnoDB;

INSERT INTO gamification_badges (badge_key,badge_name,description,xp_reward,icon) VALUES
('quiz_master','Quiz Master','Complete quizzes and improve assessment performance.',100,'✓'),
('problem_solver','Problem Solver','Submit a solution to an Education Innovation Lab challenge.',150,'◇'),
('peer_mentor','Peer Mentor','Contribute useful answers and peer learning activity.',120,'◉'),
('innovation_explorer','Innovation Explorer','Explore and participate in real-world education challenges.',100,'✦'),
('community_contributor','Community Contributor','Contribute time to a community impact project.',150,'♧'),
('skill_builder','Skill Builder','Build measurable progress across skills.',100,'◎'),
('live_learner','Live Learner','Participate consistently in live learning sessions.',80,'▶'),
('master_scholar','Master Scholar','Reach the Master Scholar learning level.',500,'★')
ON DUPLICATE KEY UPDATE badge_name=VALUES(badge_name),description=VALUES(description),xp_reward=VALUES(xp_reward),icon=VALUES(icon);

INSERT INTO community_projects (created_by,title,category,description,impact_goal,status)
SELECT NULL,'Digital Literacy for Rural Learners','Rural Education','Help school learners access foundational digital skills through guided sessions and reusable learning materials.','Reach underserved learners with practical digital literacy.', 'open'
WHERE NOT EXISTS (SELECT 1 FROM community_projects WHERE title='Digital Literacy for Rural Learners');

INSERT INTO community_projects (created_by,title,category,description,impact_goal,status)
SELECT NULL,'Accessible Study Materials Initiative','Accessibility','Create accessible notes, captions, keyboard-friendly resources and alternative formats for learners with different needs.','Improve access to quality learning resources.', 'open'
WHERE NOT EXISTS (SELECT 1 FROM community_projects WHERE title='Accessible Study Materials Initiative');

INSERT INTO community_projects (created_by,title,category,description,impact_goal,status)
SELECT NULL,'Campus Sustainability Learning Drive','Environment','Create student-led awareness and measurement projects around waste, energy and sustainable campus practices.','Turn sustainability awareness into measurable campus action.', 'open'
WHERE NOT EXISTS (SELECT 1 FROM community_projects WHERE title='Campus Sustainability Learning Drive');

INSERT INTO community_projects (created_by,title,category,description,impact_goal,status)
SELECT NULL,'Peer Learning for First-Year Students','Community Learning','Build peer-led support circles that help new students understand academic tools, study methods and campus learning opportunities.','Reduce early academic confusion and strengthen peer support.', 'open'
WHERE NOT EXISTS (SELECT 1 FROM community_projects WHERE title='Peer Learning for First-Year Students');
