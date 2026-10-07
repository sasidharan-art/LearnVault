USE learnvault_db;

-- LearnVault Hackathon Extension
-- Live Classes + Education Real-World Problem Lab

CREATE TABLE IF NOT EXISTS live_classes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    faculty_user_id INT NOT NULL,
    subject_id INT NULL,
    course_id INT NULL,
    course_level_id INT NULL,
    title VARCHAR(180) NOT NULL,
    description TEXT NULL,
    meeting_url VARCHAR(1000) NOT NULL,
    starts_at DATETIME NOT NULL,
    ends_at DATETIME NULL,
    status ENUM('scheduled','live','completed','cancelled') NOT NULL DEFAULT 'scheduled',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_live_classes_faculty (faculty_user_id, starts_at),
    INDEX idx_live_classes_schedule (starts_at, status),
    INDEX idx_live_classes_course (course_id, course_level_id),
    CONSTRAINT fk_live_classes_faculty FOREIGN KEY (faculty_user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_live_classes_subject FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE SET NULL,
    CONSTRAINT fk_live_classes_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL,
    CONSTRAINT fk_live_classes_level FOREIGN KEY (course_level_id) REFERENCES course_levels(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS live_class_attendance (
    id INT AUTO_INCREMENT PRIMARY KEY,
    live_class_id INT NOT NULL,
    user_id INT NOT NULL,
    joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    left_at DATETIME NULL,
    attendance_minutes INT NOT NULL DEFAULT 0,
    UNIQUE KEY uq_live_class_attendance (live_class_id, user_id),
    INDEX idx_live_attendance_user (user_id, joined_at),
    CONSTRAINT fk_live_attendance_class FOREIGN KEY (live_class_id) REFERENCES live_classes(id) ON DELETE CASCADE,
    CONSTRAINT fk_live_attendance_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS education_challenges (
    id INT AUTO_INCREMENT PRIMARY KEY,
    created_by INT NULL,
    subject_id INT NULL,
    course_id INT NULL,
    course_level_id INT NULL,
    title VARCHAR(220) NOT NULL,
    domain VARCHAR(100) NOT NULL,
    problem_statement TEXT NOT NULL,
    real_world_context TEXT NOT NULL,
    expected_outcome TEXT NULL,
    skills VARCHAR(700) NULL,
    difficulty ENUM('beginner','intermediate','advanced') NOT NULL DEFAULT 'intermediate',
    solution_guidance TEXT NULL,
    status ENUM('published','draft','archived') NOT NULL DEFAULT 'published',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_challenges_scope (course_id, course_level_id, status),
    INDEX idx_challenges_subject (subject_id, status),
    INDEX idx_challenges_domain (domain, status),
    CONSTRAINT fk_challenges_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_challenges_subject FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE SET NULL,
    CONSTRAINT fk_challenges_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL,
    CONSTRAINT fk_challenges_level FOREIGN KEY (course_level_id) REFERENCES course_levels(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS education_challenge_submissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    challenge_id INT NOT NULL,
    student_user_id INT NOT NULL,
    solution_text TEXT NOT NULL,
    attachment_url VARCHAR(1000) NULL,
    status ENUM('submitted','reviewed','needs_revision') NOT NULL DEFAULT 'submitted',
    faculty_feedback TEXT NULL,
    score DECIMAL(5,2) NULL,
    submitted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_at DATETIME NULL,
    reviewed_by INT NULL,
    UNIQUE KEY uq_challenge_student (challenge_id, student_user_id),
    INDEX idx_challenge_submissions_student (student_user_id, submitted_at),
    INDEX idx_challenge_submissions_review (status, submitted_at),
    CONSTRAINT fk_challenge_submission_challenge FOREIGN KEY (challenge_id) REFERENCES education_challenges(id) ON DELETE CASCADE,
    CONSTRAINT fk_challenge_submission_student FOREIGN KEY (student_user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_challenge_submission_reviewer FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

INSERT INTO education_challenges
(created_by, title, domain, problem_statement, real_world_context, expected_outcome, skills, difficulty, solution_guidance, status)
SELECT NULL,
'Academic Dropout Early-Warning System',
'Education Analytics',
'Design a learning system that identifies students who may be at risk of falling behind before they disengage.',
'A college may have quiz scores, assignment submissions, attendance and learning activity, but faculty often notice struggling students too late.',
'Propose a transparent early-warning workflow that combines measurable learning signals with faculty intervention without unfairly labeling students.',
'Data analysis, SQL, dashboards, ethics, intervention design',
'intermediate',
'Consider leading indicators, explainable risk rules, privacy, faculty alerts and a measurable intervention outcome.',
'published'
WHERE NOT EXISTS (SELECT 1 FROM education_challenges WHERE title='Academic Dropout Early-Warning System');

INSERT INTO education_challenges
(created_by, title, domain, problem_statement, real_world_context, expected_outcome, skills, difficulty, solution_guidance, status)
SELECT NULL,
'Personalized Learning for Mixed Skill Levels',
'Personalized Education',
'Create a method that gives different learning paths to students who are studying the same subject at different mastery levels.',
'One classroom can contain beginners, average learners and advanced learners. A single sequence can be too easy for some and too difficult for others.',
'Design a rule-based or data-driven learning path that recommends resources, practice and revision based on evidence.',
'Algorithms, recommendation systems, DBMS, UX, learning analytics',
'intermediate',
'Use mastery, recent performance, weak topics and prerequisite relationships. Explain why each recommendation is shown.',
'published'
WHERE NOT EXISTS (SELECT 1 FROM education_challenges WHERE title='Personalized Learning for Mixed Skill Levels');

INSERT INTO education_challenges
(created_by, title, domain, problem_statement, real_world_context, expected_outcome, skills, difficulty, solution_guidance, status)
SELECT NULL,
'Accessible Digital Classroom',
'Inclusive Education',
'Design a digital learning experience that remains usable for students with different accessibility needs and device limitations.',
'Students may depend on keyboards, screen readers, captions, low-bandwidth connections or mobile devices.',
'Create an accessibility checklist and product design that improves access without reducing the quality of learning.',
'Accessibility, responsive design, UX research, frontend engineering',
'beginner',
'Consider keyboard navigation, readable contrast, captions, alternative text, responsive layouts and low-bandwidth fallbacks.',
'published'
WHERE NOT EXISTS (SELECT 1 FROM education_challenges WHERE title='Accessible Digital Classroom');

INSERT INTO education_challenges
(created_by, title, domain, problem_statement, real_world_context, expected_outcome, skills, difficulty, solution_guidance, status)
SELECT NULL,
'Teacher Workload and Feedback Automation',
'Faculty Productivity',
'Build a workflow that reduces repetitive faculty work while keeping human review for important academic decisions.',
'Faculty spend significant time checking submissions, identifying weak topics, sending reminders and preparing reports.',
'Propose an automation pipeline with clear human approval points and measurable time savings.',
'Automation, backend systems, analytics, workflow design',
'advanced',
'Separate routine automation from decisions that require faculty judgment. Define audit logs and fallback handling.',
'published'
WHERE NOT EXISTS (SELECT 1 FROM education_challenges WHERE title='Teacher Workload and Feedback Automation');

-- Extended Education Innovation Lab challenge catalogue
INSERT INTO education_challenges (created_by,title,domain,problem_statement,real_world_context,expected_outcome,skills,difficulty,solution_guidance,status)
SELECT NULL,'AI-Based Career Guidance','Career Readiness','Design an explainable system that maps student evidence to suitable career paths and identifies missing skills.','Students often choose careers without understanding the skills, assessments and experiences required for the role.','A transparent career recommendation workflow with skill-gap analysis and a measurable readiness score.','AI, recommendation systems, analytics, career design','advanced','Use evidence from skills, projects, assessments and goals. Keep recommendations explainable and editable by the student.','published'
WHERE NOT EXISTS (SELECT 1 FROM education_challenges WHERE title='AI-Based Career Guidance');
INSERT INTO education_challenges (created_by,title,domain,problem_statement,real_world_context,expected_outcome,skills,difficulty,solution_guidance,status)
SELECT NULL,'Smart Attendance Prediction','Academic Analytics','Design a system that detects attendance risk early and recommends timely intervention.','Students may cross an attendance threshold before faculty have a clear view of the trend.','A trend-based warning model that supports early intervention without unfairly labeling students.','SQL, analytics, prediction, dashboards','intermediate','Use historical attendance trends and transparent thresholds. Separate prediction from disciplinary decisions.','published'
WHERE NOT EXISTS (SELECT 1 FROM education_challenges WHERE title='Smart Attendance Prediction');
INSERT INTO education_challenges (created_by,title,domain,problem_statement,real_world_context,expected_outcome,skills,difficulty,solution_guidance,status)
SELECT NULL,'Early Risk Student Detection','Student Success','Build an explainable early-warning framework for students whose learning signals are declining.','Quiz performance, assignments and engagement can decline before final examination outcomes.','A measurable intervention workflow with clear signals, faculty review and outcome tracking.','Data analytics, SQL, ethics, intervention design','advanced','Use multiple signals, avoid single-metric labeling and record interventions plus outcomes.','published'
WHERE NOT EXISTS (SELECT 1 FROM education_challenges WHERE title='Early Risk Student Detection');
INSERT INTO education_challenges (created_by,title,domain,problem_statement,real_world_context,expected_outcome,skills,difficulty,solution_guidance,status)
SELECT NULL,'Mental Health and Academic Stress Monitoring','Student Wellbeing','Design a privacy-conscious academic support system that identifies workload and performance patterns that may indicate a need for support.','Heavy workloads and repeated low performance can coincide with disengagement, but academic data must not be treated as a diagnosis.','A consent-aware support workflow that recommends resources and human follow-up rather than automated diagnosis.','Privacy, UX, analytics, ethics','advanced','Use non-clinical language, consent, human review and clear escalation boundaries.','published'
WHERE NOT EXISTS (SELECT 1 FROM education_challenges WHERE title='Mental Health and Academic Stress Monitoring');
INSERT INTO education_challenges (created_by,title,domain,problem_statement,real_world_context,expected_outcome,skills,difficulty,solution_guidance,status)
SELECT NULL,'Bridging Rural Education Gaps','Inclusive Education','Design a low-bandwidth learning model for learners with limited connectivity and device access.','Rural learners may depend on shared devices, intermittent networks and offline study.','An offline-first learning flow with measurable reach and learning outcomes.','Product design, accessibility, low-bandwidth engineering','intermediate','Prioritize downloadable content, lightweight pages, offline progress capture and community support.','published'
WHERE NOT EXISTS (SELECT 1 FROM education_challenges WHERE title='Bridging Rural Education Gaps');
INSERT INTO education_challenges (created_by,title,domain,problem_statement,real_world_context,expected_outcome,skills,difficulty,solution_guidance,status)
SELECT NULL,'Exam Performance Prediction','Assessment Intelligence','Create a transparent model that estimates exam readiness from prior assessment evidence.','Students often discover weak preparation areas only shortly before major examinations.','A readiness indicator that identifies evidence-backed revision priorities.','Statistics, SQL, analytics, visualization','advanced','Use recent and historical scores, topic coverage and completion. Explain the strongest contributing signals.','published'
WHERE NOT EXISTS (SELECT 1 FROM education_challenges WHERE title='Exam Performance Prediction');
INSERT INTO education_challenges (created_by,title,domain,problem_statement,real_world_context,expected_outcome,skills,difficulty,solution_guidance,status)
SELECT NULL,'Learning Gap Identification','Learning Analytics','Identify prerequisite topics that a student may need before progressing to an advanced topic.','Students can complete a chapter while missing foundational concepts needed for the next chapter.','A prerequisite-aware gap report and remediation path.','Learning analytics, graph thinking, recommendation systems','advanced','Map prerequisite relationships and combine them with mastery evidence.','published'
WHERE NOT EXISTS (SELECT 1 FROM education_challenges WHERE title='Learning Gap Identification');
INSERT INTO education_challenges (created_by,title,domain,problem_statement,real_world_context,expected_outcome,skills,difficulty,solution_guidance,status)
SELECT NULL,'Peer-to-Peer Knowledge Sharing','Collaborative Learning','Build a trusted peer-learning workflow where useful explanations can be discovered and verified.','Students often understand different parts of the same topic and need a safe way to share explanations.','A moderated peer-learning model with contribution and quality metrics.','Community design, moderation, databases','intermediate','Combine reputation signals with faculty verification and reporting tools.','published'
WHERE NOT EXISTS (SELECT 1 FROM education_challenges WHERE title='Peer-to-Peer Knowledge Sharing');
INSERT INTO education_challenges (created_by,title,domain,problem_statement,real_world_context,expected_outcome,skills,difficulty,solution_guidance,status)
SELECT NULL,'Industry Readiness Assessment','Career Readiness','Design an assessment that measures whether students have the skills expected for an industry role.','Academic grades alone may not show practical readiness for internships and entry-level roles.','A competency matrix connecting skills, projects and assessments to a target role.','Skill mapping, assessment, analytics','advanced','Define competencies, evidence and readiness thresholds for the selected role.','published'
WHERE NOT EXISTS (SELECT 1 FROM education_challenges WHERE title='Industry Readiness Assessment');
INSERT INTO education_challenges (created_by,title,domain,problem_statement,real_world_context,expected_outcome,skills,difficulty,solution_guidance,status)
SELECT NULL,'Placement Readiness Tracking','Placement Intelligence','Create a dashboard that shows how close a student is to placement readiness and what to improve next.','Students often prepare for placements without a clear view of their skill, assessment and interview gaps.','A readiness score with actionable next steps.','Analytics, career planning, dashboards','intermediate','Separate academic mastery, technical skills, communication and interview readiness.','published'
WHERE NOT EXISTS (SELECT 1 FROM education_challenges WHERE title='Placement Readiness Tracking');
INSERT INTO education_challenges (created_by,title,domain,problem_statement,real_world_context,expected_outcome,skills,difficulty,solution_guidance,status)
SELECT NULL,'Financial Aid Recommendation System','Education Access','Design a transparent aid-discovery system that matches students with relevant financial-support opportunities.','Students may miss scholarships because information is scattered or eligibility is difficult to interpret.','A privacy-aware eligibility and discovery workflow with human verification.','Databases, rules engines, privacy, UX','advanced','Use explicit eligibility rules and let students review why an opportunity was recommended.','published'
WHERE NOT EXISTS (SELECT 1 FROM education_challenges WHERE title='Financial Aid Recommendation System');
INSERT INTO education_challenges (created_by,title,domain,problem_statement,real_world_context,expected_outcome,skills,difficulty,solution_guidance,status)
SELECT NULL,'Language Learning Assistance','Language Learning','Design adaptive practice that helps learners improve vocabulary, comprehension and communication.','Learners have different language backgrounds and progress at different speeds.','A personalized practice loop with measurable improvement.','NLP concepts, UX, analytics','intermediate','Use level-based practice, spaced repetition and progress tracking.','published'
WHERE NOT EXISTS (SELECT 1 FROM education_challenges WHERE title='Language Learning Assistance');
INSERT INTO education_challenges (created_by,title,domain,problem_statement,real_world_context,expected_outcome,skills,difficulty,solution_guidance,status)
SELECT NULL,'AI Study Planner','Personalized Learning','Create a planner that turns goals, deadlines and weak areas into a realistic study schedule.','Students struggle to balance assignments, exams, skill building and revision.','An explainable plan that adapts when tasks are completed late or priorities change.','Scheduling, AI concepts, UX, analytics','advanced','Prioritize deadlines, prerequisites, estimated effort and current mastery.','published'
WHERE NOT EXISTS (SELECT 1 FROM education_challenges WHERE title='AI Study Planner');
INSERT INTO education_challenges (created_by,title,domain,problem_statement,real_world_context,expected_outcome,skills,difficulty,solution_guidance,status)
SELECT NULL,'Smart Doubt Resolution','Collaborative Learning','Design a system that routes student doubts to useful resources, peers or faculty.','Students may spend too long waiting for help on common questions.','A triage flow that improves response time while preserving faculty oversight.','Search, NLP concepts, databases, UX','advanced','Start with topic classification, related-resource retrieval and escalation rules.','published'
WHERE NOT EXISTS (SELECT 1 FROM education_challenges WHERE title='Smart Doubt Resolution');
INSERT INTO education_challenges (created_by,title,domain,problem_statement,real_world_context,expected_outcome,skills,difficulty,solution_guidance,status)
SELECT NULL,'Skill Gap Analysis','Career Intelligence','Identify the difference between a student skill profile and a target role skill profile.','Students may know their current skills but not which missing skills matter most for their target career.','A prioritized skill-gap report and learning roadmap.','Data modeling, analytics, career planning','intermediate','Compare current evidence with role requirements and prioritize foundational dependencies.','published'
WHERE NOT EXISTS (SELECT 1 FROM education_challenges WHERE title='Skill Gap Analysis');
INSERT INTO education_challenges (created_by,title,domain,problem_statement,real_world_context,expected_outcome,skills,difficulty,solution_guidance,status)
SELECT NULL,'Future Career Roadmap Generator','Career Planning','Build a roadmap from a student goal to skills, projects, certifications and milestones.','Career goals can feel abstract when students do not know what to do next.','A milestone-based roadmap with measurable checkpoints.','Recommendation systems, planning, UX','advanced','Break the target role into competencies and sequence them by prerequisite relationships.','published'
WHERE NOT EXISTS (SELECT 1 FROM education_challenges WHERE title='Future Career Roadmap Generator');

-- Enrich Innovation Lab challenges with measurable impact and learning outcomes.
ALTER TABLE education_challenges ADD COLUMN IF NOT EXISTS impact_analysis TEXT NULL AFTER real_world_context;
ALTER TABLE education_challenges ADD COLUMN IF NOT EXISTS learning_outcomes TEXT NULL AFTER expected_outcome;
ALTER TABLE education_challenge_submissions ADD COLUMN IF NOT EXISTS improvement_suggestions TEXT NULL AFTER faculty_feedback;

UPDATE education_challenges SET impact_analysis=COALESCE(impact_analysis, CONCAT('Measure the educational benefit of the proposed solution for learners, faculty or the institution. Expected outcome: ', COALESCE(expected_outcome,'measurable improvement.'))), learning_outcomes=COALESCE(learning_outcomes, CONCAT('Students should demonstrate practical problem solving, evidence-based design and the skills listed for this challenge.')) WHERE impact_analysis IS NULL OR learning_outcomes IS NULL;
