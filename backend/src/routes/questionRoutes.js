const express = require("express");

const db = require("../config/db");
const authenticateUser = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

const router = express.Router();

function normalizeQuestionType(value) {
    const type = String(value || "").trim().toLowerCase();
    return ["mcq", "true_false", "short_answer"].includes(type) ? type : null;
}

function normalizeDifficulty(value) {
    const difficulty = String(value || "").trim().toLowerCase();
    return ["easy", "medium", "hard"].includes(difficulty) ? difficulty : "medium";
}

async function canUseSubject(userId, role, subjectId) {
    if (role === "admin") {
        const [rows] = await db.query(`
            SELECT s.id
            FROM subjects s
            INNER JOIN courses c ON s.course_id = c.id
            WHERE s.id = ?
              AND s.is_active = 1
              AND c.is_active = 1
            LIMIT 1
        `, [subjectId]);

        return rows.length > 0;
    }

    const [rows] = await db.query(`
        SELECT s.id
        FROM faculty_subject_assignments fsa
        INNER JOIN subjects s ON fsa.subject_id = s.id
        INNER JOIN courses c ON s.course_id = c.id
        WHERE fsa.faculty_user_id = ?
          AND fsa.subject_id = ?
          AND fsa.is_active = 1
          AND s.is_active = 1
          AND c.is_active = 1
        LIMIT 1
    `, [userId, subjectId]);

    return rows.length > 0;
}

async function validateUnit(subjectId, unitId) {
    if (unitId === null) return true;

    const [rows] = await db.query(`
        SELECT id
        FROM subject_units
        WHERE id = ?
          AND subject_id = ?
          AND is_active = 1
        LIMIT 1
    `, [unitId, subjectId]);

    return rows.length > 0;
}

async function getStudentAcademicProfile(userId) {
    const [rows] = await db.query(`
        SELECT
            sp.user_id,
            sp.course_id,
            sp.course_level_id,
            c.course_code,
            c.course_name,
            cl.level_name,
            d.department_name,
            ed.domain_name
        FROM student_profiles sp
        INNER JOIN courses c ON sp.course_id = c.id
        LEFT JOIN course_levels cl ON sp.course_level_id = cl.id
        LEFT JOIN departments d ON c.department_id = d.id
        LEFT JOIN education_domains ed ON c.domain_id = ed.id
        WHERE sp.user_id = ?
          AND c.is_active = 1
        LIMIT 1
    `, [userId]);

    return rows[0] || null;
}

function studentLevelCondition(profile) {
    if (profile.course_level_id) {
        return {
            sql: `
                AND
                (
                    s.course_level_id IS NULL
                    OR s.course_level_id = ?
                )
            `,
            values: [profile.course_level_id]
        };
    }

    return {
        sql: `AND s.course_level_id IS NULL`,
        values: []
    };
}

