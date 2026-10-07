USE learnvault_db;

/*
   LEARNVAULT - CENTRALIZED ACADEMIC CATALOG INITIALIZATION
   -------------------------------------------------------
   Adds configurable curriculum metadata and preloads a broad
   multi-domain academic catalog. Existing records are preserved.

   Run after the existing LearnVault academic migrations.
*/

CREATE TABLE IF NOT EXISTS course_semesters (
    id INT AUTO_INCREMENT PRIMARY KEY,
    course_id INT NOT NULL,
    course_level_id INT NULL,
    semester_name VARCHAR(100) NOT NULL,
    semester_number INT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_course_semester (course_id, course_level_id, semester_name),
    CONSTRAINT fk_course_semester_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_course_semester_level FOREIGN KEY (course_level_id) REFERENCES course_levels(id) ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS curriculum_versions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    course_id INT NOT NULL,
    course_level_id INT NULL,
    curriculum_name VARCHAR(180) NOT NULL,
    version_code VARCHAR(80) NOT NULL,
    academic_year_label VARCHAR(50) NULL,
    status ENUM('draft','active','archived') NOT NULL DEFAULT 'draft',
    syllabus_file_url VARCHAR(500) NULL,
    syllabus_file_name VARCHAR(255) NULL,
    notes TEXT NULL,
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_curriculum_version (course_id, version_code),
    CONSTRAINT fk_curriculum_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_curriculum_level FOREIGN KEY (course_level_id) REFERENCES course_levels(id) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_curriculum_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS curriculum_subjects (
    id INT AUTO_INCREMENT PRIMARY KEY,
    curriculum_id INT NOT NULL,
    subject_id INT NOT NULL,
    semester_id INT NULL,
    credits DECIMAL(5,2) NULL,
    is_core TINYINT(1) NOT NULL DEFAULT 1,
    learning_outcomes TEXT NULL,
    resource_requirements TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_curriculum_subject (curriculum_id, subject_id),
    CONSTRAINT fk_curriculum_subject_curriculum FOREIGN KEY (curriculum_id) REFERENCES curriculum_versions(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_curriculum_subject_subject FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_curriculum_subject_semester FOREIGN KEY (semester_id) REFERENCES course_semesters(id) ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS catalog_imports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(20) NOT NULL,
    status ENUM('processing','completed','failed') NOT NULL DEFAULT 'processing',
    imported_rows INT NOT NULL DEFAULT 0,
    created_domains INT NOT NULL DEFAULT 0,
    created_departments INT NOT NULL DEFAULT 0,
    created_courses INT NOT NULL DEFAULT 0,
    created_levels INT NOT NULL DEFAULT 0,
    created_semesters INT NOT NULL DEFAULT 0,
    created_subjects INT NOT NULL DEFAULT 0,
    error_report TEXT NULL,
    imported_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    CONSTRAINT fk_catalog_import_user FOREIGN KEY (imported_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS course_clone_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    source_course_id INT NOT NULL,
    cloned_course_id INT NOT NULL,
    cloned_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_clone_source FOREIGN KEY (source_course_id) REFERENCES courses(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_clone_target FOREIGN KEY (cloned_course_id) REFERENCES courses(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_clone_user FOREIGN KEY (cloned_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
);

/* =====================================================
   EDUCATION DOMAINS
===================================================== */
INSERT IGNORE INTO education_domains (domain_name, is_active) VALUES
('Architecture',1),('Arts',1),('Commerce',1),('Competitive Exams',1),('Design',1),
('Diploma / Polytechnic',1),('Engineering',1),('Law',1),('Management',1),('Medical',1),
('Professional Certifications',1),('School Education',1),('Science',1),('Skill Development',1);

/* =====================================================
   DEPARTMENTS
===================================================== */
INSERT IGNORE INTO departments (domain_id, department_code, department_name, is_active)
SELECT id,'ARCH','Architecture',1 FROM education_domains WHERE domain_name='Architecture';

INSERT IGNORE INTO departments (domain_id, department_code, department_name, is_active)
SELECT id,'ENG','English',1 FROM education_domains WHERE domain_name='Arts';
INSERT IGNORE INTO departments (domain_id, department_code, department_name, is_active)
SELECT id,'HIS','History',1 FROM education_domains WHERE domain_name='Arts';
INSERT IGNORE INTO departments (domain_id, department_code, department_name, is_active)
SELECT id,'ECO','Economics',1 FROM education_domains WHERE domain_name='Arts';
INSERT IGNORE INTO departments (domain_id, department_code, department_name, is_active)
SELECT id,'POL','Political Science',1 FROM education_domains WHERE domain_name='Arts';
INSERT IGNORE INTO departments (domain_id, department_code, department_name, is_active)
SELECT id,'SOC','Sociology',1 FROM education_domains WHERE domain_name='Arts';
INSERT IGNORE INTO departments (domain_id, department_code, department_name, is_active)
SELECT id,'PSY','Psychology',1 FROM education_domains WHERE domain_name='Arts';

INSERT IGNORE INTO departments (domain_id, department_code, department_name, is_active)
SELECT id,'COM','Commerce',1 FROM education_domains WHERE domain_name='Commerce';
INSERT IGNORE INTO departments (domain_id, department_code, department_name, is_active)
SELECT id,'ACC','Accounting',1 FROM education_domains WHERE domain_name='Commerce';
INSERT IGNORE INTO departments (domain_id, department_code, department_name, is_active)
SELECT id,'FIN','Finance',1 FROM education_domains WHERE domain_name='Commerce';
INSERT IGNORE INTO departments (domain_id, department_code, department_name, is_active)
SELECT id,'TAX','Taxation',1 FROM education_domains WHERE domain_name='Commerce';

INSERT IGNORE INTO departments (domain_id, department_code, department_name, is_active)
SELECT id,'GDES','Graphic Design',1 FROM education_domains WHERE domain_name='Design';
INSERT IGNORE INTO departments (domain_id, department_code, department_name, is_active)
SELECT id,'FDES','Fashion Design',1 FROM education_domains WHERE domain_name='Design';
INSERT IGNORE INTO departments (domain_id, department_code, department_name, is_active)
SELECT id,'PDES','Product Design',1 FROM education_domains WHERE domain_name='Design';
INSERT IGNORE INTO departments (domain_id, department_code, department_name, is_active)
SELECT id,'UXD','UI/UX Design',1 FROM education_domains WHERE domain_name='Design';

INSERT IGNORE INTO departments (domain_id, department_code, department_name, is_active)
SELECT id,'DME','Mechanical',1 FROM education_domains WHERE domain_name='Diploma / Polytechnic';
INSERT IGNORE INTO departments (domain_id, department_code, department_name, is_active)
SELECT id,'DCV','Civil',1 FROM education_domains WHERE domain_name='Diploma / Polytechnic';
INSERT IGNORE INTO departments (domain_id, department_code, department_name, is_active)
SELECT id,'DEEE','Electrical',1 FROM education_domains WHERE domain_name='Diploma / Polytechnic';
INSERT IGNORE INTO departments (domain_id, department_code, department_name, is_active)
SELECT id,'DCE','Computer Engineering',1 FROM education_domains WHERE domain_name='Diploma / Polytechnic';

INSERT IGNORE INTO departments (domain_id, department_code, department_name, is_active)
SELECT id,'CSE','Computer Science and Engineering',1 FROM education_domains WHERE domain_name='Engineering';
INSERT IGNORE INTO departments (domain_id, department_code, department_name, is_active)
SELECT id,'IT','Information Technology',1 FROM education_domains WHERE domain_name='Engineering';
INSERT IGNORE INTO departments (domain_id, department_code, department_name, is_active)
SELECT id,'AIDS','AI & Data Science',1 FROM education_domains WHERE domain_name='Engineering';
INSERT IGNORE INTO departments (domain_id, department_code, department_name, is_active)
SELECT id,'AIML','AI & Machine Learning',1 FROM education_domains WHERE domain_name='Engineering';
INSERT IGNORE INTO departments (domain_id, department_code, department_name, is_active)
SELECT id,'ECE','Electronics & Communication',1 FROM education_domains WHERE domain_name='Engineering';
INSERT IGNORE INTO departments (domain_id, department_code, department_name, is_active)
SELECT id,'EEE','Electrical & Electronics',1 FROM education_domains WHERE domain_name='Engineering';
INSERT IGNORE INTO departments (domain_id, department_code, department_name, is_active)
SELECT id,'MECH','Mechanical Engineering',1 FROM education_domains WHERE domain_name='Engineering';
INSERT IGNORE INTO departments (domain_id, department_code, department_name, is_active)
SELECT id,'CIVIL','Civil Engineering',1 FROM education_domains WHERE domain_name='Engineering';
INSERT IGNORE INTO departments (domain_id, department_code, department_name, is_active)
SELECT id,'BIO','Biotechnology',1 FROM education_domains WHERE domain_name='Engineering';
INSERT IGNORE INTO departments (domain_id, department_code, department_name, is_active)
SELECT id,'CHEM','Chemical Engineering',1 FROM education_domains WHERE domain_name='Engineering';

INSERT IGNORE INTO departments (domain_id, department_code, department_name, is_active)
SELECT id,'MATH','Mathematics',1 FROM education_domains WHERE domain_name='Science';
INSERT IGNORE INTO departments (domain_id, department_code, department_name, is_active)
SELECT id,'PHY','Physics',1 FROM education_domains WHERE domain_name='Science';
INSERT IGNORE INTO departments (domain_id, department_code, department_name, is_active)
SELECT id,'CHEM-SCI','Chemistry',1 FROM education_domains WHERE domain_name='Science';
INSERT IGNORE INTO departments (domain_id, department_code, department_name, is_active)
SELECT id,'STAT','Statistics',1 FROM education_domains WHERE domain_name='Science';
INSERT IGNORE INTO departments (domain_id, department_code, department_name, is_active)
SELECT id,'DSCI','Data Science',1 FROM education_domains WHERE domain_name='Science';

/* =====================================================
   COURSES
===================================================== */
/* Architecture */
INSERT IGNORE INTO courses (domain_id,department_id,course_code,course_name,duration_years,structure_type,is_active)
SELECT ed.id,d.id,'BARCH','B.Arch',5,'year_semester',1 FROM education_domains ed JOIN departments d ON d.domain_id=ed.id AND d.department_code='ARCH' WHERE ed.domain_name='Architecture';
INSERT IGNORE INTO courses (domain_id,department_id,course_code,course_name,duration_years,structure_type,is_active)
SELECT ed.id,d.id,'MARCH','M.Arch',2,'year_semester',1 FROM education_domains ed JOIN departments d ON d.domain_id=ed.id AND d.department_code='ARCH' WHERE ed.domain_name='Architecture';

/* Arts */
INSERT IGNORE INTO courses (domain_id,department_id,course_code,course_name,duration_years,structure_type,is_active)
SELECT ed.id,d.id,'BA-ENG','BA English',3,'year_semester',1 FROM education_domains ed JOIN departments d ON d.domain_id=ed.id AND d.department_code='ENG' WHERE ed.domain_name='Arts';
INSERT IGNORE INTO courses (domain_id,department_id,course_code,course_name,duration_years,structure_type,is_active)
SELECT ed.id,d.id,'BA-ECO','BA Economics',3,'year_semester',1 FROM education_domains ed JOIN departments d ON d.domain_id=ed.id AND d.department_code='ECO' WHERE ed.domain_name='Arts';
INSERT IGNORE INTO courses (domain_id,department_id,course_code,course_name,duration_years,structure_type,is_active)
SELECT ed.id,d.id,'BA-HIS','BA History',3,'year_semester',1 FROM education_domains ed JOIN departments d ON d.domain_id=ed.id AND d.department_code='HIS' WHERE ed.domain_name='Arts';
INSERT IGNORE INTO courses (domain_id,department_id,course_code,course_name,duration_years,structure_type,is_active)
SELECT ed.id,d.id,'BA-POL','BA Political Science',3,'year_semester',1 FROM education_domains ed JOIN departments d ON d.domain_id=ed.id AND d.department_code='POL' WHERE ed.domain_name='Arts';
INSERT IGNORE INTO courses (domain_id,department_id,course_code,course_name,duration_years,structure_type,is_active)
SELECT ed.id,d.id,'MA-GENERAL','MA Programs',2,'year_semester',1 FROM education_domains ed JOIN departments d ON d.domain_id=ed.id AND d.department_code='ENG' WHERE ed.domain_name='Arts';

/* Commerce */
INSERT IGNORE INTO courses (domain_id,department_id,course_code,course_name,duration_years,structure_type,is_active)
SELECT ed.id,d.id,'BCOM','B.Com',3,'year_semester',1 FROM education_domains ed JOIN departments d ON d.domain_id=ed.id AND d.department_code='COM' WHERE ed.domain_name='Commerce';
INSERT IGNORE INTO courses (domain_id,department_id,course_code,course_name,duration_years,structure_type,is_active)
SELECT ed.id,d.id,'BCOM-AF','B.Com Accounting & Finance',3,'year_semester',1 FROM education_domains ed JOIN departments d ON d.domain_id=ed.id AND d.department_code='ACC' WHERE ed.domain_name='Commerce';
INSERT IGNORE INTO courses (domain_id,department_id,course_code,course_name,duration_years,structure_type,is_active)
SELECT ed.id,d.id,'MCOM','M.Com',2,'year_semester',1 FROM education_domains ed JOIN departments d ON d.domain_id=ed.id AND d.department_code='FIN' WHERE ed.domain_name='Commerce';

/* Competitive exams */
INSERT IGNORE INTO courses (domain_id,department_id,course_code,course_name,duration_years,structure_type,is_active)
SELECT id,NULL,'UPSC','UPSC',NULL,'exam',1 FROM education_domains WHERE domain_name='Competitive Exams';
INSERT IGNORE INTO courses (domain_id,department_id,course_code,course_name,duration_years,structure_type,is_active)
SELECT id,NULL,'SSC','SSC',NULL,'exam',1 FROM education_domains WHERE domain_name='Competitive Exams';
INSERT IGNORE INTO courses (domain_id,department_id,course_code,course_name,duration_years,structure_type,is_active)
SELECT id,NULL,'BANKING','Banking',NULL,'exam',1 FROM education_domains WHERE domain_name='Competitive Exams';
INSERT IGNORE INTO courses (domain_id,department_id,course_code,course_name,duration_years,structure_type,is_active)
SELECT id,NULL,'TNPSC','TNPSC',NULL,'exam',1 FROM education_domains WHERE domain_name='Competitive Exams';
INSERT IGNORE INTO courses (domain_id,department_id,course_code,course_name,duration_years,structure_type,is_active)
SELECT id,NULL,'RAILWAY','Railway Exams',NULL,'exam',1 FROM education_domains WHERE domain_name='Competitive Exams';
INSERT IGNORE INTO courses (domain_id,department_id,course_code,course_name,duration_years,structure_type,is_active)
SELECT id,NULL,'CAT','CAT',NULL,'exam',1 FROM education_domains WHERE domain_name='Competitive Exams';
INSERT IGNORE INTO courses (domain_id,department_id,course_code,course_name,duration_years,structure_type,is_active)
SELECT id,NULL,'GATE','GATE',NULL,'exam',1 FROM education_domains WHERE domain_name='Competitive Exams';
INSERT IGNORE INTO courses (domain_id,department_id,course_code,course_name,duration_years,structure_type,is_active)
SELECT id,NULL,'GRE','GRE',NULL,'exam',1 FROM education_domains WHERE domain_name='Competitive Exams';
INSERT IGNORE INTO courses (domain_id,department_id,course_code,course_name,duration_years,structure_type,is_active)
SELECT id,NULL,'IELTS','IELTS',NULL,'exam',1 FROM education_domains WHERE domain_name='Competitive Exams';

/* Design */
INSERT IGNORE INTO courses (domain_id,department_id,course_code,course_name,duration_years,structure_type,is_active)
SELECT ed.id,d.id,'BDES','B.Des',4,'year_semester',1 FROM education_domains ed JOIN departments d ON d.domain_id=ed.id AND d.department_code='GDES' WHERE ed.domain_name='Design';
INSERT IGNORE INTO courses (domain_id,department_id,course_code,course_name,duration_years,structure_type,is_active)
SELECT ed.id,d.id,'MDES','M.Des',2,'year_semester',1 FROM education_domains ed JOIN departments d ON d.domain_id=ed.id AND d.department_code='PDES' WHERE ed.domain_name='Design';

/* Diploma */
INSERT IGNORE INTO courses (domain_id,department_id,course_code,course_name,duration_years,structure_type,is_active)
SELECT ed.id,d.id,'DME','Diploma Mechanical Engineering',3,'year_semester',1 FROM education_domains ed JOIN departments d ON d.domain_id=ed.id AND d.department_code='DME' WHERE ed.domain_name='Diploma / Polytechnic';
INSERT IGNORE INTO courses (domain_id,department_id,course_code,course_name,duration_years,structure_type,is_active)
SELECT ed.id,d.id,'DCIVIL','Diploma Civil Engineering',3,'year_semester',1 FROM education_domains ed JOIN departments d ON d.domain_id=ed.id AND d.department_code='DCV' WHERE ed.domain_name='Diploma / Polytechnic';
INSERT IGNORE INTO courses (domain_id,department_id,course_code,course_name,duration_years,structure_type,is_active)
SELECT ed.id,d.id,'DEEE','Diploma EEE',3,'year_semester',1 FROM education_domains ed JOIN departments d ON d.domain_id=ed.id AND d.department_code='DEEE' WHERE ed.domain_name='Diploma / Polytechnic';
INSERT IGNORE INTO courses (domain_id,department_id,course_code,course_name,duration_years,structure_type,is_active)
SELECT ed.id,d.id,'DCE','Diploma Computer Engineering',3,'year_semester',1 FROM education_domains ed JOIN departments d ON d.domain_id=ed.id AND d.department_code='DCE' WHERE ed.domain_name='Diploma / Polytechnic';

/* Engineering: B.Tech, B.E, M.Tech, M.E for each listed department */
INSERT IGNORE INTO courses (domain_id,department_id,course_code,course_name,duration_years,structure_type,is_active)
SELECT ed.id,d.id,CONCAT('BTECH-',d.department_code),'B.Tech',4,'year_semester',1 FROM education_domains ed JOIN departments d ON d.domain_id=ed.id WHERE ed.domain_name='Engineering';
INSERT IGNORE INTO courses (domain_id,department_id,course_code,course_name,duration_years,structure_type,is_active)
SELECT ed.id,d.id,CONCAT('BE-',d.department_code),'B.E',4,'year_semester',1 FROM education_domains ed JOIN departments d ON d.domain_id=ed.id WHERE ed.domain_name='Engineering';
INSERT IGNORE INTO courses (domain_id,department_id,course_code,course_name,duration_years,structure_type,is_active)
SELECT ed.id,d.id,CONCAT('MTECH-',d.department_code),'M.Tech',2,'year_semester',1 FROM education_domains ed JOIN departments d ON d.domain_id=ed.id WHERE ed.domain_name='Engineering';
INSERT IGNORE INTO courses (domain_id,department_id,course_code,course_name,duration_years,structure_type,is_active)
SELECT ed.id,d.id,CONCAT('ME-',d.department_code),'M.E',2,'year_semester',1 FROM education_domains ed JOIN departments d ON d.domain_id=ed.id WHERE ed.domain_name='Engineering';

/* Law */
INSERT IGNORE INTO courses (domain_id,department_id,course_code,course_name,duration_years,structure_type,is_active)
SELECT id,NULL,'LLB','LLB',3,'year_semester',1 FROM education_domains WHERE domain_name='Law';
INSERT IGNORE INTO courses (domain_id,department_id,course_code,course_name,duration_years,structure_type,is_active)
SELECT id,NULL,'BALLB','BA LLB',5,'year_semester',1 FROM education_domains WHERE domain_name='Law';
INSERT IGNORE INTO courses (domain_id,department_id,course_code,course_name,duration_years,structure_type,is_active)
SELECT id,NULL,'BBALLB','BBA LLB',5,'year_semester',1 FROM education_domains WHERE domain_name='Law';
INSERT IGNORE INTO courses (domain_id,department_id,course_code,course_name,duration_years,structure_type,is_active)
SELECT id,NULL,'LLM','LLM',2,'year_semester',1 FROM education_domains WHERE domain_name='Law';

/* Management */
INSERT IGNORE INTO courses (domain_id,department_id,course_code,course_name,duration_years,structure_type,is_active)
SELECT id,NULL,'BBA','BBA',3,'year_semester',1 FROM education_domains WHERE domain_name='Management';
INSERT IGNORE INTO courses (domain_id,department_id,course_code,course_name,duration_years,structure_type,is_active)
SELECT id,NULL,'MBA','MBA',2,'year_semester',1 FROM education_domains WHERE domain_name='Management';
INSERT IGNORE INTO courses (domain_id,department_id,course_code,course_name,duration_years,structure_type,is_active)
SELECT id,NULL,'EMBA','Executive MBA',1,'year_semester',1 FROM education_domains WHERE domain_name='Management';

/* Medical */
INSERT IGNORE INTO courses (domain_id,department_id,course_code,course_name,duration_years,structure_type,is_active)
SELECT id,NULL,'MBBS','MBBS',5.5,'year_semester',1 FROM education_domains WHERE domain_name='Medical';
INSERT IGNORE INTO courses (domain_id,department_id,course_code,course_name,duration_years,structure_type,is_active)
SELECT id,NULL,'BDS','BDS',5,'year_semester',1 FROM education_domains WHERE domain_name='Medical';
INSERT IGNORE INTO courses (domain_id,department_id,course_code,course_name,duration_years,structure_type,is_active)
SELECT id,NULL,'BPHARM','B.Pharm',4,'year_semester',1 FROM education_domains WHERE domain_name='Medical';
INSERT IGNORE INTO courses (domain_id,department_id,course_code,course_name,duration_years,structure_type,is_active)
SELECT id,NULL,'PHARMD','Pharm.D',6,'year_semester',1 FROM education_domains WHERE domain_name='Medical';
INSERT IGNORE INTO courses (domain_id,department_id,course_code,course_name,duration_years,structure_type,is_active)
SELECT id,NULL,'BSCNURSING','B.Sc Nursing',4,'year_semester',1 FROM education_domains WHERE domain_name='Medical';
INSERT IGNORE INTO courses (domain_id,department_id,course_code,course_name,duration_years,structure_type,is_active)
SELECT id,NULL,'MPHARM','M.Pharm',2,'year_semester',1 FROM education_domains WHERE domain_name='Medical';

/* Professional Certifications */
INSERT IGNORE INTO courses (domain_id,department_id,course_code,course_name,duration_years,structure_type,is_active)
SELECT id,NULL,'AWS','AWS',NULL,'module',1 FROM education_domains WHERE domain_name='Professional Certifications';
INSERT IGNORE INTO courses (domain_id,department_id,course_code,course_name,duration_years,structure_type,is_active)
SELECT id,NULL,'AZURE','Azure',NULL,'module',1 FROM education_domains WHERE domain_name='Professional Certifications';
INSERT IGNORE INTO courses (domain_id,department_id,course_code,course_name,duration_years,structure_type,is_active)
SELECT id,NULL,'GCP','Google Cloud',NULL,'module',1 FROM education_domains WHERE domain_name='Professional Certifications';
INSERT IGNORE INTO courses (domain_id,department_id,course_code,course_name,duration_years,structure_type,is_active)
SELECT id,NULL,'CCNA','Cisco CCNA',NULL,'module',1 FROM education_domains WHERE domain_name='Professional Certifications';
INSERT IGNORE INTO courses (domain_id,department_id,course_code,course_name,duration_years,structure_type,is_active)
SELECT id,NULL,'PMP','PMP',NULL,'module',1 FROM education_domains WHERE domain_name='Professional Certifications';
INSERT IGNORE INTO courses (domain_id,department_id,course_code,course_name,duration_years,structure_type,is_active)
SELECT id,NULL,'SCRUM','Scrum Master',NULL,'module',1 FROM education_domains WHERE domain_name='Professional Certifications';
INSERT IGNORE INTO courses (domain_id,department_id,course_code,course_name,duration_years,structure_type,is_active)
SELECT id,NULL,'MS-CERT','Microsoft Certifications',NULL,'module',1 FROM education_domains WHERE domain_name='Professional Certifications';

/* School */
INSERT IGNORE INTO courses (domain_id,department_id,course_code,course_name,duration_years,structure_type,is_active)
SELECT id,NULL,'SCHOOL-G1-12','Grade 1 to Grade 12',12,'grade',1 FROM education_domains WHERE domain_name='School Education';

/* Science */
INSERT IGNORE INTO courses (domain_id,department_id,course_code,course_name,duration_years,structure_type,is_active)
SELECT ed.id,d.id,'BSC','B.Sc',3,'year_semester',1 FROM education_domains ed JOIN departments d ON d.domain_id=ed.id AND d.department_code='MATH' WHERE ed.domain_name='Science';
INSERT IGNORE INTO courses (domain_id,department_id,course_code,course_name,duration_years,structure_type,is_active)
SELECT ed.id,d.id,'MSC','M.Sc',2,'year_semester',1 FROM education_domains ed JOIN departments d ON d.domain_id=ed.id AND d.department_code='PHY' WHERE ed.domain_name='Science';

/* Skill Development */
INSERT IGNORE INTO courses (domain_id,department_id,course_code,course_name,duration_years,structure_type,is_active)
SELECT id,NULL,'FULLSTACK','Full Stack Development',NULL,'module',1 FROM education_domains WHERE domain_name='Skill Development';
INSERT IGNORE INTO courses (domain_id,department_id,course_code,course_name,duration_years,structure_type,is_active)
SELECT id,NULL,'DATA-ANALYTICS','Data Analytics',NULL,'module',1 FROM education_domains WHERE domain_name='Skill Development';
INSERT IGNORE INTO courses (domain_id,department_id,course_code,course_name,duration_years,structure_type,is_active)
SELECT id,NULL,'CYBER-SEC','Cyber Security',NULL,'module',1 FROM education_domains WHERE domain_name='Skill Development';
INSERT IGNORE INTO courses (domain_id,department_id,course_code,course_name,duration_years,structure_type,is_active)
SELECT id,NULL,'AI-ML-SKILL','AI & Machine Learning',NULL,'module',1 FROM education_domains WHERE domain_name='Skill Development';
INSERT IGNORE INTO courses (domain_id,department_id,course_code,course_name,duration_years,structure_type,is_active)
SELECT id,NULL,'DIGITAL-MKT','Digital Marketing',NULL,'module',1 FROM education_domains WHERE domain_name='Skill Development';
INSERT IGNORE INTO courses (domain_id,department_id,course_code,course_name,duration_years,structure_type,is_active)
SELECT id,NULL,'UIUX-SKILL','UI/UX Design',NULL,'module',1 FROM education_domains WHERE domain_name='Skill Development';
INSERT IGNORE INTO courses (domain_id,department_id,course_code,course_name,duration_years,structure_type,is_active)
SELECT id,NULL,'COMM-SKILL','Communication Skills',NULL,'module',1 FROM education_domains WHERE domain_name='Skill Development';
INSERT IGNORE INTO courses (domain_id,department_id,course_code,course_name,duration_years,structure_type,is_active)
SELECT id,NULL,'SOFT-SKILL','Soft Skills',NULL,'module',1 FROM education_domains WHERE domain_name='Skill Development';

/* =====================================================
   STANDARD LEVELS / YEARS
===================================================== */
INSERT IGNORE INTO course_levels (course_id,level_name,level_order,is_active)
SELECT id,CONCAT('Year ',n),n,1 FROM courses JOIN (SELECT 1 n UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6) nums
WHERE course_code IN ('BARCH') AND n <= 5;
INSERT IGNORE INTO course_levels (course_id,level_name,level_order,is_active)
SELECT id,CONCAT('Year ',n),n,1 FROM courses JOIN (SELECT 1 n UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5) nums
WHERE duration_years = 5 AND structure_type='year_semester' AND course_code NOT IN ('BARCH');

INSERT IGNORE INTO course_levels (course_id,level_name,level_order,is_active)
SELECT id,CONCAT('Year ',n),n,1 FROM courses JOIN (SELECT 1 n UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4) nums
WHERE duration_years >= 4 AND structure_type='year_semester' AND course_code NOT IN ('BARCH','MBBS','BDS','PHARMD');
INSERT IGNORE INTO course_levels (course_id,level_name,level_order,is_active)
SELECT id,CONCAT('Year ',n),n,1 FROM courses JOIN (SELECT 1 n UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6) nums
WHERE course_code IN ('MBBS','PHARMD') AND n <= ROUND(duration_years);
INSERT IGNORE INTO course_levels (course_id,level_name,level_order,is_active)
SELECT id,CONCAT('Year ',n),n,1 FROM courses JOIN (SELECT 1 n UNION ALL SELECT 2 UNION ALL SELECT 3) nums
WHERE duration_years = 3 AND structure_type='year_semester';
INSERT IGNORE INTO course_levels (course_id,level_name,level_order,is_active)
SELECT id,CONCAT('Year ',n),n,1 FROM courses JOIN (SELECT 1 n UNION ALL SELECT 2) nums
WHERE duration_years = 2 AND structure_type='year_semester';
INSERT IGNORE INTO course_levels (course_id,level_name,level_order,is_active)
SELECT id,'Year 1',1,1 FROM courses WHERE duration_years = 1 AND structure_type='year_semester';
INSERT IGNORE INTO course_levels (course_id,level_name,level_order,is_active)
SELECT id,CONCAT('Class ',n),n,1 FROM courses JOIN (SELECT 1 n UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9 UNION ALL SELECT 10 UNION ALL SELECT 11 UNION ALL SELECT 12) nums
WHERE course_code='SCHOOL-G1-12';
INSERT IGNORE INTO course_levels (course_id,level_name,level_order,is_active)
SELECT id,'Prelims',1,1 FROM courses WHERE course_code IN ('UPSC','SSC','BANKING','TNPSC','RAILWAY','CAT','GATE','GRE','IELTS');
INSERT IGNORE INTO course_levels (course_id,level_name,level_order,is_active)
SELECT id,'Mains / Advanced',2,1 FROM courses WHERE course_code IN ('UPSC','SSC','BANKING','TNPSC','RAILWAY','CAT','GATE','GRE','IELTS');
INSERT IGNORE INTO course_levels (course_id,level_name,level_order,is_active)
SELECT id,'Beginner',1,1 FROM courses WHERE domain_id=(SELECT id FROM education_domains WHERE domain_name='Skill Development');
INSERT IGNORE INTO course_levels (course_id,level_name,level_order,is_active)
SELECT id,'Intermediate',2,1 FROM courses WHERE domain_id=(SELECT id FROM education_domains WHERE domain_name='Skill Development');
INSERT IGNORE INTO course_levels (course_id,level_name,level_order,is_active)
SELECT id,'Advanced',3,1 FROM courses WHERE domain_id=(SELECT id FROM education_domains WHERE domain_name='Skill Development');
INSERT IGNORE INTO course_levels (course_id,level_name,level_order,is_active)
SELECT id,'Foundation',1,1 FROM courses WHERE domain_id=(SELECT id FROM education_domains WHERE domain_name='Professional Certifications');
INSERT IGNORE INTO course_levels (course_id,level_name,level_order,is_active)
SELECT id,'Advanced',2,1 FROM courses WHERE domain_id=(SELECT id FROM education_domains WHERE domain_name='Professional Certifications');

/* =====================================================
   SEMESTERS / TERMS
===================================================== */
INSERT IGNORE INTO course_semesters (course_id,course_level_id,semester_name,semester_number,is_active)
SELECT c.id,cl.id,'Semester 1',1,1 FROM courses c JOIN course_levels cl ON cl.course_id=c.id AND cl.level_name LIKE 'Year %' WHERE c.structure_type='year_semester';
INSERT IGNORE INTO course_semesters (course_id,course_level_id,semester_name,semester_number,is_active)
SELECT c.id,cl.id,'Semester 2',2,1 FROM courses c JOIN course_levels cl ON cl.course_id=c.id AND cl.level_name LIKE 'Year %' WHERE c.structure_type='year_semester';
INSERT IGNORE INTO course_semesters (course_id,course_level_id,semester_name,semester_number,is_active)
SELECT c.id,cl.id,'Term 1',1,1 FROM courses c JOIN course_levels cl ON cl.course_id=c.id AND cl.level_name LIKE 'Class %' WHERE c.structure_type='grade';
INSERT IGNORE INTO course_semesters (course_id,course_level_id,semester_name,semester_number,is_active)
SELECT c.id,cl.id,'Term 2',2,1 FROM courses c JOIN course_levels cl ON cl.course_id=c.id AND cl.level_name LIKE 'Class %' WHERE c.structure_type='grade';

/* =====================================================
   SUBJECTS - ARCHITECTURE
===================================================== */
INSERT IGNORE INTO subjects (course_id,course_level_id,subject_code,subject_name,study_year,semester,level_name,is_active)
SELECT c.id,NULL,CONCAT(c.course_code,'-ARCDES'),'Architectural Design',NULL,NULL,NULL,1 FROM courses c WHERE c.course_code IN ('BARCH','MARCH');
INSERT IGNORE INTO subjects (course_id,course_level_id,subject_code,subject_name,study_year,semester,level_name,is_active)
SELECT c.id,NULL,CONCAT(c.course_code,'-BLDMAT'),'Building Materials',NULL,NULL,NULL,1 FROM courses c WHERE c.course_code IN ('BARCH','MARCH');
INSERT IGNORE INTO subjects (course_id,course_level_id,subject_code,subject_name,study_year,semester,level_name,is_active)
SELECT c.id,NULL,CONCAT(c.course_code,'-BLDCON'),'Building Construction',NULL,NULL,NULL,1 FROM courses c WHERE c.course_code IN ('BARCH','MARCH');
INSERT IGNORE INTO subjects (course_id,course_level_id,subject_code,subject_name,study_year,semester,level_name,is_active)
SELECT c.id,NULL,CONCAT(c.course_code,'-STRSYS'),'Structural Systems',NULL,NULL,NULL,1 FROM courses c WHERE c.course_code IN ('BARCH','MARCH');
INSERT IGNORE INTO subjects (course_id,course_level_id,subject_code,subject_name,study_year,semester,level_name,is_active)
SELECT c.id,NULL,CONCAT(c.course_code,'-URBPLAN'),'Urban Planning',NULL,NULL,NULL,1 FROM courses c WHERE c.course_code IN ('BARCH','MARCH');
INSERT IGNORE INTO subjects (course_id,course_level_id,subject_code,subject_name,study_year,semester,level_name,is_active)
SELECT c.id,NULL,CONCAT(c.course_code,'-LANDARC'),'Landscape Architecture',NULL,NULL,NULL,1 FROM courses c WHERE c.course_code IN ('BARCH','MARCH');
INSERT IGNORE INTO subjects (course_id,course_level_id,subject_code,subject_name,study_year,semester,level_name,is_active)
SELECT c.id,NULL,CONCAT(c.course_code,'-SUSARC'),'Sustainable Architecture',NULL,NULL,NULL,1 FROM courses c WHERE c.course_code IN ('BARCH','MARCH');
INSERT IGNORE INTO subjects (course_id,course_level_id,subject_code,subject_name,study_year,semester,level_name,is_active)
SELECT c.id,NULL,CONCAT(c.course_code,'-INTDES'),'Interior Design',NULL,NULL,NULL,1 FROM courses c WHERE c.course_code IN ('BARCH','MARCH');

/* Generic sample subjects for Arts */
INSERT IGNORE INTO subjects (course_id,course_level_id,subject_code,subject_name,is_active)
SELECT c.id,NULL,CONCAT(c.course_code,'-LIT'),'Literature',1 FROM courses c WHERE c.course_code IN ('BA-ENG','BA-ECO','BA-HIS','BA-POL','MA-GENERAL');
INSERT IGNORE INTO subjects (course_id,course_level_id,subject_code,subject_name,is_active)
SELECT c.id,NULL,CONCAT(c.course_code,'-CW'),'Creative Writing',1 FROM courses c WHERE c.domain_id=(SELECT id FROM education_domains WHERE domain_name='Arts');
INSERT IGNORE INTO subjects (course_id,course_level_id,subject_code,subject_name,is_active)
SELECT c.id,NULL,CONCAT(c.course_code,'-WH'),'World History',1 FROM courses c WHERE c.domain_id=(SELECT id FROM education_domains WHERE domain_name='Arts');
INSERT IGNORE INTO subjects (course_id,course_level_id,subject_code,subject_name,is_active)
SELECT c.id,NULL,CONCAT(c.course_code,'-MACRO'),'Macroeconomics',1 FROM courses c WHERE c.domain_id=(SELECT id FROM education_domains WHERE domain_name='Arts');
INSERT IGNORE INTO subjects (course_id,course_level_id,subject_code,subject_name,is_active)
SELECT c.id,NULL,CONCAT(c.course_code,'-MICRO'),'Microeconomics',1 FROM courses c WHERE c.domain_id=(SELECT id FROM education_domains WHERE domain_name='Arts');
INSERT IGNORE INTO subjects (course_id,course_level_id,subject_code,subject_name,is_active)
SELECT c.id,NULL,CONCAT(c.course_code,'-SOCIAL'),'Social Theory',1 FROM courses c WHERE c.domain_id=(SELECT id FROM education_domains WHERE domain_name='Arts');
INSERT IGNORE INTO subjects (course_id,course_level_id,subject_code,subject_name,is_active)
SELECT c.id,NULL,CONCAT(c.course_code,'-RES'),'Research Methods',1 FROM courses c WHERE c.domain_id=(SELECT id FROM education_domains WHERE domain_name='Arts');

/* Commerce */
INSERT IGNORE INTO subjects (course_id,course_level_id,subject_code,subject_name,is_active)
SELECT c.id,NULL,CONCAT(c.course_code,'-FA'),'Financial Accounting',1 FROM courses c WHERE c.domain_id=(SELECT id FROM education_domains WHERE domain_name='Commerce');
INSERT IGNORE INTO subjects (course_id,course_level_id,subject_code,subject_name,is_active)
SELECT c.id,NULL,CONCAT(c.course_code,'-CA'),'Cost Accounting',1 FROM courses c WHERE c.domain_id=(SELECT id FROM education_domains WHERE domain_name='Commerce');
INSERT IGNORE INTO subjects (course_id,course_level_id,subject_code,subject_name,is_active)
SELECT c.id,NULL,CONCAT(c.course_code,'-AUD'),'Auditing',1 FROM courses c WHERE c.domain_id=(SELECT id FROM education_domains WHERE domain_name='Commerce');
INSERT IGNORE INTO subjects (course_id,course_level_id,subject_code,subject_name,is_active)
SELECT c.id,NULL,CONCAT(c.course_code,'-BL'),'Business Law',1 FROM courses c WHERE c.domain_id=(SELECT id FROM education_domains WHERE domain_name='Commerce');
INSERT IGNORE INTO subjects (course_id,course_level_id,subject_code,subject_name,is_active)
SELECT c.id,NULL,CONCAT(c.course_code,'-TAX'),'Taxation',1 FROM courses c WHERE c.domain_id=(SELECT id FROM education_domains WHERE domain_name='Commerce');
INSERT IGNORE INTO subjects (course_id,course_level_id,subject_code,subject_name,is_active)
SELECT c.id,NULL,CONCAT(c.course_code,'-CORP'),'Corporate Accounting',1 FROM courses c WHERE c.domain_id=(SELECT id FROM education_domains WHERE domain_name='Commerce');
INSERT IGNORE INTO subjects (course_id,course_level_id,subject_code,subject_name,is_active)
SELECT c.id,NULL,CONCAT(c.course_code,'-FM'),'Financial Management',1 FROM courses c WHERE c.domain_id=(SELECT id FROM education_domains WHERE domain_name='Commerce');

/* Competitive Exams */
INSERT IGNORE INTO subjects (course_id,course_level_id,subject_code,subject_name,is_active)
SELECT c.id,NULL,CONCAT(c.course_code,'-APT'),'Aptitude',1 FROM courses c WHERE c.domain_id=(SELECT id FROM education_domains WHERE domain_name='Competitive Exams');
INSERT IGNORE INTO subjects (course_id,course_level_id,subject_code,subject_name,is_active)
SELECT c.id,NULL,CONCAT(c.course_code,'-REAS'),'Reasoning',1 FROM courses c WHERE c.domain_id=(SELECT id FROM education_domains WHERE domain_name='Competitive Exams');
INSERT IGNORE INTO subjects (course_id,course_level_id,subject_code,subject_name,is_active)
SELECT c.id,NULL,CONCAT(c.course_code,'-GS'),'General Studies',1 FROM courses c WHERE c.domain_id=(SELECT id FROM education_domains WHERE domain_name='Competitive Exams');
INSERT IGNORE INTO subjects (course_id,course_level_id,subject_code,subject_name,is_active)
SELECT c.id,NULL,CONCAT(c.course_code,'-CA'),'Current Affairs',1 FROM courses c WHERE c.domain_id=(SELECT id FROM education_domains WHERE domain_name='Competitive Exams');
INSERT IGNORE INTO subjects (course_id,course_level_id,subject_code,subject_name,is_active)
SELECT c.id,NULL,CONCAT(c.course_code,'-ENG'),'English',1 FROM courses c WHERE c.domain_id=(SELECT id FROM education_domains WHERE domain_name='Competitive Exams');
INSERT IGNORE INTO subjects (course_id,course_level_id,subject_code,subject_name,is_active)
SELECT c.id,NULL,CONCAT(c.course_code,'-QA'),'Quantitative Analysis',1 FROM courses c WHERE c.domain_id=(SELECT id FROM education_domains WHERE domain_name='Competitive Exams');

/* Design */
INSERT IGNORE INTO subjects (course_id,course_level_id,subject_code,subject_name,is_active)
SELECT c.id,NULL,CONCAT(c.course_code,'-DT'),'Design Thinking',1 FROM courses c WHERE c.domain_id=(SELECT id FROM education_domains WHERE domain_name='Design');
INSERT IGNORE INTO subjects (course_id,course_level_id,subject_code,subject_name,is_active)
SELECT c.id,NULL,CONCAT(c.course_code,'-TYPE'),'Typography',1 FROM courses c WHERE c.domain_id=(SELECT id FROM education_domains WHERE domain_name='Design');
INSERT IGNORE INTO subjects (course_id,course_level_id,subject_code,subject_name,is_active)
SELECT c.id,NULL,CONCAT(c.course_code,'-UX'),'User Experience',1 FROM courses c WHERE c.domain_id=(SELECT id FROM education_domains WHERE domain_name='Design');
INSERT IGNORE INTO subjects (course_id,course_level_id,subject_code,subject_name,is_active)
SELECT c.id,NULL,CONCAT(c.course_code,'-UI'),'User Interface Design',1 FROM courses c WHERE c.domain_id=(SELECT id FROM education_domains WHERE domain_name='Design');
INSERT IGNORE INTO subjects (course_id,course_level_id,subject_code,subject_name,is_active)
SELECT c.id,NULL,CONCAT(c.course_code,'-FI'),'Fashion Illustration',1 FROM courses c WHERE c.domain_id=(SELECT id FROM education_domains WHERE domain_name='Design');
INSERT IGNORE INTO subjects (course_id,course_level_id,subject_code,subject_name,is_active)
SELECT c.id,NULL,CONCAT(c.course_code,'-PM'),'Product Modelling',1 FROM courses c WHERE c.domain_id=(SELECT id FROM education_domains WHERE domain_name='Design');

/* Engineering CSE curriculum - mapped by level */
INSERT IGNORE INTO subjects (course_id,course_level_id,subject_code,subject_name,study_year,semester,level_name,is_active)
SELECT c.id,cl.id,CONCAT(c.course_code,'-CSE101'),'Engineering Mathematics I',1,1,cl.level_name,1 FROM courses c JOIN course_levels cl ON cl.course_id=c.id AND cl.level_name='Year 1' WHERE c.course_code IN ('BTECH-CSE','BE-CSE');
INSERT IGNORE INTO subjects (course_id,course_level_id,subject_code,subject_name,study_year,semester,level_name,is_active)
SELECT c.id,cl.id,CONCAT(c.course_code,'-CSE102'),'Engineering Physics',1,1,cl.level_name,1 FROM courses c JOIN course_levels cl ON cl.course_id=c.id AND cl.level_name='Year 1' WHERE c.course_code IN ('BTECH-CSE','BE-CSE');
INSERT IGNORE INTO subjects (course_id,course_level_id,subject_code,subject_name,study_year,semester,level_name,is_active)
SELECT c.id,cl.id,CONCAT(c.course_code,'-CSE103'),'Engineering Chemistry',1,2,cl.level_name,1 FROM courses c JOIN course_levels cl ON cl.course_id=c.id AND cl.level_name='Year 1' WHERE c.course_code IN ('BTECH-CSE','BE-CSE');
INSERT IGNORE INTO subjects (course_id,course_level_id,subject_code,subject_name,study_year,semester,level_name,is_active)
SELECT c.id,cl.id,CONCAT(c.course_code,'-CSE104'),'Programming Fundamentals',1,1,cl.level_name,1 FROM courses c JOIN course_levels cl ON cl.course_id=c.id AND cl.level_name='Year 1' WHERE c.course_code IN ('BTECH-CSE','BE-CSE');
INSERT IGNORE INTO subjects (course_id,course_level_id,subject_code,subject_name,study_year,semester,level_name,is_active)
SELECT c.id,cl.id,CONCAT(c.course_code,'-CSE105'),'Engineering Graphics',1,2,cl.level_name,1 FROM courses c JOIN course_levels cl ON cl.course_id=c.id AND cl.level_name='Year 1' WHERE c.course_code IN ('BTECH-CSE','BE-CSE');
INSERT IGNORE INTO subjects (course_id,course_level_id,subject_code,subject_name,study_year,semester,level_name,is_active)
SELECT c.id,cl.id,CONCAT(c.course_code,'-CSE201'),'Data Structures',2,1,cl.level_name,1 FROM courses c JOIN course_levels cl ON cl.course_id=c.id AND cl.level_name='Year 2' WHERE c.course_code IN ('BTECH-CSE','BE-CSE');
INSERT IGNORE INTO subjects (course_id,course_level_id,subject_code,subject_name,study_year,semester,level_name,is_active)
SELECT c.id,cl.id,CONCAT(c.course_code,'-CSE202'),'Discrete Mathematics',2,1,cl.level_name,1 FROM courses c JOIN course_levels cl ON cl.course_id=c.id AND cl.level_name='Year 2' WHERE c.course_code IN ('BTECH-CSE','BE-CSE');
INSERT IGNORE INTO subjects (course_id,course_level_id,subject_code,subject_name,study_year,semester,level_name,is_active)
SELECT c.id,cl.id,CONCAT(c.course_code,'-CSE203'),'OOP using Java',2,2,cl.level_name,1 FROM courses c JOIN course_levels cl ON cl.course_id=c.id AND cl.level_name='Year 2' WHERE c.course_code IN ('BTECH-CSE','BE-CSE');
INSERT IGNORE INTO subjects (course_id,course_level_id,subject_code,subject_name,study_year,semester,level_name,is_active)
SELECT c.id,cl.id,CONCAT(c.course_code,'-CSE204'),'Digital Logic Design',2,2,cl.level_name,1 FROM courses c JOIN course_levels cl ON cl.course_id=c.id AND cl.level_name='Year 2' WHERE c.course_code IN ('BTECH-CSE','BE-CSE');
INSERT IGNORE INTO subjects (course_id,course_level_id,subject_code,subject_name,study_year,semester,level_name,is_active)
SELECT c.id,cl.id,CONCAT(c.course_code,'-CSE205'),'Database Management Systems',2,2,cl.level_name,1 FROM courses c JOIN course_levels cl ON cl.course_id=c.id AND cl.level_name='Year 2' WHERE c.course_code IN ('BTECH-CSE','BE-CSE');
INSERT IGNORE INTO subjects (course_id,course_level_id,subject_code,subject_name,study_year,semester,level_name,is_active)
SELECT c.id,cl.id,CONCAT(c.course_code,'-CSE301'),'Operating Systems',3,1,cl.level_name,1 FROM courses c JOIN course_levels cl ON cl.course_id=c.id AND cl.level_name='Year 3' WHERE c.course_code IN ('BTECH-CSE','BE-CSE');
INSERT IGNORE INTO subjects (course_id,course_level_id,subject_code,subject_name,study_year,semester,level_name,is_active)
SELECT c.id,cl.id,CONCAT(c.course_code,'-CSE302'),'Computer Networks',3,1,cl.level_name,1 FROM courses c JOIN course_levels cl ON cl.course_id=c.id AND cl.level_name='Year 3' WHERE c.course_code IN ('BTECH-CSE','BE-CSE');
INSERT IGNORE INTO subjects (course_id,course_level_id,subject_code,subject_name,study_year,semester,level_name,is_active)
SELECT c.id,cl.id,CONCAT(c.course_code,'-CSE303'),'Software Engineering',3,2,cl.level_name,1 FROM courses c JOIN course_levels cl ON cl.course_id=c.id AND cl.level_name='Year 3' WHERE c.course_code IN ('BTECH-CSE','BE-CSE');
INSERT IGNORE INTO subjects (course_id,course_level_id,subject_code,subject_name,study_year,semester,level_name,is_active)
SELECT c.id,cl.id,CONCAT(c.course_code,'-CSE304'),'Machine Learning',3,2,cl.level_name,1 FROM courses c JOIN course_levels cl ON cl.course_id=c.id AND cl.level_name='Year 3' WHERE c.course_code IN ('BTECH-CSE','BE-CSE');
INSERT IGNORE INTO subjects (course_id,course_level_id,subject_code,subject_name,study_year,semester,level_name,is_active)
SELECT c.id,cl.id,CONCAT(c.course_code,'-CSE305'),'Web Technologies',3,2,cl.level_name,1 FROM courses c JOIN course_levels cl ON cl.course_id=c.id AND cl.level_name='Year 3' WHERE c.course_code IN ('BTECH-CSE','BE-CSE');
INSERT IGNORE INTO subjects (course_id,course_level_id,subject_code,subject_name,study_year,semester,level_name,is_active)
SELECT c.id,cl.id,CONCAT(c.course_code,'-CSE401'),'Cloud Computing',4,1,cl.level_name,1 FROM courses c JOIN course_levels cl ON cl.course_id=c.id AND cl.level_name='Year 4' WHERE c.course_code IN ('BTECH-CSE','BE-CSE');
INSERT IGNORE INTO subjects (course_id,course_level_id,subject_code,subject_name,study_year,semester,level_name,is_active)
SELECT c.id,cl.id,CONCAT(c.course_code,'-CSE402'),'Cyber Security',4,1,cl.level_name,1 FROM courses c JOIN course_levels cl ON cl.course_id=c.id AND cl.level_name='Year 4' WHERE c.course_code IN ('BTECH-CSE','BE-CSE');
INSERT IGNORE INTO subjects (course_id,course_level_id,subject_code,subject_name,study_year,semester,level_name,is_active)
SELECT c.id,cl.id,CONCAT(c.course_code,'-CSE403'),'Artificial Intelligence',4,2,cl.level_name,1 FROM courses c JOIN course_levels cl ON cl.course_id=c.id AND cl.level_name='Year 4' WHERE c.course_code IN ('BTECH-CSE','BE-CSE');
INSERT IGNORE INTO subjects (course_id,course_level_id,subject_code,subject_name,study_year,semester,level_name,is_active)
SELECT c.id,cl.id,CONCAT(c.course_code,'-CSE404'),'Project Work',4,2,cl.level_name,1 FROM courses c JOIN course_levels cl ON cl.course_id=c.id AND cl.level_name='Year 4' WHERE c.course_code IN ('BTECH-CSE','BE-CSE');
INSERT IGNORE INTO subjects (course_id,course_level_id,subject_code,subject_name,study_year,semester,level_name,is_active)
SELECT c.id,cl.id,CONCAT(c.course_code,'-CSE405'),'Internship',4,2,cl.level_name,1 FROM courses c JOIN course_levels cl ON cl.course_id=c.id AND cl.level_name='Year 4' WHERE c.course_code IN ('BTECH-CSE','BE-CSE');

/* Law */
INSERT IGNORE INTO subjects (course_id,course_level_id,subject_code,subject_name,is_active)
SELECT c.id,NULL,CONCAT(c.course_code,'-CONST'),'Constitutional Law',1 FROM courses c WHERE c.domain_id=(SELECT id FROM education_domains WHERE domain_name='Law');
INSERT IGNORE INTO subjects (course_id,course_level_id,subject_code,subject_name,is_active)
SELECT c.id,NULL,CONCAT(c.course_code,'-CRIM'),'Criminal Law',1 FROM courses c WHERE c.domain_id=(SELECT id FROM education_domains WHERE domain_name='Law');
INSERT IGNORE INTO subjects (course_id,course_level_id,subject_code,subject_name,is_active)
SELECT c.id,NULL,CONCAT(c.course_code,'-CORP'),'Corporate Law',1 FROM courses c WHERE c.domain_id=(SELECT id FROM education_domains WHERE domain_name='Law');
INSERT IGNORE INTO subjects (course_id,course_level_id,subject_code,subject_name,is_active)
SELECT c.id,NULL,CONCAT(c.course_code,'-CIVIL'),'Civil Procedure',1 FROM courses c WHERE c.domain_id=(SELECT id FROM education_domains WHERE domain_name='Law');
INSERT IGNORE INTO subjects (course_id,course_level_id,subject_code,subject_name,is_active)
SELECT c.id,NULL,CONCAT(c.course_code,'-LEGAL'),'Legal Research',1 FROM courses c WHERE c.domain_id=(SELECT id FROM education_domains WHERE domain_name='Law');

/* Management */
INSERT IGNORE INTO subjects (course_id,course_level_id,subject_code,subject_name,is_active)
SELECT c.id,NULL,CONCAT(c.course_code,'-MKT'),'Marketing Management',1 FROM courses c WHERE c.domain_id=(SELECT id FROM education_domains WHERE domain_name='Management');
INSERT IGNORE INTO subjects (course_id,course_level_id,subject_code,subject_name,is_active)
SELECT c.id,NULL,CONCAT(c.course_code,'-HR'),'Human Resources',1 FROM courses c WHERE c.domain_id=(SELECT id FROM education_domains WHERE domain_name='Management');
INSERT IGNORE INTO subjects (course_id,course_level_id,subject_code,subject_name,is_active)
SELECT c.id,NULL,CONCAT(c.course_code,'-FIN'),'Finance',1 FROM courses c WHERE c.domain_id=(SELECT id FROM education_domains WHERE domain_name='Management');
INSERT IGNORE INTO subjects (course_id,course_level_id,subject_code,subject_name,is_active)
SELECT c.id,NULL,CONCAT(c.course_code,'-BA'),'Business Analytics',1 FROM courses c WHERE c.domain_id=(SELECT id FROM education_domains WHERE domain_name='Management');
INSERT IGNORE INTO subjects (course_id,course_level_id,subject_code,subject_name,is_active)
SELECT c.id,NULL,CONCAT(c.course_code,'-STRAT'),'Strategic Management',1 FROM courses c WHERE c.domain_id=(SELECT id FROM education_domains WHERE domain_name='Management');
INSERT IGNORE INTO subjects (course_id,course_level_id,subject_code,subject_name,is_active)
SELECT c.id,NULL,CONCAT(c.course_code,'-ENT'),'Entrepreneurship',1 FROM courses c WHERE c.domain_id=(SELECT id FROM education_domains WHERE domain_name='Management');

/* Medical */
INSERT IGNORE INTO subjects (course_id,course_level_id,subject_code,subject_name,is_active)
SELECT c.id,NULL,CONCAT(c.course_code,'-ANAT'),'Anatomy',1 FROM courses c WHERE c.domain_id=(SELECT id FROM education_domains WHERE domain_name='Medical');
INSERT IGNORE INTO subjects (course_id,course_level_id,subject_code,subject_name,is_active)
SELECT c.id,NULL,CONCAT(c.course_code,'-PHYS'),'Physiology',1 FROM courses c WHERE c.domain_id=(SELECT id FROM education_domains WHERE domain_name='Medical');
INSERT IGNORE INTO subjects (course_id,course_level_id,subject_code,subject_name,is_active)
SELECT c.id,NULL,CONCAT(c.course_code,'-PHARM'),'Pharmacology',1 FROM courses c WHERE c.domain_id=(SELECT id FROM education_domains WHERE domain_name='Medical');
INSERT IGNORE INTO subjects (course_id,course_level_id,subject_code,subject_name,is_active)
SELECT c.id,NULL,CONCAT(c.course_code,'-PATH'),'Pathology',1 FROM courses c WHERE c.domain_id=(SELECT id FROM education_domains WHERE domain_name='Medical');
INSERT IGNORE INTO subjects (course_id,course_level_id,subject_code,subject_name,is_active)
SELECT c.id,NULL,CONCAT(c.course_code,'-CM'),'Community Medicine',1 FROM courses c WHERE c.domain_id=(SELECT id FROM education_domains WHERE domain_name='Medical');
INSERT IGNORE INTO subjects (course_id,course_level_id,subject_code,subject_name,is_active)
SELECT c.id,NULL,CONCAT(c.course_code,'-CLIN'),'Clinical Practice',1 FROM courses c WHERE c.domain_id=(SELECT id FROM education_domains WHERE domain_name='Medical');

/* School */
INSERT IGNORE INTO subjects (course_id,course_level_id,subject_code,subject_name,is_active)
SELECT c.id,NULL,CONCAT('SCHOOL-MATH'),'Mathematics',1 FROM courses c WHERE c.course_code='SCHOOL-G1-12';
INSERT IGNORE INTO subjects (course_id,course_level_id,subject_code,subject_name,is_active)
SELECT c.id,NULL,CONCAT('SCHOOL-SCI'),'Science',1 FROM courses c WHERE c.course_code='SCHOOL-G1-12';
INSERT IGNORE INTO subjects (course_id,course_level_id,subject_code,subject_name,is_active)
SELECT c.id,NULL,'SCHOOL-SOC','Social Science',1 FROM courses c WHERE c.course_code='SCHOOL-G1-12';
INSERT IGNORE INTO subjects (course_id,course_level_id,subject_code,subject_name,is_active)
SELECT c.id,NULL,'SCHOOL-ENG','English',1 FROM courses c WHERE c.course_code='SCHOOL-G1-12';
INSERT IGNORE INTO subjects (course_id,course_level_id,subject_code,subject_name,is_active)
SELECT c.id,NULL,'SCHOOL-TAM','Tamil',1 FROM courses c WHERE c.course_code='SCHOOL-G1-12';
INSERT IGNORE INTO subjects (course_id,course_level_id,subject_code,subject_name,is_active)
SELECT c.id,NULL,'SCHOOL-HIN','Hindi',1 FROM courses c WHERE c.course_code='SCHOOL-G1-12';
INSERT IGNORE INTO subjects (course_id,course_level_id,subject_code,subject_name,is_active)
SELECT c.id,NULL,'SCHOOL-CS','Computer Science',1 FROM courses c WHERE c.course_code='SCHOOL-G1-12';

/* Science */
INSERT IGNORE INTO subjects (course_id,course_level_id,subject_code,subject_name,is_active)
SELECT c.id,NULL,CONCAT(c.course_code,'-CALC'),'Calculus',1 FROM courses c WHERE c.domain_id=(SELECT id FROM education_domains WHERE domain_name='Science');
INSERT IGNORE INTO subjects (course_id,course_level_id,subject_code,subject_name,is_active)
SELECT c.id,NULL,CONCAT(c.course_code,'-LA'),'Linear Algebra',1 FROM courses c WHERE c.domain_id=(SELECT id FROM education_domains WHERE domain_name='Science');
INSERT IGNORE INTO subjects (course_id,course_level_id,subject_code,subject_name,is_active)
SELECT c.id,NULL,CONCAT(c.course_code,'-MECH'),'Mechanics',1 FROM courses c WHERE c.domain_id=(SELECT id FROM education_domains WHERE domain_name='Science');
INSERT IGNORE INTO subjects (course_id,course_level_id,subject_code,subject_name,is_active)
SELECT c.id,NULL,CONCAT(c.course_code,'-THERMO'),'Thermodynamics',1 FROM courses c WHERE c.domain_id=(SELECT id FROM education_domains WHERE domain_name='Science');
INSERT IGNORE INTO subjects (course_id,course_level_id,subject_code,subject_name,is_active)
SELECT c.id,NULL,CONCAT(c.course_code,'-ORG'),'Organic Chemistry',1 FROM courses c WHERE c.domain_id=(SELECT id FROM education_domains WHERE domain_name='Science');
INSERT IGNORE INTO subjects (course_id,course_level_id,subject_code,subject_name,is_active)
SELECT c.id,NULL,CONCAT(c.course_code,'-PROB'),'Probability',1 FROM courses c WHERE c.domain_id=(SELECT id FROM education_domains WHERE domain_name='Science');
INSERT IGNORE INTO subjects (course_id,course_level_id,subject_code,subject_name,is_active)
SELECT c.id,NULL,CONCAT(c.course_code,'-STAT'),'Statistical Methods',1 FROM courses c WHERE c.domain_id=(SELECT id FROM education_domains WHERE domain_name='Science');

/* =====================================================
   INITIAL CURRICULUM VERSIONS
===================================================== */
INSERT IGNORE INTO curriculum_versions (course_id,course_level_id,curriculum_name,version_code,academic_year_label,status,notes)
SELECT c.id,NULL,CONCAT('Standard Curriculum - ',c.course_name),'STD-2026-27','2026-27','active','Preloaded LearnVault academic catalog curriculum. Fully configurable by Admin.'
FROM courses c;

/* Map each seeded subject to the matching curriculum and, where possible, a semester. */
INSERT IGNORE INTO curriculum_subjects (curriculum_id,subject_id,semester_id,credits,is_core,learning_outcomes,resource_requirements)
SELECT cv.id,s.id,cs.id,NULL,1,NULL,'Configure notes, videos, question banks, quizzes and practice resources for this subject.'
FROM curriculum_versions cv
JOIN subjects s ON s.course_id=cv.course_id
LEFT JOIN course_semesters cs ON cs.course_id=s.course_id AND cs.course_level_id=s.course_level_id AND cs.semester_number=COALESCE(s.semester,1)
WHERE cv.status='active';

/* =====================================================
   SUMMARY
===================================================== */
SELECT COUNT(*) AS education_domains FROM education_domains;
SELECT COUNT(*) AS departments FROM departments;
SELECT COUNT(*) AS courses FROM courses;
SELECT COUNT(*) AS course_levels FROM course_levels;
SELECT COUNT(*) AS semesters FROM course_semesters;
SELECT COUNT(*) AS subjects FROM subjects;
SELECT COUNT(*) AS curriculum_versions FROM curriculum_versions;
