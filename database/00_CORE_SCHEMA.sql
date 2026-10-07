USE defaultdb;

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS=0;

CREATE TABLE IF NOT EXISTS roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  role_name VARCHAR(50) NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  role_id INT NOT NULL,
  full_name VARCHAR(160) NOT NULL,
  username VARCHAR(80) NOT NULL UNIQUE,
  email VARCHAR(190) NOT NULL UNIQUE,
  phone VARCHAR(30) NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  status ENUM('active','inactive','suspended') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_role (role_id),
  INDEX idx_users_status (status),
  CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS education_domains (
  id INT AUTO_INCREMENT PRIMARY KEY,
  domain_name VARCHAR(150) NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS departments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  department_code VARCHAR(50) NOT NULL UNIQUE,
  department_name VARCHAR(180) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS courses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  domain_id INT NULL,
  department_id INT NULL,
  course_code VARCHAR(80) NOT NULL UNIQUE,
  course_name VARCHAR(220) NOT NULL,
  duration_years DECIMAL(4,1) NULL,
  structure_type VARCHAR(60) NOT NULL DEFAULT 'flexible',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_courses_domain (domain_id),
  INDEX idx_courses_department (department_id),
  CONSTRAINT fk_courses_domain FOREIGN KEY (domain_id) REFERENCES education_domains(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_courses_department FOREIGN KEY (department_id) REFERENCES departments(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS subjects (
  id INT AUTO_INCREMENT PRIMARY KEY,
  course_id INT NOT NULL,
  subject_code VARCHAR(80) NOT NULL,
  subject_name VARCHAR(220) NOT NULL,
  study_year INT NULL,
  semester INT NULL,
  level_name VARCHAR(100) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_subject_course_code (course_id, subject_code),
  INDEX idx_subject_course (course_id),
  CONSTRAINT fk_subject_course FOREIGN KEY (course_id) REFERENCES courses(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS student_profiles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  course_id INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_student_profile_user FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_student_profile_course_base FOREIGN KEY (course_id) REFERENCES courses(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS faculty_profiles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  department VARCHAR(180) NULL,
  designation VARCHAR(180) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_faculty_profile_user FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS=1;

INSERT IGNORE INTO roles (role_name) VALUES ('admin'),('faculty'),('student');

INSERT IGNORE INTO education_domains (domain_name) VALUES
('Engineering'),('Science'),('Management'),('Arts'),('Commerce'),
('Medical'),('Law'),('Design'),('School Education'),('Skill Development');

INSERT IGNORE INTO departments (department_code,department_name) VALUES
('CSE','Computer Science and Engineering'),
('ECE','Electronics and Communication Engineering'),
('EEE','Electrical and Electronics Engineering'),
('MECH','Mechanical Engineering'),
('BIO','Bioinformatics');

INSERT IGNORE INTO courses
(domain_id,department_id,course_code,course_name,duration_years,structure_type)
SELECT ed.id,d.id,'BTECH-CSE','B.Tech Computer Science and Engineering',4,'yearly'
FROM education_domains ed CROSS JOIN departments d
WHERE ed.domain_name='Engineering' AND d.department_code='CSE';

INSERT IGNORE INTO subjects
(course_id,subject_code,subject_name,study_year,semester,level_name)
SELECT c.id,x.code,x.name,x.yr,x.sem,x.level_name
FROM courses c
JOIN (
  SELECT 'DBMS' code,'Database Management Systems' name,2 yr,3 sem,'2nd Year' level_name
  UNION ALL SELECT 'OS','Operating Systems',2,4,'2nd Year'
  UNION ALL SELECT 'CN','Computer Networks',2,4,'2nd Year'
  UNION ALL SELECT 'DSA','Data Structures and Algorithms',2,3,'2nd Year'
  UNION ALL SELECT 'JAVA','Object Oriented Programming with Java',2,3,'2nd Year'
  UNION ALL SELECT 'BIOINFO','Bioinformatics Fundamentals',1,2,'1st Year'
) x
WHERE c.course_code='BTECH-CSE';

-- Demo accounts use bcrypt hash for the password: "password".
-- Change these credentials immediately for any real deployment.
INSERT IGNORE INTO users
(role_id,full_name,username,email,phone,password_hash,status)
SELECT r.id,'LearnVault Administrator','admin','admin@learnvault.local','9000000001',
'$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy','active'
FROM roles r WHERE r.role_name='admin';

INSERT IGNORE INTO users
(role_id,full_name,username,email,phone,password_hash,status)
SELECT r.id,'LearnVault Faculty','faculty','faculty@learnvault.local','9000000002',
'$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy','active'
FROM roles r WHERE r.role_name='faculty';

INSERT IGNORE INTO users
(role_id,full_name,username,email,phone,password_hash,status)
SELECT r.id,'LearnVault Student','student','student@learnvault.local','9000000003',
'$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy','active'
FROM roles r WHERE r.role_name='student';

INSERT IGNORE INTO faculty_profiles(user_id,department,designation)
SELECT u.id,'Computer Science and Engineering','Assistant Professor'
FROM users u WHERE u.username='faculty';

INSERT IGNORE INTO student_profiles(user_id,course_id)
SELECT u.id,c.id
FROM users u CROSS JOIN courses c
WHERE u.username='student' AND c.course_code='BTECH-CSE';