function validateQuestionPayload(body) {
    const subjectId = Number(body.subjectId);

    const rawUnitId = body.unitId;
    const unitId =
        rawUnitId === null ||
        rawUnitId === undefined ||
        rawUnitId === ""
            ? null
            : Number(rawUnitId);

    const questionType = normalizeQuestionType(body.questionType);
    const questionText = String(body.questionText || "").trim();
    const explanation = String(body.explanation || "").trim();
    const difficulty = normalizeDifficulty(body.difficulty);
    const marks = Number(body.marks || 1);
    const correctAnswer = String(body.correctAnswer || "").trim();

    const options = Array.isArray(body.options) ? body.options : [];

    if (
        !Number.isInteger(subjectId) ||
        subjectId <= 0 ||
        !questionType ||
        !questionText
    ) {
        return {
            ok: false,
            message: "Subject, question type and question text are required"
        };
    }

    if (
        unitId !== null &&
        (!Number.isInteger(unitId) || unitId <= 0)
    ) {
        return {
            ok: false,
            message: "Invalid unit"
        };
    }

    if (!Number.isFinite(marks) || marks <= 0 || marks > 100) {
        return {
            ok: false,
            message: "Marks must be greater than 0 and at most 100"
        };
    }

    let normalizedOptions = [];

    if (questionType === "mcq") {
        normalizedOptions = options
            .map((option, index) => ({
                label: String(
                    option.label ||
                    String.fromCharCode(65 + index)
                ).trim().toUpperCase(),

                text: String(option.text || "").trim(),

                isCorrect: Boolean(option.isCorrect),

                order: index + 1
            }))
            .filter((option) => option.text);

        if (
            normalizedOptions.length < 2 ||
            normalizedOptions.length > 6
        ) {
            return {
                ok: false,
                message: "MCQ requires 2 to 6 options"
            };
        }

        const correctCount = normalizedOptions.filter(
            (option) => option.isCorrect
        ).length;

        if (correctCount !== 1) {
            return {
                ok: false,
                message: "MCQ requires exactly one correct option"
            };
        }
    }

    if (
        questionType === "true_false" &&
        !["true", "false"].includes(correctAnswer.toLowerCase())
    ) {
        return {
            ok: false,
            message: "True/False question requires True or False as the correct answer"
        };
    }

    if (
        questionType === "short_answer" &&
        !correctAnswer
    ) {
        return {
            ok: false,
            message: "Short Answer question requires a correct answer"
        };
    }

    return {
        ok: true,
        value: {
            subjectId,
            unitId,
            questionType,
            questionText,
            correctAnswer: questionType === "mcq" ? null : correctAnswer,
            explanation: explanation || null,
            difficulty,
            marks,
            options: normalizedOptions
        }
    };
}

async function insertOptions(connection, questionId, options) {
    for (const option of options) {
        await connection.query(`
            INSERT INTO question_options
            (
                question_id,
                option_label,
                option_text,
                is_correct,
                option_order
            )
            VALUES (?, ?, ?, ?, ?)
        `, [
            questionId,
            option.label,
            option.text,
            option.isCorrect ? 1 : 0,
            option.order
        ]);
    }
}


/* =====================================================
   FACULTY / ADMIN META
===================================================== */

router.get(
    "/meta",
    authenticateUser,
    authorizeRoles("faculty", "admin"),
    async (req, res) => {
        try {
            let subjects;

            if (req.user.role === "admin") {
                [subjects] = await db.query(`
                    SELECT
                        s.id,
                        s.subject_code,
                        s.subject_name,
                        c.course_code,
                        c.course_name,
                        cl.level_name
                    FROM subjects s
                    INNER JOIN courses c ON s.course_id = c.id
                    LEFT JOIN course_levels cl ON s.course_level_id = cl.id
                    WHERE s.is_active = 1
                      AND c.is_active = 1
                    ORDER BY c.course_name, cl.level_order, s.subject_name
                `);
            } else {
                [subjects] = await db.query(`
                    SELECT
                        s.id,
                        s.subject_code,
                        s.subject_name,
                        c.course_code,
                        c.course_name,
                        cl.level_name
                    FROM faculty_subject_assignments fsa
                    INNER JOIN subjects s ON fsa.subject_id = s.id
                    INNER JOIN courses c ON s.course_id = c.id
                    LEFT JOIN course_levels cl ON s.course_level_id = cl.id
                    WHERE fsa.faculty_user_id = ?
                      AND fsa.is_active = 1
                      AND s.is_active = 1
                      AND c.is_active = 1
                    ORDER BY c.course_name, cl.level_order, s.subject_name
                `, [req.user.userId]);
            }

            const subjectIds = subjects.map((subject) => subject.id);

            let units = [];

            if (subjectIds.length > 0) {
                const placeholders = subjectIds.map(() => "?").join(",");

                [units] = await db.query(`
                    SELECT
                        id,
                        subject_id,
                        unit_name,
                        unit_order
                    FROM subject_units
                    WHERE subject_id IN (${placeholders})
                      AND is_active = 1
                    ORDER BY subject_id, unit_order, unit_name
                `, subjectIds);
            }

            return res.json({
                success: true,
                subjects,
                units
            });
        } catch (error) {
            console.error("Question meta error:", error);

            return res.status(500).json({
                success: false,
                message: "Unable to load Question Bank options"
            });
        }
    }
);


