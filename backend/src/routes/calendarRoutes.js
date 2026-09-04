const express = require("express");

const db = require("../config/db");
const authenticateUser = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

const router = express.Router();

function placeholders(ids) {
    return ids.map(() => "?").join(",");
}

async function studentProfile(userId) {
    const [rows] = await db.query(
        `SELECT course_id, course_level_id
         FROM student_profiles
         WHERE user_id = ?
         LIMIT 1`,
        [userId]
    );
    return rows[0] || null;
}

async function studentSubjects(profile) {
    if (!profile || !profile.course_id) return [];

    const values = [profile.course_id];
    let levelSql = "AND s.course_level_id IS NULL";

    if (profile.course_level_id) {
        levelSql =
            "AND (s.course_level_id IS NULL OR s.course_level_id = ?)";
        values.push(profile.course_level_id);
    }

    const [rows] = await db.query(
        `
        SELECT s.id
        FROM subjects s
        WHERE
            s.course_id = ?
            ${levelSql}
            AND s.is_active = 1
        `,
        values
    );

    return rows.map((row) => Number(row.id));
}

async function facultySubjects(userId) {
    const [rows] = await db.query(
        `
        SELECT fsa.subject_id
        FROM faculty_subject_assignments fsa
        INNER JOIN subjects s ON s.id = fsa.subject_id
        WHERE
            fsa.faculty_user_id = ?
            AND fsa.is_active = 1
            AND s.is_active = 1
        `,
        [userId]
    );

    return rows.map((row) => Number(row.subject_id));
}

