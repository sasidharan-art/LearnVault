USE defaultdb;

CREATE TABLE IF NOT EXISTS live_classes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  faculty_user_id INT NOT NULL,
  subject_id INT NULL,
  course_id INT NULL,
  course_level_id INT NULL,
  title VARCHAR(180) NOT NULL,
  description TEXT NULL,
  meeting_url TEXT NULL,
  starts_at DATETIME NOT NULL,
  ends_at DATETIME NULL,
  status ENUM('scheduled','live','completed','cancelled') NOT NULL DEFAULT 'scheduled',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_live_classes_faculty (faculty_user_id, starts_at),
  INDEX idx_live_classes_subject (subject_id, starts_at),
  INDEX idx_live_classes_course (course_id, course_level_id, starts_at),
  INDEX idx_live_classes_status (status, starts_at),
  CONSTRAINT fk_live_class_faculty FOREIGN KEY (faculty_user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_live_class_subject FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_live_class_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_live_class_level FOREIGN KEY (course_level_id) REFERENCES course_levels(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