/* =====================================================
   ADMIN UNIT MANAGEMENT
===================================================== */

router.post(
    "/units",
    authenticateUser,
    authorizeRoles("faculty", "admin"),
    async (req, res) => {
        const subjectId = Number(req.body.subjectId);
        const unitName = String(req.body.unitName || "").trim();
        const unitOrder = Number(req.body.unitOrder || 1);

        if (
            !Number.isInteger(subjectId) ||
            subjectId <= 0 ||
            !unitName ||
            !Number.isInteger(unitOrder) ||
            unitOrder <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Subject, unit name and display order are required"
            });
        }

        try {
            if (
                !(await canUseSubject(
                    req.user.userId,
                    req.user.role,
                    subjectId
                ))
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Selected subject is not available"
                });
            }

            const [result] = await db.query(`
                INSERT INTO subject_units
                (
                    subject_id,
                    unit_name,
                    unit_order,
                    is_active
                )
                VALUES (?, ?, ?, 1)
            `, [
                subjectId,
                unitName,
                unitOrder
            ]);

            return res.status(201).json({
                success: true,
                message: "Subject unit added successfully",
                unitId: result.insertId
            });
        } catch (error) {
            if (error.code === "ER_DUP_ENTRY") {
                return res.status(409).json({
                    success: false,
                    message: "This unit already exists for the selected subject"
                });
            }

            console.error("Create unit error:", error);

            return res.status(500).json({
                success: false,
                message: "Unable to create subject unit"
            });
        }
    }
);

router.patch(
    "/units/:id/status",
    authenticateUser,
    authorizeRoles("faculty", "admin"),
    async (req, res) => {
        const unitId = Number(req.params.id);

        const isActive =
            req.body.isActive === true ||
            req.body.isActive === 1 ||
            req.body.isActive === "1";

        if (!Number.isInteger(unitId) || unitId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid unit"
            });
        }

        try {
            const [unitRows] = await db.query(`
                SELECT id, subject_id
                FROM subject_units
                WHERE id = ?
                LIMIT 1
            `, [unitId]);

            if (unitRows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Unit not found"
                });
            }

            if (
                !(await canUseSubject(
                    req.user.userId,
                    req.user.role,
                    unitRows[0].subject_id
                ))
            ) {
                return res.status(403).json({
                    success: false,
                    message: "You cannot manage units for this subject"
                });
            }

            const [result] = await db.query(`
                UPDATE subject_units
                SET is_active = ?
                WHERE id = ?
            `, [
                isActive ? 1 : 0,
                unitId
            ]);

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Unit not found"
                });
            }

            return res.json({
                success: true,
                message: isActive ? "Unit activated" : "Unit deactivated"
            });
        } catch (error) {
            console.error("Unit status error:", error);

            return res.status(500).json({
                success: false,
                message: "Unable to update unit"
            });
        }
    }
);


/* =====================================================
   CREATE QUESTION
===================================================== */

router.post(
    "/questions",
    authenticateUser,
    authorizeRoles("faculty", "admin"),
    async (req, res) => {
        const parsed = validateQuestionPayload(req.body);

        if (!parsed.ok) {
            return res.status(400).json({
                success: false,
                message: parsed.message
            });
        }

        const question = parsed.value;

        let connection;

        try {
            if (
                !(await canUseSubject(
                    req.user.userId,
                    req.user.role,
                    question.subjectId
                ))
            ) {
                return res.status(403).json({
                    success: false,
                    message: "You are not allowed to add questions to this subject"
                });
            }

            if (
                !(await validateUnit(
                    question.subjectId,
                    question.unitId
                ))
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Selected unit does not belong to the selected subject"
                });
            }

            connection = await db.getConnection();

            await connection.beginTransaction();

            const isAdmin = req.user.role === "admin";
            const status = "approved";

            const [result] = await connection.query(`
                INSERT INTO question_bank
                (
                    subject_id,
                    unit_id,
                    created_by,
                    question_type,
                    question_text,
                    correct_answer,
                    explanation,
                    difficulty,
                    marks,
                    verification_status,
                    verified_by,
                    verified_at,
                    is_active
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
            `, [
                question.subjectId,
                question.unitId,
                req.user.userId,
                question.questionType,
                question.questionText,
                question.correctAnswer,
                question.explanation,
                question.difficulty,
                question.marks,
                status,
                isAdmin ? req.user.userId : null,
                new Date()
            ]);

            if (question.questionType === "mcq") {
                await insertOptions(
                    connection,
                    result.insertId,
                    question.options
                );
            }

            await connection.commit();

            return res.status(201).json({
                success: true,
                message: isAdmin
                    ? "Question added and published"
                    : "Question published to your assigned subject",
                questionId: result.insertId,
                verificationStatus: status
            });
        } catch (error) {
            if (connection) {
                try {
                    await connection.rollback();
                } catch (_) {}
            }

            console.error("Create question error:", error);

            return res.status(500).json({
                success: false,
                message: "Unable to save question"
            });
        } finally {
            if (connection) {
                connection.release();
            }
        }
    }
);


