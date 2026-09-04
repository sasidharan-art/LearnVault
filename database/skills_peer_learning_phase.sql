USE learnvault_db;

CREATE TABLE IF NOT EXISTS skills (
    id INT AUTO_INCREMENT PRIMARY KEY,
    subject_id INT NOT NULL,
    skill_name VARCHAR(150) NOT NULL,
    description TEXT NULL,
    skill_level ENUM('foundational','intermediate','advanced') NOT NULL DEFAULT 'foundational',
    created_by INT NOT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_subject_skill_name (subject_id, skill_name),
    CONSTRAINT fk_skill_subject FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_skill_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS student_skill_progress (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_user_id INT NOT NULL,
    skill_id INT NOT NULL,
    progress_percent INT NOT NULL DEFAULT 0,
    status ENUM('not_started','in_progress','completed') NOT NULL DEFAULT 'not_started',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_student_skill_progress (student_user_id, skill_id),
    CONSTRAINT fk_student_skill_user FOREIGN KEY (student_user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_student_skill_skill FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS peer_groups (
    id INT AUTO_INCREMENT PRIMARY KEY,
    subject_id INT NOT NULL,
    created_by INT NOT NULL,
    group_name VARCHAR(160) NOT NULL,
    description TEXT NULL,
    max_members INT NULL,
    status ENUM('open','closed','archived') NOT NULL DEFAULT 'open',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_peer_group_subject_name (subject_id, group_name),
    CONSTRAINT fk_peer_group_subject FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_peer_group_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS peer_group_members (
    group_id INT NOT NULL,
    user_id INT NOT NULL,
    member_role ENUM('member','moderator') NOT NULL DEFAULT 'member',
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (group_id, user_id),
    CONSTRAINT fk_peer_member_group FOREIGN KEY (group_id) REFERENCES peer_groups(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_peer_member_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS peer_posts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    group_id INT NOT NULL,
    author_user_id INT NOT NULL,
    title VARCHAR(180) NOT NULL,
    body TEXT NOT NULL,
    status ENUM('visible','hidden') NOT NULL DEFAULT 'visible',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_peer_post_group FOREIGN KEY (group_id) REFERENCES peer_groups(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_peer_post_author FOREIGN KEY (author_user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS peer_comments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    post_id INT NOT NULL,
    author_user_id INT NOT NULL,
    body TEXT NOT NULL,
    status ENUM('visible','hidden') NOT NULL DEFAULT 'visible',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_peer_comment_post FOREIGN KEY (post_id) REFERENCES peer_posts(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_peer_comment_author FOREIGN KEY (author_user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
);

SHOW TABLES;
