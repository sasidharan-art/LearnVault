const express = require("express");

const db = require("../config/db");
const authenticateUser = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

const router = express.Router();

function clean(value) {
    return String(value ?? "").trim();
}

function idOrNull(value) {
    if (value === null || value === undefined || value === "") return null;
    const n = Number(value);
    return Number.isInteger(n) && n > 0 ? n : null;
}

async function currentProfile(queryable, studentUserId, lock = false) {
    const [rows] = await queryable.query(
        `
        SELECT
            sp.user_id,
            sp.course_id,
            sp.course_level_id,
            c.course_code,
            c.course_name,
            cl.level_name,
            cl.level_order,
            d.department_name,
            ed.domain_name
        FROM student_profiles sp
        LEFT JOIN courses c ON c.id = sp.course_id
        LEFT JOIN course_levels cl ON cl.id = sp.course_level_id
        LEFT JOIN departments d ON d.id = c.department_id
        LEFT JOIN education_domains ed ON ed.id = c.domain_id
        WHERE sp.user_id = ?
        LIMIT 1
        ${lock ? "FOR UPDATE" : ""}
        `,
        [studentUserId]
    );
    return rows[0] || null;
}

async function validateDestination(queryable, courseId, courseLevelId) {
    const [courses] = await queryable.query(
        `
        SELECT
            c.id,
            c.course_code,
            c.course_name,
            c.department_id,
            d.department_name,
            ed.domain_name
        FROM courses c
        LEFT JOIN departments d ON d.id = c.department_id
        LEFT JOIN education_domains ed ON ed.id = c.domain_id
        WHERE
            c.id = ?
            AND c.is_active = 1
            AND (d.id IS NULL OR d.is_active = 1)
            AND (ed.id IS NULL OR ed.is_active = 1)
        LIMIT 1
        `,
        [courseId]
    );

    if (!courses.length) {
        return { valid: false, message: "Selected Course / Program is not active" };
    }

    const [levels] = await queryable.query(
        `
        SELECT id, course_id, level_name, level_order
        FROM course_levels
        WHERE course_id = ? AND is_active = 1
        ORDER BY level_order, level_name
        `,
        [courseId]
    );

    if (!levels.length) {
        if (courseLevelId !== null) {
            return { valid: false, message: "This Course does not require a Level / Year" };
        }
        return { valid: true, course: courses[0], level: null, levels };
    }

    if (courseLevelId === null) {
        return { valid: false, message: "Select a Current Level / Year" };
    }

    const level = levels.find((item) => Number(item.id) === Number(courseLevelId));

    if (!level) {
        return { valid: false, message: "Selected Level / Year does not belong to the selected Course" };
    }

    return { valid: true, course: courses[0], level, levels };
}

function deriveChangeType(profile, destination) {
    if (!profile || !profile.course_id) return "initial";

    if (Number(profile.course_id) !== Number(destination.course.id)) {
        const oldDepartment = clean(profile.department_name).toLowerCase();
        const newDepartment = clean(destination.course.department_name).toLowerCase();

        if (oldDepartment && newDepartment && oldDepartment !== newDepartment) {
            return "stream_change";
        }

        return "course_change";
    }

    if (
        profile.course_level_id &&
        destination.level &&
        Number(destination.level.level_order) > Number(profile.level_order || 0)
    ) {
        return "promotion";
    }

    return "level_change";
}

