const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const db = require("../config/db");
const authenticateUser = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

const router = express.Router();

const submissionDirectory = path.join(
    __dirname,
    "../../../uploads/assignments"
);

fs.mkdirSync(submissionDirectory, { recursive: true });

const allowedExtensions = new Set([
    ".pdf", ".doc", ".docx", ".ppt", ".pptx",
    ".txt", ".zip", ".png", ".jpg", ".jpeg",
    ".c", ".cpp", ".java", ".py"
]);

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, submissionDirectory),
    filename: (req, file, cb) => {
        const extension = path.extname(file.originalname || "").toLowerCase();
        cb(null, `${Date.now()}-${crypto.randomUUID()}${extension}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const extension = path.extname(file.originalname || "").toLowerCase();
        if (!allowedExtensions.has(extension)) {
            return cb(new Error(
                "Unsupported file type. Use PDF, Office files, TXT, ZIP, images, C/C++, Java or Python files."
            ));
        }
        cb(null, true);
    }
});

function uploadSingle(req, res, next) {
    upload.single("file")(req, res, (error) => {
        if (!error) return next();
        return res.status(400).json({
            success: false,
            message: error.message || "Submission file upload failed"
        });
    });
}

function cleanup(file) {
    if (!file || !file.path) return;
    fs.unlink(file.path, () => {});
}

function clean(value) {
    return String(value ?? "").trim();
}

function asBool(value) {
    return value === true || value === 1 || value === "1" || value === "true";
}

async function facultyCanUseSubject(userId, subjectId) {
    const [rows] = await db.query(`
        SELECT s.id
        FROM faculty_subject_assignments fsa
        INNER JOIN subjects s ON s.id = fsa.subject_id
        INNER JOIN courses c ON c.id = s.course_id
        WHERE fsa.faculty_user_id = ?
          AND fsa.subject_id = ?
          AND fsa.is_active = 1
          AND s.is_active = 1
          AND c.is_active = 1
        LIMIT 1
    `, [userId, subjectId]);
    return rows.length > 0;
}

async function studentProfile(userId) {
    const [rows] = await db.query(`
        SELECT
            sp.user_id,
            sp.course_id,
            sp.course_level_id,
            c.course_code,
            c.course_name,
            cl.level_name
        FROM student_profiles sp
        INNER JOIN courses c ON c.id = sp.course_id
        LEFT JOIN course_levels cl ON cl.id = sp.course_level_id
        WHERE sp.user_id = ?
          AND c.is_active = 1
        LIMIT 1
    `, [userId]);
    return rows[0] || null;
}

function levelClause(profile, alias = "s") {
    if (profile.course_level_id) {
        return {
            sql: `AND (${alias}.course_level_id IS NULL OR ${alias}.course_level_id = ?)`,
            values: [profile.course_level_id]
        };
    }
    return {
        sql: `AND ${alias}.course_level_id IS NULL`,
        values: []
    };
}

async function assignmentRow(id) {
    const [rows] = await db.query(`
        SELECT
            a.*,
            s.course_id,
            s.course_level_id,
            s.subject_code,
            s.subject_name,
            c.course_name,
            creator.full_name AS creator_name
        FROM assignments a
        INNER JOIN subjects s ON s.id = a.subject_id
        INNER JOIN courses c ON c.id = s.course_id
        INNER JOIN users creator ON creator.id = a.created_by
        WHERE a.id = ?
        LIMIT 1
    `, [id]);
    return rows[0] || null;
}

function dueAllowsSubmission(assignment) {
    if (!assignment.due_at) return true;
    const due = new Date(assignment.due_at).getTime();
    if (!Number.isFinite(due)) return true;
    return Date.now() <= due || Number(assignment.allow_late_submission) === 1;
}

/* =====================================================
   FACULTY META
===================================================== */
router.get(
    "/faculty/meta",
    authenticateUser,
    authorizeRoles("faculty"),
    async (req, res) => {
        try {
            const [subjects] = await db.query(`
                SELECT
                    s.id,
                    s.subject_code,
                    s.subject_name,
                    c.course_name,
                    cl.level_name
                FROM faculty_subject_assignments fsa
                INNER JOIN subjects s ON s.id = fsa.subject_id
                INNER JOIN courses c ON c.id = s.course_id
                LEFT JOIN course_levels cl ON cl.id = s.course_level_id
                WHERE fsa.faculty_user_id = ?
                  AND fsa.is_active = 1
                  AND s.is_active = 1
                  AND c.is_active = 1
                ORDER BY c.course_name, cl.level_order, s.subject_name
            `, [req.user.userId]);

            return res.json({ success: true, subjects });
        } catch (error) {
            console.error("Assignment Faculty meta error:", error);
            return res.status(500).json({
                success: false,
                message: "Unable to load assigned subjects"
            });
        }
    }
);

/* =====================================================
   FACULTY CREATE + MANAGE
===================================================== */
router.post(
    "/faculty",
    authenticateUser,
    authorizeRoles("faculty"),
    async (req, res) => {
        const subjectId = Number(req.body.subjectId);
        const title = clean(req.body.title);
        const description = clean(req.body.description);
        const instructions = clean(req.body.instructions);
        const totalMarks = Number(req.body.totalMarks || 100);
        const dueAt = clean(req.body.dueAt) || null;
        const allowLate = asBool(req.body.allowLateSubmission);

        if (!Number.isInteger(subjectId) || subjectId <= 0 || !title) {
            return res.status(400).json({
                success: false,
                message: "Assigned Subject and assignment title are required"
            });
        }

        if (!Number.isFinite(totalMarks) || totalMarks <= 0 || totalMarks > 10000) {
            return res.status(400).json({
                success: false,
                message: "Total marks must be greater than 0"
            });
        }

        if (dueAt && Number.isNaN(new Date(dueAt).getTime())) {
            return res.status(400).json({
                success: false,
                message: "Invalid due date"
            });
        }

        try {
            if (!(await facultyCanUseSubject(req.user.userId, subjectId))) {
                return res.status(403).json({
                    success: false,
                    message: "You can create assignments only for assigned subjects"
                });
            }

            const [result] = await db.query(`
                INSERT INTO assignments
                (
                    subject_id,
                    created_by,
                    title,
                    description,
                    instructions,
                    due_at,
                    total_marks,
                    allow_late_submission,
                    status
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'published')
            `, [
                subjectId,
                req.user.userId,
                title,
                description || null,
                instructions || null,
                dueAt ? new Date(dueAt) : null,
                totalMarks,
                allowLate ? 1 : 0
            ]);

            return res.status(201).json({
                success: true,
                assignmentId: result.insertId,
                message: "Assignment published to matching students"
            });
        } catch (error) {
            console.error("Create assignment error:", error);
            return res.status(500).json({
                success: false,
                message: "Unable to create assignment"
            });
        }
    }
);

router.get(
    "/faculty",
    authenticateUser,
    authorizeRoles("faculty"),
    async (req, res) => {
        try {
            const [rows] = await db.query(`
                SELECT
                    a.id,
                    a.subject_id,
                    a.title,
                    a.description,
                    a.instructions,
                    a.due_at,
                    a.total_marks,
                    a.allow_late_submission,
                    a.status,
                    a.created_at,
                    s.subject_code,
                    s.subject_name,
                    c.course_name,
                    cl.level_name,
                    COUNT(asub.id) AS submission_count,
                    SUM(asub.status = 'graded') AS graded_count,
                    SUM(asub.status = 'submitted') AS awaiting_grade_count
                FROM assignments a
                INNER JOIN subjects s ON s.id = a.subject_id
                INNER JOIN courses c ON c.id = s.course_id
                LEFT JOIN course_levels cl ON cl.id = s.course_level_id
                LEFT JOIN assignment_submissions asub ON asub.assignment_id = a.id
                WHERE a.created_by = ?
                GROUP BY
                    a.id,
                    a.subject_id,
                    a.title,
                    a.description,
                    a.instructions,
                    a.due_at,
                    a.total_marks,
                    a.allow_late_submission,
                    a.status,
                    a.created_at,
                    s.subject_code,
                    s.subject_name,
                    c.course_name,
                    cl.level_name
                ORDER BY a.created_at DESC
            `, [req.user.userId]);

            return res.json({ success: true, assignments: rows });
        } catch (error) {
            console.error("Faculty assignment list error:", error);
            return res.status(500).json({
                success: false,
                message: "Unable to load your assignments"
            });
        }
    }
);

router.patch(
    "/faculty/:id/publication",
    authenticateUser,
    authorizeRoles("faculty"),
    async (req, res) => {
        const id = Number(req.params.id);
        const isPublished = asBool(req.body.isPublished);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ success: false, message: "Invalid assignment" });
        }

        try {
            const [result] = await db.query(`
                UPDATE assignments
                SET status = ?
                WHERE id = ? AND created_by = ?
            `, [isPublished ? "published" : "hidden", id, req.user.userId]);

            if (!result.affectedRows) {
                return res.status(404).json({
                    success: false,
                    message: "Assignment not found"
                });
            }

            return res.json({
                success: true,
                message: isPublished ? "Assignment published" : "Assignment hidden"
            });
        } catch (error) {
            console.error("Assignment publication error:", error);
            return res.status(500).json({
                success: false,
                message: "Unable to update assignment"
            });
        }
    }
);

router.get(
    "/faculty/:id/submissions",
    authenticateUser,
    authorizeRoles("faculty"),
    async (req, res) => {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ success: false, message: "Invalid assignment" });
        }

        try {
            const assignment = await assignmentRow(id);
            if (!assignment || Number(assignment.created_by) !== Number(req.user.userId)) {
                return res.status(404).json({
                    success: false,
                    message: "Assignment not found"
                });
            }

            const [submissions] = await db.query(`
                SELECT
                    asub.id,
                    asub.student_user_id,
                    asub.submission_text,
                    asub.submission_url,
                    asub.original_file_name,
                    asub.mime_type,
                    asub.file_size,
                    asub.submitted_at,
                    asub.status,
                    asub.marks_awarded,
                    asub.feedback,
                    asub.graded_at,
                    student.full_name AS student_name,
                    student.username,
                    student.email
                FROM assignment_submissions asub
                INNER JOIN users student ON student.id = asub.student_user_id
                WHERE asub.assignment_id = ?
                ORDER BY
                    asub.status = 'submitted' DESC,
                    asub.submitted_at DESC
            `, [id]);

            return res.json({
                success: true,
                assignment: {
                    id: assignment.id,
                    title: assignment.title,
                    subjectCode: assignment.subject_code,
                    subjectName: assignment.subject_name,
                    totalMarks: Number(assignment.total_marks),
                    dueAt: assignment.due_at,
                    status: assignment.status
                },
                submissions
            });
        } catch (error) {
            console.error("Faculty submissions error:", error);
            return res.status(500).json({
                success: false,
                message: "Unable to load assignment submissions"
            });
        }
    }
);

router.patch(
    "/faculty/submissions/:submissionId/grade",
    authenticateUser,
    authorizeRoles("faculty"),
    async (req, res) => {
        const submissionId = Number(req.params.submissionId);
        const marks = Number(req.body.marksAwarded);
        const feedback = clean(req.body.feedback);

        if (!Number.isInteger(submissionId) || submissionId <= 0 || !Number.isFinite(marks) || marks < 0) {
            return res.status(400).json({
                success: false,
                message: "Valid submission and marks are required"
            });
        }

        try {
            const [rows] = await db.query(`
                SELECT
                    asub.id,
                    a.total_marks,
                    a.created_by
                FROM assignment_submissions asub
                INNER JOIN assignments a ON a.id = asub.assignment_id
                WHERE asub.id = ?
                LIMIT 1
            `, [submissionId]);

            if (!rows.length || Number(rows[0].created_by) !== Number(req.user.userId)) {
                return res.status(404).json({
                    success: false,
                    message: "Submission not found"
                });
            }

            if (marks > Number(rows[0].total_marks)) {
                return res.status(400).json({
                    success: false,
                    message: `Marks cannot exceed ${Number(rows[0].total_marks)}`
                });
            }

            await db.query(`
                UPDATE assignment_submissions
                SET
                    marks_awarded = ?,
                    feedback = ?,
                    status = 'graded',
                    graded_by = ?,
                    graded_at = NOW()
                WHERE id = ?
            `, [marks, feedback || null, req.user.userId, submissionId]);

            return res.json({
                success: true,
                message: "Submission graded and feedback saved"
            });
        } catch (error) {
            console.error("Assignment grading error:", error);
            return res.status(500).json({
                success: false,
                message: "Unable to grade submission"
            });
        }
    }
);

/* =====================================================
   STUDENT ASSIGNMENTS
===================================================== */
router.get(
    "/student",
    authenticateUser,
    authorizeRoles("student"),
    async (req, res) => {
        try {
            const profile = await studentProfile(req.user.userId);
            if (!profile) {
                return res.status(400).json({
                    success: false,
                    message: "Your student course profile is not configured"
                });
            }

            const level = levelClause(profile, "s");

            const [rows] = await db.query(`
                SELECT
                    a.id,
                    a.title,
                    a.description,
                    a.instructions,
                    a.due_at,
                    a.total_marks,
                    a.allow_late_submission,
                    a.created_at,
                    s.id AS subject_id,
                    s.subject_code,
                    s.subject_name,
                    creator.full_name AS faculty_name,
                    asub.id AS submission_id,
                    asub.submission_text,
                    asub.submission_url,
                    asub.original_file_name,
                    asub.submitted_at,
                    asub.status AS submission_status,
                    asub.marks_awarded,
                    asub.feedback,
                    asub.graded_at
                FROM assignments a
                INNER JOIN subjects s ON s.id = a.subject_id
                INNER JOIN courses c ON c.id = s.course_id
                INNER JOIN users creator ON creator.id = a.created_by
                LEFT JOIN assignment_submissions asub
                    ON asub.assignment_id = a.id
                   AND asub.student_user_id = ?
                WHERE a.status = 'published'
                  AND s.is_active = 1
                  AND c.is_active = 1
                  AND s.course_id = ?
                  ${level.sql}
                ORDER BY
                    a.due_at IS NULL,
                    a.due_at ASC,
                    a.created_at DESC
            `, [
                req.user.userId,
                profile.course_id,
                ...level.values
            ]);

            const assignments = rows.map((row) => {
                const due = row.due_at ? new Date(row.due_at).getTime() : null;
                const late = due !== null && Date.now() > due;
                return {
                    ...row,
                    total_marks: Number(row.total_marks),
                    marks_awarded: row.marks_awarded === null ? null : Number(row.marks_awarded),
                    is_overdue: late,
                    can_submit: !late || Number(row.allow_late_submission) === 1
                };
            });

            return res.json({
                success: true,
                profile: {
                    courseName: profile.course_name,
                    levelName: profile.level_name
                },
                assignments
            });
        } catch (error) {
            console.error("Student assignments error:", error);
            return res.status(500).json({
                success: false,
                message: "Unable to load assignments"
            });
        }
    }
);

router.post(
    "/student/:id/submit",
    authenticateUser,
    authorizeRoles("student"),
    uploadSingle,
    async (req, res) => {
        const assignmentId = Number(req.params.id);
        const submissionText = clean(req.body.submissionText);
        const submissionUrl = clean(req.body.submissionUrl);

        if (!Number.isInteger(assignmentId) || assignmentId <= 0) {
            cleanup(req.file);
            return res.status(400).json({ success: false, message: "Invalid assignment" });
        }

        if (!submissionText && !submissionUrl && !req.file) {
            cleanup(req.file);
            return res.status(400).json({
                success: false,
                message: "Add submission text, a link, or a file"
            });
        }

        try {
            const profile = await studentProfile(req.user.userId);
            const assignment = await assignmentRow(assignmentId);

            if (!profile || !assignment || assignment.status !== "published") {
                cleanup(req.file);
                return res.status(404).json({
                    success: false,
                    message: "Assignment is unavailable"
                });
            }

            if (Number(assignment.course_id) !== Number(profile.course_id)) {
                cleanup(req.file);
                return res.status(403).json({
                    success: false,
                    message: "This assignment is not part of your course"
                });
            }

            if (
                assignment.course_level_id !== null &&
                Number(assignment.course_level_id) !== Number(profile.course_level_id)
            ) {
                cleanup(req.file);
                return res.status(403).json({
                    success: false,
                    message: "This assignment is not part of your current level"
                });
            }

            if (!dueAllowsSubmission(assignment)) {
                cleanup(req.file);
                return res.status(409).json({
                    success: false,
                    message: "The submission deadline has passed"
                });
            }

            const [existingRows] = await db.query(`
                SELECT id, file_path, stored_file_name, status
                FROM assignment_submissions
                WHERE assignment_id = ? AND student_user_id = ?
                LIMIT 1
            `, [assignmentId, req.user.userId]);

            if (existingRows.length && existingRows[0].status === "graded") {
                cleanup(req.file);
                return res.status(409).json({
                    success: false,
                    message: "This submission has already been graded"
                });
            }

            let fileData = {
                originalFileName: null,
                storedFileName: null,
                filePath: null,
                mimeType: null,
                fileSize: null
            };

            if (req.file) {
                fileData = {
                    originalFileName: req.file.originalname,
                    storedFileName: req.file.filename,
                    filePath: req.file.path,
                    mimeType: req.file.mimetype,
                    fileSize: req.file.size
                };
            }

            if (existingRows.length) {
                const existing = existingRows[0];
                const keepOldFile = !req.file;

                await db.query(`
                    UPDATE assignment_submissions
                    SET
                        submission_text = ?,
                        submission_url = ?,
                        original_file_name = ?,
                        stored_file_name = ?,
                        file_path = ?,
                        mime_type = ?,
                        file_size = ?,
                        submitted_at = NOW(),
                        status = 'submitted',
                        marks_awarded = NULL,
                        feedback = NULL,
                        graded_by = NULL,
                        graded_at = NULL
                    WHERE id = ?
                `, [
                    submissionText || null,
                    submissionUrl || null,
                    keepOldFile ? null : fileData.originalFileName,
                    keepOldFile ? null : fileData.storedFileName,
                    keepOldFile ? existing.file_path : fileData.filePath,
                    keepOldFile ? null : fileData.mimeType,
                    keepOldFile ? null : fileData.fileSize,
                    existing.id
                ]);

                if (req.file && existing.file_path && existing.file_path !== req.file.path) {
                    fs.unlink(existing.file_path, () => {});
                }

                return res.json({
                    success: true,
                    message: "Assignment submission updated"
                });
            }

            await db.query(`
                INSERT INTO assignment_submissions
                (
                    assignment_id,
                    student_user_id,
                    submission_text,
                    submission_url,
                    original_file_name,
                    stored_file_name,
                    file_path,
                    mime_type,
                    file_size,
                    submitted_at,
                    status
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), 'submitted')
            `, [
                assignmentId,
                req.user.userId,
                submissionText || null,
                submissionUrl || null,
                fileData.originalFileName,
                fileData.storedFileName,
                fileData.filePath,
                fileData.mimeType,
                fileData.fileSize
            ]);

            return res.status(201).json({
                success: true,
                message: "Assignment submitted successfully"
            });
        } catch (error) {
            cleanup(req.file);
            console.error("Student assignment submission error:", error);
            return res.status(500).json({
                success: false,
                message: "Unable to submit assignment"
            });
        }
    }
);

/* =====================================================
   PROTECTED SUBMISSION FILE DOWNLOAD
===================================================== */
router.get(
    "/submissions/:submissionId/file",
    authenticateUser,
    authorizeRoles("student", "faculty", "admin"),
    async (req, res) => {
        const submissionId = Number(req.params.submissionId);
        if (!Number.isInteger(submissionId) || submissionId <= 0) {
            return res.status(400).json({ success: false, message: "Invalid submission" });
        }

        try {
            const [rows] = await db.query(`
                SELECT
                    asub.id,
                    asub.student_user_id,
                    asub.file_path,
                    asub.original_file_name,
                    a.created_by,
                    a.subject_id
                FROM assignment_submissions asub
                INNER JOIN assignments a ON a.id = asub.assignment_id
                WHERE asub.id = ?
                LIMIT 1
            `, [submissionId]);

            if (!rows.length || !rows[0].file_path) {
                return res.status(404).json({ success: false, message: "Submission file not found" });
            }

            const row = rows[0];
            let allowed = req.user.role === "admin";

            if (req.user.role === "student") {
                allowed = Number(row.student_user_id) === Number(req.user.userId);
            }

            if (req.user.role === "faculty") {
                allowed = Number(row.created_by) === Number(req.user.userId);
            }

            if (!allowed) {
                return res.status(403).json({ success: false, message: "File access denied" });
            }

            if (!fs.existsSync(row.file_path)) {
                return res.status(404).json({ success: false, message: "Submission file is missing" });
            }

            return res.download(
                row.file_path,
                row.original_file_name || path.basename(row.file_path)
            );
        } catch (error) {
            console.error("Submission download error:", error);
            return res.status(500).json({ success: false, message: "Unable to download file" });
        }
    }
);

/* =====================================================
   ADMIN OVERSIGHT
===================================================== */
router.get(
    "/admin",
    authenticateUser,
    authorizeRoles("admin"),
    async (req, res) => {
        try {
            const [rows] = await db.query(`
                SELECT
                    a.id,
                    a.title,
                    a.description,
                    a.due_at,
                    a.total_marks,
                    a.allow_late_submission,
                    a.status,
                    a.created_at,
                    s.subject_code,
                    s.subject_name,
                    c.course_name,
                    cl.level_name,
                    creator.full_name AS faculty_name,
                    COUNT(asub.id) AS submission_count,
                    SUM(asub.status = 'graded') AS graded_count,
                    SUM(asub.status = 'submitted') AS awaiting_grade_count
                FROM assignments a
                INNER JOIN subjects s ON s.id = a.subject_id
                INNER JOIN courses c ON c.id = s.course_id
                LEFT JOIN course_levels cl ON cl.id = s.course_level_id
                INNER JOIN users creator ON creator.id = a.created_by
                LEFT JOIN assignment_submissions asub ON asub.assignment_id = a.id
                GROUP BY
                    a.id,
                    a.title,
                    a.description,
                    a.due_at,
                    a.total_marks,
                    a.allow_late_submission,
                    a.status,
                    a.created_at,
                    s.subject_code,
                    s.subject_name,
                    c.course_name,
                    cl.level_name,
                    creator.full_name
                ORDER BY a.created_at DESC
            `);

            return res.json({ success: true, assignments: rows });
        } catch (error) {
            console.error("Admin assignment oversight error:", error);
            return res.status(500).json({
                success: false,
                message: "Unable to load assignments"
            });
        }
    }
);

router.patch(
    "/admin/:id/publication",
    authenticateUser,
    authorizeRoles("admin"),
    async (req, res) => {
        const id = Number(req.params.id);
        const isPublished = asBool(req.body.isPublished);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ success: false, message: "Invalid assignment" });
        }

        try {
            const [result] = await db.query(`
                UPDATE assignments
                SET status = ?
                WHERE id = ?
            `, [isPublished ? "published" : "hidden", id]);

            if (!result.affectedRows) {
                return res.status(404).json({ success: false, message: "Assignment not found" });
            }

            return res.json({
                success: true,
                message: isPublished ? "Assignment restored" : "Assignment hidden"
            });
        } catch (error) {
            console.error("Admin assignment moderation error:", error);
            return res.status(500).json({
                success: false,
                message: "Unable to update assignment"
            });
        }
    }
);

module.exports = router;
