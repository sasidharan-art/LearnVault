USE learnvault_db;

/* LEARNVAULT — FACULTY-CONTROLLED LEARNING TRANSITION
   Routine Admin approval is removed from learning content.
   Faculty publishes directly for assigned subjects.
   Admin retains full visibility and moderation authority.
*/

UPDATE resources
SET verification_status='approved',
    verified_by=NULL,
    verified_at=COALESCE(verified_at,NOW())
WHERE verification_status='pending';

UPDATE question_bank
SET verification_status='approved',
    verified_by=NULL,
    verified_at=COALESCE(verified_at,NOW())
WHERE verification_status='pending';

UPDATE quizzes
SET verification_status='approved',
    is_published=1,
    verified_by=NULL,
    verified_at=COALESCE(verified_at,NOW())
WHERE verification_status='pending';

SELECT verification_status,COUNT(*) AS resource_count
FROM resources GROUP BY verification_status;

SELECT verification_status,COUNT(*) AS question_count
FROM question_bank GROUP BY verification_status;

SELECT verification_status,is_published,COUNT(*) AS quiz_count
FROM quizzes GROUP BY verification_status,is_published;