/* =====================================================
   OWN QUESTIONS
===================================================== */

router.get(
    "/questions/mine",
    authenticateUser,
    authorizeRoles("faculty", "admin"),
    async (req, res) => {
        try {
            const [questions] = await db.query(`
                SELECT
                    q.id,
                    q.question_type,
                    q.question_text,
                    q.correct_answer,
                    q.explanation,
                    q.difficulty,
                    q.marks,
                    q.verification_status,
                    q.created_at,
                    s.subject_code,
                    s.subject_name,
                    su.unit_name,
                    c.course_name
                FROM question_bank q
                INNER JOIN subjects s ON q.subject_id = s.id
                INNER JOIN courses c ON s.course_id = c.id
                LEFT JOIN subject_units su ON q.unit_id = su.id
                WHERE q.created_by = ?
                ORDER BY q.created_at DESC
            `, [req.user.userId]);

            return res.json({
                success: true,
                count: questions.length,
                questions
            });
        } catch (error) {
            console.error("Own questions error:", error);

            return res.status(500).json({
                success: false,
                message: "Unable to load your questions"
            });
        }
    }
);



/* FACULTY / ADMIN QUESTION PUBLICATION CONTROL */
router.patch(
    "/questions/:id/publication",
    authenticateUser,
    authorizeRoles("faculty", "admin"),
    async (req, res) => {
        const questionId = Number(req.params.id);
        const isPublished =
            req.body.isPublished === true ||
            req.body.isPublished === 1 ||
            req.body.isPublished === "1";

        if (!Number.isInteger(questionId) || questionId <= 0) {
            return res.status(400).json({ success:false, message:"Invalid question" });
        }

        try {
            const [rows] = await db.query(
                `SELECT id, created_by FROM question_bank WHERE id=? LIMIT 1`,
                [questionId]
            );

            if (!rows.length) {
                return res.status(404).json({ success:false, message:"Question not found" });
            }

            if (
                req.user.role === "faculty" &&
                Number(rows[0].created_by) !== Number(req.user.userId)
            ) {
                return res.status(403).json({
                    success:false,
                    message:"You can control only your own questions"
                });
            }

            await db.query(
                `UPDATE question_bank
                 SET verification_status=?,
                     verified_by=?,
                     verified_at=NOW()
                 WHERE id=?`,
                [
                    isPublished ? "approved" : "rejected",
                    req.user.role === "admin" ? req.user.userId : null,
                    questionId
                ]
            );

            return res.json({
                success:true,
                message:isPublished ? "Question published" : "Question unpublished"
            });
        } catch (error) {
            console.error("Question publication error:", error);
            return res.status(500).json({
                success:false,
                message:"Unable to update question publication"
            });
        }
    }
);


/* =====================================================
   DELETE QUESTION
===================================================== */