async function applyAcademicChange(
    connection,
    {
        studentUserId,
        toCourseId,
        toCourseLevelId,
        changedBy,
        requestedBy = null,
        note = null,
        forcedType = null
    }
) {
    const profile = await currentProfile(connection, studentUserId, true);
    const destination = await validateDestination(connection, toCourseId, toCourseLevelId);

    if (!destination.valid) {
        const error = new Error(destination.message);
        error.statusCode = 400;
        throw error;
    }

    if (
        profile &&
        Number(profile.course_id || 0) === Number(toCourseId) &&
        Number(profile.course_level_id || 0) === Number(toCourseLevelId || 0)
    ) {
        const error = new Error("Student is already in the selected Course / Level");
        error.statusCode = 409;
        throw error;
    }

    const changeType = forcedType || deriveChangeType(profile, destination);

    if (!profile) {
        await connection.query(
            `
            INSERT INTO student_profiles (user_id, course_id, course_level_id)
            VALUES (?, ?, ?)
            `,
            [studentUserId, toCourseId, toCourseLevelId]
        );
    } else {
        await connection.query(
            `
            UPDATE student_profiles
            SET course_id = ?, course_level_id = ?
            WHERE user_id = ?
            `,
            [toCourseId, toCourseLevelId, studentUserId]
        );
    }

    await connection.query(
        `
        INSERT INTO student_academic_history
        (
            student_user_id,
            from_course_id,
            from_course_level_id,
            to_course_id,
            to_course_level_id,
            change_type,
            requested_by,
            changed_by,
            note
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
            studentUserId,
            profile?.course_id || null,
            profile?.course_level_id || null,
            toCourseId,
            toCourseLevelId,
            changeType,
            requestedBy,
            changedBy,
            note
        ]
    );

    return { changeType, destination };
}

/* STUDENT: CURRENT PROGRESSION */

router.get(
    "/student",
    authenticateUser,
    authorizeRoles("student"),
    async (req, res) => {
        try {
            const profile = await currentProfile(db, req.user.userId);

            if (!profile || !profile.course_id) {
                return res.status(409).json({
                    success: false,
                    code: "STUDENT_PROFILE_REQUIRED",
                    message: "Configure your Course / Level first"
                });
            }

            await db.query(
                `
                INSERT INTO student_academic_history
                (
                    student_user_id,
                    from_course_id,
                    from_course_level_id,
                    to_course_id,
                    to_course_level_id,
                    change_type,
                    note
                )
                SELECT
                    ?,
                    NULL,
                    NULL,
                    ?,
                    ?,
                    'initial',
                    'Initial academic profile'
                WHERE NOT EXISTS
                (
                    SELECT 1
                    FROM student_academic_history
                    WHERE student_user_id = ?
                )
                `,
                [
                    req.user.userId,
                    profile.course_id,
                    profile.course_level_id,
                    req.user.userId
                ]
            );

            const [history] = await db.query(
                `
                SELECT
                    sah.id,
                    sah.change_type,
                    sah.note,
                    sah.created_at,
                    fc.course_code AS from_course_code,
                    fc.course_name AS from_course_name,
                    fl.level_name AS from_level_name,
                    tc.course_code AS to_course_code,
                    tc.course_name AS to_course_name,
                    tl.level_name AS to_level_name,
                    changer.full_name AS changed_by_name
                FROM student_academic_history sah
                LEFT JOIN courses fc ON fc.id = sah.from_course_id
                LEFT JOIN course_levels fl ON fl.id = sah.from_course_level_id
                INNER JOIN courses tc ON tc.id = sah.to_course_id
                LEFT JOIN course_levels tl ON tl.id = sah.to_course_level_id
                LEFT JOIN users changer ON changer.id = sah.changed_by
                WHERE sah.student_user_id = ?
                ORDER BY sah.created_at DESC, sah.id DESC
                `,
                [req.user.userId]
            );

            const [requests] = await db.query(
                `
                SELECT
                    req.id,
                    req.reason,
                    req.status,
                    req.review_note,
                    req.created_at,
                    req.reviewed_at,
                    c.course_code,
                    c.course_name,
                    cl.level_name,
                    reviewer.full_name AS reviewer_name
                FROM student_academic_change_requests req
                INNER JOIN courses c ON c.id = req.requested_course_id
                LEFT JOIN course_levels cl ON cl.id = req.requested_course_level_id
                LEFT JOIN users reviewer ON reviewer.id = req.reviewed_by
                WHERE req.student_user_id = ?
                ORDER BY req.created_at DESC, req.id DESC
                LIMIT 20
                `,
                [req.user.userId]
            );

            const [levels] = await db.query(
                `
                SELECT id, course_id, level_name, level_order
                FROM course_levels
                WHERE course_id = ? AND is_active = 1
                ORDER BY level_order, level_name
                `,
                [profile.course_id]
            );

            const nextLevel =
                levels.find((level) => Number(level.level_order) > Number(profile.level_order || 0)) ||
                null;

            return res.json({
                success: true,
                profile,
                history,
                requests,
                nextLevel
            });
        } catch (error) {
            console.error("Student academic progression error:", error);
            return res.status(500).json({
                success: false,
                message: "Unable to load academic progression"
            });
        }
    }
);

/* STUDENT: REQUEST CHANGE */

router.post(
    "/student/requests",
    authenticateUser,
    authorizeRoles("student"),
    async (req, res) => {
        const requestedCourseId = idOrNull(req.body.courseId);
        const requestedCourseLevelId = idOrNull(req.body.courseLevelId);
        const reason = clean(req.body.reason);

        if (!requestedCourseId) {
            return res.status(400).json({
                success: false,
                message: "Select the Course / Program you are moving to"
            });
        }

        if (reason.length > 700) {
            return res.status(400).json({
                success: false,
                message: "Reason is too long"
            });
        }

        try {
            const profile = await currentProfile(db, req.user.userId);

            if (!profile || !profile.course_id) {
                return res.status(409).json({
                    success: false,
                    code: "STUDENT_PROFILE_REQUIRED",
                    message: "Configure your Course / Level first"
                });
            }

            const validation = await validateDestination(
                db,
                requestedCourseId,
                requestedCourseLevelId
            );

            if (!validation.valid) {
                return res.status(400).json({
                    success: false,
                    message: validation.message
                });
            }

            if (
                Number(profile.course_id) === Number(requestedCourseId) &&
                Number(profile.course_level_id || 0) === Number(requestedCourseLevelId || 0)
            ) {
                return res.status(409).json({
                    success: false,
                    message: "You are already in the selected Course / Level"
                });
            }

            const [pending] = await db.query(
                `
                SELECT id
                FROM student_academic_change_requests
                WHERE student_user_id = ? AND status = 'pending'
                LIMIT 1
                `,
                [req.user.userId]
            );

            if (pending.length) {
                return res.status(409).json({
                    success: false,
                    message: "You already have a pending academic-change request"
                });
            }

            const [result] = await db.query(
                `
                INSERT INTO student_academic_change_requests
                (
                    student_user_id,
                    from_course_id,
                    from_course_level_id,
                    requested_course_id,
                    requested_course_level_id,
                    reason
                )
                VALUES (?, ?, ?, ?, ?, ?)
                `,
                [
                    req.user.userId,
                    profile.course_id,
                    profile.course_level_id,
                    requestedCourseId,
                    requestedCourseLevelId,
                    reason || null
                ]
            );

            return res.status(201).json({
                success: true,
                message: "Academic progression request sent to Admin",
                requestId: result.insertId
            });
        } catch (error) {
            console.error("Create academic request error:", error);
            return res.status(500).json({
                success: false,
                message: "Unable to send academic progression request"
            });
        }
    }
);

router.patch(
    "/student/requests/:id/cancel",
    authenticateUser,
    authorizeRoles("student"),
    async (req, res) => {
        const requestId = Number(req.params.id);

        if (!Number.isInteger(requestId) || requestId <= 0) {
            return res.status(400).json({ success: false, message: "Invalid request" });
        }

        try {
            const [result] = await db.query(
                `
                UPDATE student_academic_change_requests
                SET status = 'cancelled'
                WHERE id = ? AND student_user_id = ? AND status = 'pending'
                `,
                [requestId, req.user.userId]
            );

            if (!result.affectedRows) {
                return res.status(404).json({
                    success: false,
                    message: "Pending request not found"
                });
            }

            return res.json({
                success: true,
                message: "Academic progression request cancelled"
            });
        } catch (error) {
            console.error("Cancel academic request error:", error);
            return res.status(500).json({
                success: false,
                message: "Unable to cancel request"
            });
        }
    }
);

/* ADMIN: DATA */

router.get(
    "/admin",
    authenticateUser,
    authorizeRoles("admin"),
    async (req, res) => {
        try {
            const [students] = await db.query(
                `
                SELECT
                    u.id,
                    u.full_name,
                    u.username,
                    u.email,
                    u.status,
                    sp.course_id,
                    sp.course_level_id,
                    c.course_code,
                    c.course_name,
                    cl.level_name,
                    cl.level_order,
                    d.department_name,
                    ed.domain_name
                FROM users u
                INNER JOIN roles r ON r.id = u.role_id
                LEFT JOIN student_profiles sp ON sp.user_id = u.id
                LEFT JOIN courses c ON c.id = sp.course_id
                LEFT JOIN course_levels cl ON cl.id = sp.course_level_id
                LEFT JOIN departments d ON d.id = c.department_id
                LEFT JOIN education_domains ed ON ed.id = c.domain_id
                WHERE r.role_name = 'student'
                ORDER BY u.full_name, u.id
                `
            );

            const [requests] = await db.query(
                `
                SELECT
                    req.id,
                    req.student_user_id,
                    req.reason,
                    req.status,
                    req.created_at,
                    req.reviewed_at,
                    req.review_note,
                    student.full_name AS student_name,
                    student.username,
                    fc.course_name AS from_course_name,
                    fl.level_name AS from_level_name,
                    tc.course_name AS requested_course_name,
                    tl.level_name AS requested_level_name,
                    reviewer.full_name AS reviewer_name
                FROM student_academic_change_requests req
                INNER JOIN users student ON student.id = req.student_user_id
                LEFT JOIN courses fc ON fc.id = req.from_course_id
                LEFT JOIN course_levels fl ON fl.id = req.from_course_level_id
                INNER JOIN courses tc ON tc.id = req.requested_course_id
                LEFT JOIN course_levels tl ON tl.id = req.requested_course_level_id
                LEFT JOIN users reviewer ON reviewer.id = req.reviewed_by
                ORDER BY
                    CASE WHEN req.status = 'pending' THEN 0 ELSE 1 END,
                    req.created_at DESC
                `
            );

            const [history] = await db.query(
                `
                SELECT
                    sah.id,
                    sah.change_type,
                    sah.note,
                    sah.created_at,
                    student.full_name AS student_name,
                    fc.course_name AS from_course_name,
                    fl.level_name AS from_level_name,
                    tc.course_name AS to_course_name,
                    tl.level_name AS to_level_name,
                    changer.full_name AS changed_by_name
                FROM student_academic_history sah
                INNER JOIN users student ON student.id = sah.student_user_id
                LEFT JOIN courses fc ON fc.id = sah.from_course_id
                LEFT JOIN course_levels fl ON fl.id = sah.from_course_level_id
                INNER JOIN courses tc ON tc.id = sah.to_course_id
                LEFT JOIN course_levels tl ON tl.id = sah.to_course_level_id
                LEFT JOIN users changer ON changer.id = sah.changed_by
                ORDER BY sah.created_at DESC, sah.id DESC
                LIMIT 50
                `
            );

            return res.json({ success: true, students, requests, history });
        } catch (error) {
            console.error("Admin academic progression error:", error);
            return res.status(500).json({
                success: false,
                message: "Unable to load Student advancement data"
            });
        }
    }
);

/* ADMIN: DIRECT CHANGE */

router.post(
    "/admin/change",
    authenticateUser,
    authorizeRoles("admin"),
    async (req, res) => {
        const studentUserId = idOrNull(req.body.studentUserId);
        const toCourseId = idOrNull(req.body.courseId);
        const toCourseLevelId = idOrNull(req.body.courseLevelId);
        const note = clean(req.body.note);

        if (!studentUserId || !toCourseId) {
            return res.status(400).json({
                success: false,
                message: "Student and destination Course are required"
            });
        }

        let connection;

        try {
            connection = await db.getConnection();
            await connection.beginTransaction();

            const [student] = await connection.query(
                `
                SELECT u.id
                FROM users u
                INNER JOIN roles r ON r.id = u.role_id
                WHERE u.id = ? AND r.role_name = 'student'
                LIMIT 1
                `,
                [studentUserId]
            );

            if (!student.length) {
                const error = new Error("Student account not found");
                error.statusCode = 404;
                throw error;
            }

            const changed = await applyAcademicChange(connection, {
                studentUserId,
                toCourseId,
                toCourseLevelId,
                changedBy: req.user.userId,
                note: note || "Academic profile changed by Admin"
            });

            await connection.query(
                `
                UPDATE student_academic_change_requests
                SET
                    status = 'rejected',
                    reviewed_by = ?,
                    reviewed_at = NOW(),
                    review_note = 'Academic profile was changed directly by Admin.'
                WHERE student_user_id = ? AND status = 'pending'
                `,
                [req.user.userId, studentUserId]
            );

            await connection.commit();

            return res.json({
                success: true,
                message:
                    changed.changeType === "promotion"
                        ? "Student promoted successfully"
                        : "Student academic profile updated successfully"
            });
        } catch (error) {
            if (connection) {
                try { await connection.rollback(); } catch (_) {}
            }

            console.error("Admin academic change error:", error);

            return res.status(error.statusCode || 500).json({
                success: false,
                message: error.message || "Unable to update Student academic profile"
            });
        } finally {
            if (connection) connection.release();
        }
    }
);

/* ADMIN: BULK PROMOTION */

router.post(
    "/admin/bulk-promote",
    authenticateUser,
    authorizeRoles("admin"),
    async (req, res) => {
        const fromCourseId = idOrNull(req.body.fromCourseId);
        const fromLevelId = idOrNull(req.body.fromLevelId);
        const toCourseId = idOrNull(req.body.toCourseId);
        const toLevelId = idOrNull(req.body.toLevelId);
        const note = clean(req.body.note);

        if (!fromCourseId || !toCourseId) {
            return res.status(400).json({
                success: false,
                message: "Source and destination Course are required"
            });
        }

        let connection;

        try {
            connection = await db.getConnection();
            await connection.beginTransaction();

            const destination = await validateDestination(connection, toCourseId, toLevelId);

            if (!destination.valid) {
                const error = new Error(destination.message);
                error.statusCode = 400;
                throw error;
            }

            const values = [fromCourseId];
            let levelSql = "AND sp.course_level_id IS NULL";

            if (fromLevelId) {
                levelSql = "AND sp.course_level_id = ?";
                values.push(fromLevelId);
            }

            const [students] = await connection.query(
                `
                SELECT sp.user_id
                FROM student_profiles sp
                INNER JOIN users u ON u.id = sp.user_id
                INNER JOIN roles r ON r.id = u.role_id
                WHERE
                    sp.course_id = ?
                    ${levelSql}
                    AND r.role_name = 'student'
                    AND u.status = 'active'
                FOR UPDATE
                `,
                values
            );

            let promoted = 0;

            for (const student of students) {
                try {
                    await applyAcademicChange(connection, {
                        studentUserId: student.user_id,
                        toCourseId,
                        toCourseLevelId: toLevelId,
                        changedBy: req.user.userId,
                        note: note || "Bulk academic promotion by Admin",
                        forcedType:
                            Number(fromCourseId) === Number(toCourseId)
                                ? "promotion"
                                : "course_change"
                    });

                    await connection.query(
                        `
                        UPDATE student_academic_change_requests
                        SET
                            status = 'rejected',
                            reviewed_by = ?,
                            reviewed_at = NOW(),
                            review_note = 'Student was moved through Admin bulk promotion.'
                        WHERE student_user_id = ? AND status = 'pending'
                        `,
                        [req.user.userId, student.user_id]
                    );

                    promoted += 1;
                } catch (studentError) {
                    if (studentError.statusCode !== 409) throw studentError;
                }
            }

            await connection.commit();

            return res.json({
                success: true,
                promoted,
                message: `${promoted} Student${promoted === 1 ? "" : "s"} promoted successfully`
            });
        } catch (error) {
            if (connection) {
                try { await connection.rollback(); } catch (_) {}
            }

            console.error("Bulk promotion error:", error);

            return res.status(error.statusCode || 500).json({
                success: false,
                message: error.message || "Unable to complete bulk promotion"
            });
        } finally {
            if (connection) connection.release();
        }
    }
);

/* ADMIN: REVIEW REQUEST */

router.patch(
    "/admin/requests/:id",
    authenticateUser,
    authorizeRoles("admin"),
    async (req, res) => {
        const requestId = Number(req.params.id);
        const status = clean(req.body.status).toLowerCase();
        const reviewNote = clean(req.body.reviewNote);

        if (!Number.isInteger(requestId) || requestId <= 0) {
            return res.status(400).json({ success: false, message: "Invalid request" });
        }

        if (!["approved", "rejected"].includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Review status must be approved or rejected"
            });
        }

        let connection;

        try {
            connection = await db.getConnection();
            await connection.beginTransaction();

            const [rows] = await connection.query(
                `
                SELECT *
                FROM student_academic_change_requests
                WHERE id = ? AND status = 'pending'
                LIMIT 1
                FOR UPDATE
                `,
                [requestId]
            );

            if (!rows.length) {
                const error = new Error("Pending request not found");
                error.statusCode = 404;
                throw error;
            }

            const request = rows[0];

            if (status === "approved") {
                await applyAcademicChange(connection, {
                    studentUserId: request.student_user_id,
                    toCourseId: request.requested_course_id,
                    toCourseLevelId: request.requested_course_level_id,
                    changedBy: req.user.userId,
                    requestedBy: request.student_user_id,
                    note:
                        reviewNote ||
                        request.reason ||
                        "Academic progression request approved"
                });
            }

            await connection.query(
                `
                UPDATE student_academic_change_requests
                SET
                    status = ?,
                    reviewed_by = ?,
                    reviewed_at = NOW(),
                    review_note = ?
                WHERE id = ?
                `,
                [status, req.user.userId, reviewNote || null, requestId]
            );

            await connection.commit();

            return res.json({
                success: true,
                message:
                    status === "approved"
                        ? "Student progression approved and academic profile updated"
                        : "Student progression request rejected"
            });
        } catch (error) {
            if (connection) {
                try { await connection.rollback(); } catch (_) {}
            }

            console.error("Review progression request error:", error);

            return res.status(error.statusCode || 500).json({
                success: false,
                message: error.message || "Unable to review academic request"
            });
        } finally {
            if (connection) connection.release();
        }
    }
);

module.exports = router;
