USE learnvault_db;


/* =====================================================
   LEARNVAULT ACADEMIC REGISTRATION UPDATE

   IMPORTANT:
   This migration keeps the old student profile columns
   for compatibility. New registrations use:
       course_id
       course_level_id

   Semester is no longer collected on Create Account.
===================================================== */


/* =====================================================
   1. ACTIVE FLAGS
===================================================== */

ALTER TABLE education_domains
ADD COLUMN is_active TINYINT(1)
NOT NULL DEFAULT 1
AFTER domain_name;


ALTER TABLE departments
ADD COLUMN domain_id INT NULL
AFTER id;


ALTER TABLE departments
ADD COLUMN is_active TINYINT(1)
NOT NULL DEFAULT 1
AFTER department_name;


ALTER TABLE courses
ADD COLUMN is_active TINYINT(1)
NOT NULL DEFAULT 1
AFTER structure_type;


/* =====================================================
   2. CONNECT DEPARTMENT TO EDUCATION DOMAIN
===================================================== */

ALTER TABLE departments
ADD CONSTRAINT fk_department_domain
FOREIGN KEY (domain_id)
REFERENCES education_domains(id)
ON DELETE RESTRICT
ON UPDATE CASCADE;


/* Map the existing CSE department to Engineering. */

UPDATE departments d

JOIN education_domains ed
    ON ed.domain_name = 'Engineering'

SET
    d.domain_id = ed.id

WHERE
    d.department_code = 'CSE'
    AND d.domain_id IS NULL;


/* =====================================================
   3. COURSE LEVELS / YEARS

   Works for:
   - B.Tech Year 1-4
   - B.Arch Year 1-5
   - School Class 6-12
   - UPSC Prelims / Mains
   - Design Beginner / Intermediate / Advanced
===================================================== */

CREATE TABLE course_levels (

    id INT AUTO_INCREMENT PRIMARY KEY,

    course_id INT NOT NULL,

    level_name VARCHAR(100)
        NOT NULL,

    level_order INT
        NOT NULL
        DEFAULT 1,

    is_active TINYINT(1)
        NOT NULL
        DEFAULT 1,

    created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_course_level_name
        UNIQUE (
            course_id,
            level_name
        ),

    CONSTRAINT fk_course_level_course
        FOREIGN KEY (course_id)
        REFERENCES courses(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);


/* =====================================================
   4. STUDENT PROFILE RELATIONSHIPS
===================================================== */

ALTER TABLE student_profiles
ADD COLUMN course_id INT NULL
AFTER user_id;


ALTER TABLE student_profiles
ADD COLUMN course_level_id INT NULL
AFTER course_id;


ALTER TABLE student_profiles
ADD CONSTRAINT fk_student_profile_course
FOREIGN KEY (course_id)
REFERENCES courses(id)
ON DELETE SET NULL
ON UPDATE CASCADE;


ALTER TABLE student_profiles
ADD CONSTRAINT fk_student_profile_course_level
FOREIGN KEY (course_level_id)
REFERENCES course_levels(id)
ON DELETE SET NULL
ON UPDATE CASCADE;


/* =====================================================
   5. SEED LEVELS FOR EXISTING B.TECH CSE TEST COURSE
===================================================== */

INSERT IGNORE INTO course_levels
(
    course_id,
    level_name,
    level_order
)

SELECT
    c.id,
    '1st Year',
    1

FROM courses c

WHERE
    c.course_code = 'BTECH-CSE';


INSERT IGNORE INTO course_levels
(
    course_id,
    level_name,
    level_order
)

SELECT
    c.id,
    '2nd Year',
    2

FROM courses c

WHERE
    c.course_code = 'BTECH-CSE';


INSERT IGNORE INTO course_levels
(
    course_id,
    level_name,
    level_order
)

SELECT
    c.id,
    '3rd Year',
    3

FROM courses c

WHERE
    c.course_code = 'BTECH-CSE';


INSERT IGNORE INTO course_levels
(
    course_id,
    level_name,
    level_order
)

SELECT
    c.id,
    '4th Year',
    4

FROM courses c

WHERE
    c.course_code = 'BTECH-CSE';


/* =====================================================
   6. VERIFY
===================================================== */

SELECT
    id,
    domain_name,
    is_active
FROM education_domains
ORDER BY domain_name;


SELECT
    d.id,
    d.department_code,
    d.department_name,
    ed.domain_name,
    d.is_active

FROM departments d

LEFT JOIN education_domains ed
    ON d.domain_id = ed.id

ORDER BY d.department_name;


SELECT
    c.id,
    c.course_code,
    c.course_name,
    c.structure_type,
    c.is_active,
    ed.domain_name,
    d.department_name

FROM courses c

LEFT JOIN education_domains ed
    ON c.domain_id = ed.id

LEFT JOIN departments d
    ON c.department_id = d.id

ORDER BY c.course_name;


SELECT
    cl.id,
    c.course_name,
    cl.level_name,
    cl.level_order,
    cl.is_active

FROM course_levels cl

INNER JOIN courses c
    ON cl.course_id = c.id

ORDER BY
    c.course_name,
    cl.level_order;


DESCRIBE student_profiles;