router.delete(
    "/questions/:id",
    authenticateUser,
    authorizeRoles("faculty", "admin"),
    async (req, res) => {
        const questionId = Number(req.params.id);

        if (!Number.isInteger(questionId) || questionId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid question"
            });
        }

        try {
            const [rows] = await db.query(`
                SELECT created_by
                FROM question_bank
                WHERE id = ?
                LIMIT 1
            `, [questionId]);

            if (rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Question not found"
                });
            }

            if (
                req.user.role === "faculty" &&
                Number(rows[0].created_by) !== Number(req.user.userId)
            ) {
                return res.status(403).json({
                    success: false,
                    message: "You can delete only your own questions"
                });
            }

            await db.query(`
                DELETE FROM question_bank
                WHERE id = ?
            `, [questionId]);

            return res.json({
                success: true,
                message: "Question deleted"
            });
        } catch (error) {
            console.error("Delete question error:", error);

            return res.status(500).json({
                success: false,
                message: "Unable to delete question"
            });
        }
    }
);


/* =====================================================
   ADMIN QUESTION OVERSIGHT
===================================================== */

router.get(
    "/admin/questions",
    authenticateUser,
    authorizeRoles("admin"),
    async (req, res) => {
        try {
            const status = String(
                req.query.status || ""
            ).trim().toLowerCase();

            const subjectId = Number(req.query.subjectId);

            const search = String(
                req.query.search || ""
            ).trim();

            let sql = `
                SELECT
                    q.id,
                    q.question_type,
                    q.question_text,
                    q.difficulty,
                    q.marks,
                    q.verification_status,
                    q.created_at,
                    s.id AS subject_id,
                    s.subject_code,
                    s.subject_name,
                    su.unit_name,
                    c.course_name,
                    creator.full_name AS creator_name,
                    verifier.full_name AS verifier_name
                FROM question_bank q
                INNER JOIN subjects s ON q.subject_id = s.id
                INNER JOIN courses c ON s.course_id = c.id
                LEFT JOIN subject_units su ON q.unit_id = su.id
                INNER JOIN users creator ON q.created_by = creator.id
                LEFT JOIN users verifier ON q.verified_by = verifier.id
                WHERE q.is_active = 1
            `;

            const values = [];

            if (
                ["pending", "approved", "rejected"].includes(status)
            ) {
                sql += ` AND q.verification_status = ?`;
                values.push(status);
            }

            if (
                Number.isInteger(subjectId) &&
                subjectId > 0
            ) {
                sql += ` AND q.subject_id = ?`;
                values.push(subjectId);
            }

            if (search) {
                const term = `%${search}%`;

                sql += `
                    AND
                    (
                        q.question_text LIKE ?
                        OR s.subject_name LIKE ?
                        OR s.subject_code LIKE ?
                        OR c.course_name LIKE ?
                        OR creator.full_name LIKE ?
                    )
                `;

                values.push(
                    term,
                    term,
                    term,
                    term,
                    term
                );
            }

            sql += `
                ORDER BY
                    CASE q.verification_status
                        WHEN 'pending' THEN 1
                        WHEN 'approved' THEN 2
                        ELSE 3
                    END,
                    q.created_at DESC
            `;

            const [questions] = await db.query(sql, values);

            return res.json({
                success: true,
                count: questions.length,
                questions
            });
        } catch (error) {
            console.error("Admin questions error:", error);

            return res.status(500).json({
                success: false,
                message: "Unable to load Question Bank"
            });
        }
    }
);

router.patch(
    "/admin/questions/:id/verification",
    authenticateUser,
    authorizeRoles("admin"),
    async (req, res) => {
        const questionId = Number(req.params.id);
        const status = String(
            req.body.status || ""
        ).trim().toLowerCase();

        if (
            !Number.isInteger(questionId) ||
            questionId <= 0 ||
            !["approved", "rejected"].includes(status)
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid verification request"
            });
        }

        try {
            const [result] = await db.query(`
                UPDATE question_bank
                SET
                    verification_status = ?,
                    verified_by = ?,
                    verified_at = NOW()
                WHERE id = ?
            `, [
                status,
                req.user.userId,
                questionId
            ]);

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Question not found"
                });
            }

            return res.json({
                success: true,
                message: `Question ${status}`
            });
        } catch (error) {
            console.error("Question verification error:", error);

            return res.status(500).json({
                success: false,
                message: "Unable to update question verification"
            });
        }
    }
);