router.get(
    "/",
    authenticateUser,
    authorizeRoles("student", "faculty", "admin"),
    async (req, res) => {
        const role = String(req.user.role || "").toLowerCase();
        const events = [];

        let profile = null;
        let subjectIds = [];

        try {
            if (role === "student") {
                profile = await studentProfile(req.user.userId);
                subjectIds = await studentSubjects(profile);

                if (subjectIds.length) {
                    const marks = placeholders(subjectIds);

                    const [assignments] = await db.query(
                        `
                        SELECT
                            a.id, a.title, a.due_at,
                            s.subject_code, s.subject_name,
                            sub.status AS submission_status
                        FROM assignments a
                        INNER JOIN subjects s ON s.id = a.subject_id
                        LEFT JOIN assignment_submissions sub
                            ON sub.assignment_id = a.id
                            AND sub.student_user_id = ?
                        WHERE
                            a.subject_id IN (${marks})
                            AND a.status = 'published'
                            AND a.due_at IS NOT NULL
                            AND a.due_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
                            AND a.due_at <= DATE_ADD(NOW(), INTERVAL 120 DAY)
                        ORDER BY a.due_at
                        `,
                        [req.user.userId, ...subjectIds]
                    );

                    assignments.forEach((row) =>
                        events.push({
                            type: "assignment",
                            title: row.title,
                            detail: `${row.subject_code} • ${row.subject_name}`,
                            date: row.due_at,
                            status: row.submission_status || "not_submitted",
                            url: "/student/assignments.html"
                        })
                    );

                    const [quizzes] = await db.query(
                        `
                        SELECT
                            q.id, q.title, q.created_at,
                            s.subject_code, s.subject_name
                        FROM quizzes q
                        INNER JOIN subjects s ON s.id = q.subject_id
                        WHERE
                            q.subject_id IN (${marks})
                            AND q.verification_status = 'approved'
                            AND q.is_published = 1
                            AND q.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                        ORDER BY q.created_at DESC
                        LIMIT 30
                        `,
                        subjectIds
                    );

                    quizzes.forEach((row) =>
                        events.push({
                            type: "quiz",
                            title: row.title,
                            detail: `${row.subject_code} • Available Quiz`,
                            date: row.created_at,
                            status: "available",
                            url: "/student/quizzes.html"
                        })
                    );
                }

                const [history] = await db.query(
                    `
                    SELECT
                        sah.id, sah.change_type, sah.created_at,
                        c.course_name, cl.level_name
                    FROM student_academic_history sah
                    INNER JOIN courses c ON c.id = sah.to_course_id
                    LEFT JOIN course_levels cl ON cl.id = sah.to_course_level_id
                    WHERE
                        sah.student_user_id = ?
                        AND sah.change_type <> 'initial'
                    ORDER BY sah.created_at DESC
                    LIMIT 10
                    `,
                    [req.user.userId]
                );

                history.forEach((row) =>
                    events.push({
                        type: "academic",
                        title:
                            row.change_type === "promotion"
                                ? "Academic Promotion"
                                : "Academic Profile Change",
                        detail:
                            `${row.course_name}${row.level_name ? " • " + row.level_name : ""}`,
                        date: row.created_at,
                        status: row.change_type,
                        url: "/student/academic-progress.html"
                    })
                );
            } else if (role === "faculty") {
                subjectIds = await facultySubjects(req.user.userId);

                const [assignments] = await db.query(
                    `
                    SELECT
                        a.id, a.title, a.due_at,
                        s.subject_code, s.subject_name
                    FROM assignments a
                    INNER JOIN subjects s ON s.id = a.subject_id
                    WHERE
                        a.created_by = ?
                        AND a.status = 'published'
                        AND a.due_at IS NOT NULL
                        AND a.due_at >= DATE_SUB(NOW(), INTERVAL 14 DAY)
                        AND a.due_at <= DATE_ADD(NOW(), INTERVAL 120 DAY)
                    ORDER BY a.due_at
                    `,
                    [req.user.userId]
                );

                assignments.forEach((row) =>
                    events.push({
                        type: "assignment",
                        title: row.title,
                        detail: `${row.subject_code} • ${row.subject_name}`,
                        date: row.due_at,
                        status: "due",
                        url: "/faculty/assignments.html"
                    })
                );

                const [quizzes] = await db.query(
                    `
                    SELECT q.id, q.title, q.created_at, s.subject_code
                    FROM quizzes q
                    INNER JOIN subjects s ON s.id = q.subject_id
                    WHERE q.created_by = ? AND q.is_published = 1
                    ORDER BY q.created_at DESC
                    LIMIT 30
                    `,
                    [req.user.userId]
                );

                quizzes.forEach((row) =>
                    events.push({
                        type: "quiz",
                        title: row.title,
                        detail: `${row.subject_code} • Published`,
                        date: row.created_at,
                        status: "published",
                        url: "/faculty/quizzes.html"
                    })
                );
            } else {
                const [assignments] = await db.query(
                    `
                    SELECT
                        a.id, a.title, a.due_at,
                        s.subject_code,
                        creator.full_name AS creator_name
                    FROM assignments a
                    INNER JOIN subjects s ON s.id = a.subject_id
                    INNER JOIN users creator ON creator.id = a.created_by
                    WHERE
                        a.status = 'published'
                        AND a.due_at IS NOT NULL
                        AND a.due_at >= DATE_SUB(NOW(), INTERVAL 14 DAY)
                        AND a.due_at <= DATE_ADD(NOW(), INTERVAL 120 DAY)
                    ORDER BY a.due_at
                    LIMIT 80
                    `
                );

                assignments.forEach((row) =>
                    events.push({
                        type: "assignment",
                        title: row.title,
                        detail: `${row.subject_code} • ${row.creator_name}`,
                        date: row.due_at,
                        status: "published",
                        url: "/admin/assignments.html"
                    })
                );

                const [requests] = await db.query(
                    `
                    SELECT
                        req.id, req.created_at,
                        student.full_name AS student_name,
                        c.course_name, cl.level_name
                    FROM student_academic_change_requests req
                    INNER JOIN users student ON student.id = req.student_user_id
                    INNER JOIN courses c ON c.id = req.requested_course_id
                    LEFT JOIN course_levels cl ON cl.id = req.requested_course_level_id
                    WHERE req.status = 'pending'
                    ORDER BY req.created_at ASC
                    `
                );

                requests.forEach((row) =>
                    events.push({
                        type: "academic_request",
                        title: `${row.student_name} • Progression Request`,
                        detail: `${row.course_name}${row.level_name ? " • " + row.level_name : ""}`,
                        date: row.created_at,
                        status: "pending",
                        url: "/admin/student-advancement.html"
                    })
                );
            }

            const targetConditions = [
                "a.target_type = 'all'",
                "(a.target_type = 'role' AND a.target_role = ?)",
                "(a.target_type = 'user' AND a.target_user_id = ?)",
                "a.created_by = ?"
            ];

            const announcementValues = [
                role,
                req.user.userId,
                req.user.userId
            ];

            if (role === "student" && profile) {
                if (profile.course_id) {
                    targetConditions.push(
                        "(a.target_type = 'course' AND a.course_id = ?)"
                    );
                    announcementValues.push(profile.course_id);
                }

                if (profile.course_level_id) {
                    targetConditions.push(
                        "(a.target_type = 'level' AND a.course_level_id = ?)"
                    );
                    announcementValues.push(profile.course_level_id);
                }
            }

            if (subjectIds.length) {
                targetConditions.push(
                    `(a.target_type = 'subject' AND a.subject_id IN (${placeholders(subjectIds)}))`
                );
                announcementValues.push(...subjectIds);
            }

            if (role === "admin") {
                targetConditions.push("1 = 1");
            }

            const [announcements] = await db.query(
                `
                SELECT
                    a.id, a.title, a.priority,
                    a.starts_at, a.expires_at,
                    creator.full_name AS creator_name
                FROM announcements a
                INNER JOIN users creator ON creator.id = a.created_by
                WHERE
                    a.status = 'published'
                    AND (a.expires_at IS NULL OR a.expires_at >= NOW())
                    AND (${targetConditions.join(" OR ")})
                ORDER BY a.starts_at DESC
                LIMIT 30
                `,
                announcementValues
            );

            announcements.forEach((row) =>
                events.push({
                    type: "announcement",
                    title: row.title,
                    detail: `${row.creator_name} • ${row.priority}`,
                    date: row.starts_at,
                    endDate: row.expires_at,
                    status: row.priority,
                    url: `/${role}/notifications.html`
                })
            );

            events.sort(
                (a, b) =>
                    new Date(a.date).getTime() -
                    new Date(b.date).getTime()
            );

            return res.json({
                success: true,
                role,
                count: events.length,
                events
            });
        } catch (error) {
            console.error("Learning Calendar error:", error);
            return res.status(500).json({
                success: false,
                message: "Unable to load Learning Calendar"
            });
        }
    }
);

module.exports = router;