/* =====================================================
   STUDENT META
===================================================== */

router.get(
    "/student/meta",
    authenticateUser,
    authorizeRoles("student"),
    async (req, res) => {
        try {
            const profile = await getStudentAcademicProfile(
                req.user.userId
            );

            if (!profile) {
                return res.status(400).json({
                    success: false,
                    message: "Your student course profile is not configured"
                });
            }

            const levelCondition = studentLevelCondition(profile);

            const [subjects] = await db.query(`
                SELECT
                    s.id,
                    s.subject_code,
                    s.subject_name
                FROM subjects s
                WHERE s.course_id = ?
                  AND s.is_active = 1
                ${levelCondition.sql}
                ORDER BY s.subject_name
            `, [
                profile.course_id,
                ...levelCondition.values
            ]);

            const subjectIds = subjects.map((subject) => subject.id);

            let units = [];

            if (subjectIds.length > 0) {
                const placeholders = subjectIds.map(() => "?").join(",");

                [units] = await db.query(`
                    SELECT
                        id,
                        subject_id,
                        unit_name,
                        unit_order
                    FROM subject_units
                    WHERE subject_id IN (${placeholders})
                      AND is_active = 1
                    ORDER BY subject_id, unit_order, unit_name
                `, subjectIds);
            }

            return res.json({
                success: true,
                profile: {
                    courseId: profile.course_id,
                    courseCode: profile.course_code,
                    courseName: profile.course_name,
                    levelName: profile.level_name,
                    domainName: profile.domain_name,
                    departmentName: profile.department_name
                },
                subjects,
                units
            });
        } catch (error) {
            console.error("Student question meta error:", error);

            return res.status(500).json({
                success: false,
                message: "Unable to load your Question Bank"
            });
        }
    }
);


/* =====================================================
   STUDENT APPROVED QUESTIONS
===================================================== */

router.get(
    "/student/questions",
    authenticateUser,
    authorizeRoles("student"),
    async (req, res) => {
        try {
            const profile = await getStudentAcademicProfile(
                req.user.userId
            );

            if (!profile) {
                return res.status(400).json({
                    success: false,
                    message: "Your student course profile is not configured"
                });
            }

            const subjectId = Number(req.query.subjectId);
            const unitId = Number(req.query.unitId);
            const questionType = normalizeQuestionType(
                req.query.questionType
            );

            const difficulty = String(
                req.query.difficulty || ""
            ).trim().toLowerCase();

            const search = String(
                req.query.search || ""
            ).trim();

            const levelCondition = studentLevelCondition(profile);

            let sql = `
                SELECT
                    q.id,
                    q.question_type,
                    q.question_text,
                    q.difficulty,
                    q.marks,
                    s.id AS subject_id,
                    s.subject_code,
                    s.subject_name,
                    su.id AS unit_id,
                    su.unit_name
                FROM question_bank q
                INNER JOIN subjects s ON q.subject_id = s.id
                INNER JOIN courses c ON s.course_id = c.id
                LEFT JOIN subject_units su ON q.unit_id = su.id
                WHERE q.verification_status = 'approved'
                  AND q.is_active = 1
                  AND s.is_active = 1
                  AND c.is_active = 1
                  AND s.course_id = ?
                ${levelCondition.sql}
            `;

            const values = [
                profile.course_id,
                ...levelCondition.values
            ];

            if (
                Number.isInteger(subjectId) &&
                subjectId > 0
            ) {
                sql += ` AND q.subject_id = ?`;
                values.push(subjectId);
            }

            if (
                Number.isInteger(unitId) &&
                unitId > 0
            ) {
                sql += ` AND q.unit_id = ?`;
                values.push(unitId);
            }

            if (questionType) {
                sql += ` AND q.question_type = ?`;
                values.push(questionType);
            }

            if (
                ["easy", "medium", "hard"].includes(difficulty)
            ) {
                sql += ` AND q.difficulty = ?`;
                values.push(difficulty);
            }

            if (search) {
                const term = `%${search}%`;

                sql += `
                    AND
                    (
                        q.question_text LIKE ?
                        OR s.subject_name LIKE ?
                        OR s.subject_code LIKE ?
                        OR su.unit_name LIKE ?
                    )
                `;

                values.push(
                    term,
                    term,
                    term,
                    term
                );
            }

            sql += `
                ORDER BY
                    s.subject_name,
                    su.unit_order,
                    q.created_at DESC
            `;

            const [questions] = await db.query(sql, values);

            const questionIds = questions.map(
                (question) => question.id
            );

            let options = [];

            if (questionIds.length > 0) {
                const placeholders = questionIds.map(() => "?").join(",");

                [options] = await db.query(`
                    SELECT
                        question_id,
                        option_label,
                        option_text,
                        option_order
                    FROM question_options
                    WHERE question_id IN (${placeholders})
                    ORDER BY question_id, option_order
                `, questionIds);
            }

            const optionsByQuestion = new Map();

            for (const option of options) {
                const key = String(option.question_id);

                if (!optionsByQuestion.has(key)) {
                    optionsByQuestion.set(key, []);
                }

                optionsByQuestion.get(key).push({
                    label: option.option_label,
                    text: option.option_text
                });
            }

            return res.json({
                success: true,
                count: questions.length,
                questions: questions.map((question) => ({
                    id: question.id,
                    questionType: question.question_type,
                    questionText: question.question_text,
                    difficulty: question.difficulty,
                    marks: question.marks,
                    subjectId: question.subject_id,
                    subjectCode: question.subject_code,
                    subjectName: question.subject_name,
                    unitId: question.unit_id,
                    unitName: question.unit_name,
                    options:
                        optionsByQuestion.get(
                            String(question.id)
                        ) || []
                }))
            });
        } catch (error) {
            console.error("Student questions error:", error);

            return res.status(500).json({
                success: false,
                message: "Unable to load approved questions"
            });
        }
    }
);


/* =====================================================
   STUDENT REVEAL ANSWER
===================================================== */

router.get(
    "/student/questions/:id/answer",
    authenticateUser,
    authorizeRoles("student"),
    async (req, res) => {
        const questionId = Number(req.params.id);

        if (!Number.isInteger(questionId) || questionId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid question"
            });
        }

        try {
            const profile = await getStudentAcademicProfile(
                req.user.userId
            );

            if (!profile) {
                return res.status(400).json({
                    success: false,
                    message: "Your student course profile is not configured"
                });
            }

            const levelCondition = studentLevelCondition(profile);

            const [rows] = await db.query(`
                SELECT
                    q.id,
                    q.question_type,
                    q.correct_answer,
                    q.explanation
                FROM question_bank q
                INNER JOIN subjects s ON q.subject_id = s.id
                INNER JOIN courses c ON s.course_id = c.id
                WHERE q.id = ?
                  AND q.verification_status = 'approved'
                  AND q.is_active = 1
                  AND s.is_active = 1
                  AND c.is_active = 1
                  AND s.course_id = ?
                ${levelCondition.sql}
                LIMIT 1
            `, [
                questionId,
                profile.course_id,
                ...levelCondition.values
            ]);

            if (rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Question not found for your course"
                });
            }

            const question = rows[0];

            let correctOptions = [];

            if (question.question_type === "mcq") {
                const [options] = await db.query(`
                    SELECT
                        option_label,
                        option_text
                    FROM question_options
                    WHERE question_id = ?
                      AND is_correct = 1
                    ORDER BY option_order
                `, [questionId]);

                correctOptions = options.map((option) => ({
                    label: option.option_label,
                    text: option.option_text
                }));
            }

            return res.json({
                success: true,
                answer: {
                    questionType: question.question_type,
                    correctAnswer: question.correct_answer,
                    correctOptions,
                    explanation: question.explanation
                }
            });
        } catch (error) {
            console.error("Reveal answer error:", error);

            return res.status(500).json({
                success: false,
                message: "Unable to reveal answer"
            });
        }
    }
);


module.exports = router;
