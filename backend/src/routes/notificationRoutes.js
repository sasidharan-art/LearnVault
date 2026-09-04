const express = require("express");

const db = require("../config/db");
const authenticateUser = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

const router = express.Router();

function clean(value) {
    return String(value ?? "").trim();
}

function placeholders(ids) {
    return ids.map(() => "?").join(",");
}

function keyPart(value) {
    if (!value) return "0";
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
        return String(Math.floor(date.getTime() / 1000));
    }
    return String(value).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 48) || "0";
}

function eventKey(type, id, changedAt = null) {
    return [type, id, keyPart(changedAt)].join(":");
}

function add(output, item) {
    output.push({
        key: item.key,
        type: item.type,
        priority: item.priority || "normal",
        title: item.title,
        detail: item.detail || "",
        createdAt: item.createdAt,
        url: item.url,
        action: item.action || "Open"
    });
}

async function studentProfile(userId) {
    const [rows] = await db.query(
        `
        SELECT sp.user_id, sp.course_id, sp.course_level_id
        FROM student_profiles sp
        WHERE sp.user_id = ?
        LIMIT 1
        `,
        [userId]
    );
    return rows[0] || null;
}

async function studentSubjectIds(profile) {
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
        INNER JOIN courses c ON c.id = s.course_id
        WHERE
            s.course_id = ?
            ${levelSql}
            AND s.is_active = 1
            AND c.is_active = 1
        `,
        values
    );

    return rows.map((row) => Number(row.id));
}

async function facultySubjectIds(userId) {
    const [rows] = await db.query(
        `
        SELECT fsa.subject_id
        FROM faculty_subject_assignments fsa
        INNER JOIN subjects s ON s.id = fsa.subject_id
        INNER JOIN courses c ON c.id = s.course_id
        WHERE
            fsa.faculty_user_id = ?
            AND fsa.is_active = 1
            AND s.is_active = 1
            AND c.is_active = 1
        `,
        [userId]
    );

    return rows.map((row) => Number(row.subject_id));
}

async function announcementEvents(req, role, profile, subjectIds) {
    const targetConditions = [
        "a.target_type = 'all'",
        "(a.target_type = 'role' AND a.target_role = ?)",
        "(a.target_type = 'user' AND a.target_user_id = ?)",
        "a.created_by = ?"
    ];

    const values = [role, req.user.userId, req.user.userId];

    if (role === "student" && profile) {
        if (profile.course_id) {
            targetConditions.push(
                "(a.target_type = 'course' AND a.course_id = ?)"
            );
            values.push(profile.course_id);
        }

        if (profile.course_level_id) {
            targetConditions.push(
                "(a.target_type = 'level' AND a.course_level_id = ?)"
            );
            values.push(profile.course_level_id);
        }
    }

    if (subjectIds.length) {
        targetConditions.push(
            `(a.target_type = 'subject' AND a.subject_id IN (${placeholders(subjectIds)}))`
        );
        values.push(...subjectIds);
    }

    const [rows] = await db.query(
        `
        SELECT
            a.id,
            a.title,
            a.body,
            a.priority,
            a.updated_at,
            a.starts_at,
            creator.full_name AS creator_name
        FROM announcements a
        INNER JOIN users creator ON creator.id = a.created_by
        WHERE
            a.status = 'published'
            AND a.starts_at <= NOW()
            AND (a.expires_at IS NULL OR a.expires_at >= NOW())
            AND (${targetConditions.join(" OR ")})
        ORDER BY
            CASE a.priority
                WHEN 'urgent' THEN 0
                WHEN 'important' THEN 1
                ELSE 2
            END,
            a.starts_at DESC
        LIMIT 30
        `,
        values
    );

    return rows.map((row) => ({
        key: eventKey("announcement", row.id, row.updated_at),
        type: "announcement",
        priority: row.priority,
        title: row.title,
        detail: `${row.creator_name} • ${row.body}`,
        createdAt: row.starts_at,
        url: `/${role}/notifications.html`,
        action: "View"
    }));
}

async function studentEvents(req, profile, subjectIds) {
    const output = [];

    if (!profile || !profile.course_id || !subjectIds.length) return output;

    const marks = placeholders(subjectIds);

    const [assignments] = await db.query(
        `
        SELECT
            a.id,
            a.title,
            a.due_at,
            a.updated_at,
            s.subject_code,
            sub.id AS submission_id,
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
            AND a.due_at <= DATE_ADD(NOW(), INTERVAL 14 DAY)
            AND (sub.id IS NULL OR sub.status <> 'graded')
        ORDER BY a.due_at ASC
        LIMIT 15
        `,
        [req.user.userId, ...subjectIds]
    );

    for (const row of assignments) {
        const overdue = new Date(row.due_at).getTime() < Date.now();

        add(output, {
            key: eventKey("assignment_due", row.id, row.updated_at),
            type: "assignment",
            priority: overdue ? "urgent" : "important",
            title: overdue
                ? `Overdue Assignment: ${row.title}`
                : `Assignment due: ${row.title}`,
            detail: `${row.subject_code} • ${new Date(row.due_at).toLocaleDateString()}`,
            createdAt: row.due_at,
            url: "/student/assignments.html",
            action: row.submission_id ? "Review Submission" : "Open Assignment"
        });
    }

    const [grades] = await db.query(
        `
        SELECT
            sub.id,
            sub.marks_awarded,
            sub.graded_at,
            a.title,
            a.total_marks,
            s.subject_code
        FROM assignment_submissions sub
        INNER JOIN assignments a ON a.id = sub.assignment_id
        INNER JOIN subjects s ON s.id = a.subject_id
        WHERE
            sub.student_user_id = ?
            AND sub.status = 'graded'
            AND sub.graded_at >= DATE_SUB(NOW(), INTERVAL 45 DAY)
        ORDER BY sub.graded_at DESC
        LIMIT 15
        `,
        [req.user.userId]
    );

    for (const row of grades) {
        add(output, {
            key: eventKey("assignment_grade", row.id, row.graded_at),
            type: "grade",
            priority: "normal",
            title: `Assignment graded: ${row.title}`,
            detail: `${row.subject_code} • ${Number(row.marks_awarded || 0)} / ${Number(row.total_marks || 0)}`,
            createdAt: row.graded_at,
            url: "/student/assignments.html",
            action: "View Feedback"
        });
    }

    const [resources] = await db.query(
        `
        SELECT
            r.id,
            r.title,
            r.updated_at,
            r.created_at,
            s.subject_code,
            rt.type_name
        FROM resources r
        INNER JOIN subjects s ON s.id = r.subject_id
        LEFT JOIN resource_types rt ON rt.id = r.resource_type_id
        WHERE
            r.subject_id IN (${marks})
            AND r.verification_status = 'approved'
            AND r.created_at >= DATE_SUB(NOW(), INTERVAL 21 DAY)
        ORDER BY r.created_at DESC
        LIMIT 15
        `,
        subjectIds
    );

    for (const row of resources) {
        add(output, {
            key: eventKey("resource", row.id, row.updated_at || row.created_at),
            type: "resource",
            priority: "normal",
            title: `New Resource: ${row.title}`,
            detail: `${row.subject_code} • ${row.type_name || "Learning Resource"}`,
            createdAt: row.created_at,
            url: "/student/resources.html",
            action: "Open Resource"
        });
    }

    const [quizzes] = await db.query(
        `
        SELECT
            q.id,
            q.title,
            q.updated_at,
            q.created_at,
            s.subject_code
        FROM quizzes q
        INNER JOIN subjects s ON s.id = q.subject_id
        WHERE
            q.subject_id IN (${marks})
            AND q.verification_status = 'approved'
            AND q.is_published = 1
            AND q.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        ORDER BY q.created_at DESC
        LIMIT 15
        `,
        subjectIds
    );

    for (const row of quizzes) {
        add(output, {
            key: eventKey("quiz", row.id, row.updated_at || row.created_at),
            type: "quiz",
            priority: "important",
            title: `Quiz available: ${row.title}`,
            detail: row.subject_code,
            createdAt: row.created_at,
            url: "/student/quizzes.html",
            action: "Open Quiz"
        });
    }

    const [skills] = await db.query(
        `
        SELECT
            sk.id,
            sk.skill_name,
            sk.updated_at,
            sk.created_at,
            s.subject_code,
            COALESCE(ssp.progress_percent, 0) AS progress_percent
        FROM skills sk
        INNER JOIN subjects s ON s.id = sk.subject_id
        LEFT JOIN student_skill_progress ssp
            ON ssp.skill_id = sk.id
            AND ssp.student_user_id = ?
        WHERE
            sk.subject_id IN (${marks})
            AND sk.is_active = 1
            AND sk.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        ORDER BY sk.created_at DESC
        LIMIT 12
        `,
        [req.user.userId, ...subjectIds]
    );

    for (const row of skills) {
        add(output, {
            key: eventKey("skill", row.id, row.updated_at || row.created_at),
            type: "skill",
            priority: "normal",
            title: `Skill available: ${row.skill_name}`,
            detail: `${row.subject_code} • ${Math.round(Number(row.progress_percent || 0))}% progress`,
            createdAt: row.created_at,
            url: "/student/skills.html",
            action: "Build Skill"
        });
    }

    const [peerPosts] = await db.query(
        `
        SELECT
            pp.id,
            pp.title,
            pp.updated_at,
            pp.created_at,
            pg.group_name,
            author.full_name AS author_name
        FROM peer_posts pp
        INNER JOIN peer_groups pg ON pg.id = pp.group_id
        INNER JOIN peer_group_members pgm
            ON pgm.group_id = pg.id
            AND pgm.user_id = ?
        INNER JOIN users author ON author.id = pp.author_user_id
        WHERE
            pp.status = 'visible'
            AND pg.status <> 'archived'
            AND pp.created_at >= DATE_SUB(NOW(), INTERVAL 21 DAY)
        ORDER BY pp.created_at DESC
        LIMIT 15
        `,
        [req.user.userId]
    );

    for (const row of peerPosts) {
        add(output, {
            key: eventKey("peer_post", row.id, row.updated_at || row.created_at),
            type: "peer",
            priority: "normal",
            title: row.title,
            detail: `${row.group_name} • ${row.author_name}`,
            createdAt: row.created_at,
            url: "/student/peer-groups.html",
            action: "Open Discussion"
        });
    }

    const [academicChanges] = await db.query(
        `
        SELECT
            sah.id,
            sah.change_type,
            sah.note,
            sah.created_at,
            c.course_name,
            cl.level_name
        FROM student_academic_history sah
        INNER JOIN courses c ON c.id = sah.to_course_id
        LEFT JOIN course_levels cl ON cl.id = sah.to_course_level_id
        WHERE
            sah.student_user_id = ?
            AND sah.created_at >= DATE_SUB(NOW(), INTERVAL 180 DAY)
        ORDER BY sah.created_at DESC
        LIMIT 10
        `,
        [req.user.userId]
    );

    for (const row of academicChanges) {
        if (row.change_type === "initial") continue;

        add(output, {
            key: eventKey("academic_change", row.id, row.created_at),
            type: "academic",
            priority: "important",
            title:
                row.change_type === "promotion"
                    ? `Promoted to ${row.level_name || row.course_name}`
                    : "Academic profile updated",
            detail:
                `${row.course_name}${row.level_name ? " • " + row.level_name : ""}${row.note ? " • " + row.note : ""}`,
            createdAt: row.created_at,
            url: "/student/academic-progress.html",
            action: "View Progression"
        });
    }

    return output;
}

async function facultyEvents(req, subjectIds) {
    const output = [];

    const [submissions] = await db.query(
        `
        SELECT
            sub.id,
            sub.status,
            sub.submitted_at,
            sub.updated_at,
            a.title,
            s.subject_code,
            student.full_name AS student_name
        FROM assignment_submissions sub
        INNER JOIN assignments a ON a.id = sub.assignment_id
        INNER JOIN subjects s ON s.id = a.subject_id
        INNER JOIN users student ON student.id = sub.student_user_id
        WHERE
            a.created_by = ?
            AND sub.submitted_at >= DATE_SUB(NOW(), INTERVAL 45 DAY)
        ORDER BY sub.submitted_at DESC
        LIMIT 25
        `,
        [req.user.userId]
    );

    for (const row of submissions) {
        add(output, {
            key: eventKey("faculty_submission", row.id, row.updated_at || row.submitted_at),
            type: "submission",
            priority: row.status === "submitted" ? "important" : "normal",
            title: `${row.student_name} submitted ${row.title}`,
            detail: `${row.subject_code} • ${row.status}`,
            createdAt: row.submitted_at,
            url: "/faculty/assignments.html",
            action: row.status === "submitted" ? "Grade" : "Review"
        });
    }

    const [attempts] = await db.query(
        `
        SELECT
            qa.id,
            qa.percentage,
            qa.submitted_at,
            q.title,
            s.subject_code,
            student.full_name AS student_name
        FROM quiz_attempts qa
        INNER JOIN quizzes q ON q.id = qa.quiz_id
        INNER JOIN subjects s ON s.id = q.subject_id
        INNER JOIN users student ON student.id = qa.student_user_id
        WHERE
            q.created_by = ?
            AND qa.status = 'submitted'
            AND qa.submitted_at >= DATE_SUB(NOW(), INTERVAL 45 DAY)
        ORDER BY qa.submitted_at DESC
        LIMIT 25
        `,
        [req.user.userId]
    );

    for (const row of attempts) {
        add(output, {
            key: eventKey("faculty_quiz_attempt", row.id, row.submitted_at),
            type: "quiz_attempt",
            priority: Number(row.percentage || 0) < 50 ? "important" : "normal",
            title: `${row.student_name} completed ${row.title}`,
            detail: `${row.subject_code} • ${Math.round(Number(row.percentage || 0))}%`,
            createdAt: row.submitted_at,
            url: "/faculty/progress.html",
            action: "View Analytics"
        });
    }

    if (subjectIds.length) {
        const marks = placeholders(subjectIds);

        const [assignments] = await db.query(
            `
            SELECT
                fsa.id,
                fsa.updated_at,
                s.subject_code,
                s.subject_name,
                c.course_name
            FROM faculty_subject_assignments fsa
            INNER JOIN subjects s ON s.id = fsa.subject_id
            INNER JOIN courses c ON c.id = s.course_id
            WHERE
                fsa.faculty_user_id = ?
                AND fsa.is_active = 1
                AND fsa.subject_id IN (${marks})
            ORDER BY fsa.updated_at DESC, fsa.id DESC
            `,
            [req.user.userId, ...subjectIds]
        );

        for (const row of assignments) {
            add(output, {
                key: eventKey("faculty_subject", row.id, row.updated_at),
                type: "academic",
                priority: "important",
                title: `Teaching access: ${row.subject_name}`,
                detail: `${row.course_name} • ${row.subject_code}`,
                createdAt: row.updated_at,
                url: "/faculty/profile.html",
                action: "View Subject"
            });
        }

        const [peerPosts] = await db.query(
            `
            SELECT
                pp.id,
                pp.title,
                pp.updated_at,
                pp.created_at,
                pg.group_name,
                author.full_name AS author_name
            FROM peer_posts pp
            INNER JOIN peer_groups pg ON pg.id = pp.group_id
            INNER JOIN users author ON author.id = pp.author_user_id
            WHERE
                pg.created_by = ?
                AND pp.status = 'visible'
                AND pp.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            ORDER BY pp.created_at DESC
            LIMIT 20
            `,
            [req.user.userId]
        );

        for (const row of peerPosts) {
            add(output, {
                key: eventKey("faculty_peer_post", row.id, row.updated_at || row.created_at),
                type: "peer",
                priority: "normal",
                title: row.title,
                detail: `${row.group_name} • ${row.author_name}`,
                createdAt: row.created_at,
                url: "/faculty/peer-groups.html",
                action: "Open Discussion"
            });
        }
    }

    return output;
}

async function adminEvents() {
    const output = [];

    const [requests] = await db.query(
        `
        SELECT
            req.id,
            req.created_at,
            student.full_name AS student_name,
            c.course_name,
            cl.level_name
        FROM student_academic_change_requests req
        INNER JOIN users student ON student.id = req.student_user_id
        INNER JOIN courses c ON c.id = req.requested_course_id
        LEFT JOIN course_levels cl ON cl.id = req.requested_course_level_id
        WHERE req.status = 'pending'
        ORDER BY req.created_at ASC
        LIMIT 25
        `
    );

    for (const row of requests) {
        add(output, {
            key: eventKey("academic_request", row.id, row.created_at),
            type: "academic_request",
            priority: "urgent",
            title: `${row.student_name} requested academic progression`,
            detail: `${row.course_name}${row.level_name ? " • " + row.level_name : ""}`,
            createdAt: row.created_at,
            url: "/admin/student-advancement.html",
            action: "Review Request"
        });
    }

    const [users] = await db.query(
        `
        SELECT
            u.id,
            u.full_name,
            u.status,
            u.created_at,
            u.updated_at,
            r.role_name
        FROM users u
        INNER JOIN roles r ON r.id = u.role_id
        WHERE u.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        ORDER BY u.created_at DESC
        LIMIT 25
        `
    );

    for (const row of users) {
        add(output, {
            key: eventKey("admin_user", row.id, row.updated_at || row.created_at),
            type: "user",
            priority: row.status === "active" ? "normal" : "important",
            title: `${row.role_name}: ${row.full_name}`,
            detail: `Account status • ${row.status}`,
            createdAt: row.created_at,
            url: "/admin/users.html",
            action: "Manage User"
        });
    }

    const [resources] = await db.query(
        `
        SELECT
            r.id,
            r.title,
            r.verification_status,
            r.created_at,
            r.updated_at,
            uploader.full_name AS uploader_name
        FROM resources r
        INNER JOIN users uploader ON uploader.id = r.uploaded_by
        WHERE r.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        ORDER BY r.created_at DESC
        LIMIT 20
        `
    );

    for (const row of resources) {
        add(output, {
            key: eventKey("admin_resource", row.id, row.updated_at || row.created_at),
            type: "resource",
            priority: "normal",
            title: row.title,
            detail: `${row.uploader_name} • ${row.verification_status}`,
            createdAt: row.created_at,
            url: "/admin/resources.html",
            action: "Monitor"
        });
    }

    const [quizzes] = await db.query(
        `
        SELECT
            q.id,
            q.title,
            q.is_published,
            q.created_at,
            q.updated_at,
            creator.full_name AS creator_name
        FROM quizzes q
        INNER JOIN users creator ON creator.id = q.created_by
        WHERE q.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        ORDER BY q.created_at DESC
        LIMIT 20
        `
    );

    for (const row of quizzes) {
        add(output, {
            key: eventKey("admin_quiz", row.id, row.updated_at || row.created_at),
            type: "quiz",
            priority: "normal",
            title: row.title,
            detail: `${row.creator_name} • ${Number(row.is_published) === 1 ? "published" : "not published"}`,
            createdAt: row.created_at,
            url: "/admin/quizzes.html",
            action: "Monitor"
        });
    }

    const [assignments] = await db.query(
        `
        SELECT
            a.id,
            a.title,
            a.status,
            a.created_at,
            a.updated_at,
            creator.full_name AS creator_name,
            (
                SELECT COUNT(*)
                FROM assignment_submissions sub
                WHERE sub.assignment_id = a.id
                    AND sub.status = 'submitted'
            ) AS awaiting_grade
        FROM assignments a
        INNER JOIN users creator ON creator.id = a.created_by
        WHERE a.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        ORDER BY a.created_at DESC
        LIMIT 20
        `
    );

    for (const row of assignments) {
        add(output, {
            key: eventKey("admin_assignment", row.id, row.updated_at || row.created_at),
            type: "assignment",
            priority: Number(row.awaiting_grade || 0) > 0 ? "important" : "normal",
            title: row.title,
            detail: `${row.creator_name} • ${row.status} • ${Number(row.awaiting_grade || 0)} awaiting grading`,
            createdAt: row.created_at,
            url: "/admin/assignments.html",
            action: "Monitor"
        });
    }

    const [peerPosts] = await db.query(
        `
        SELECT
            pp.id,
            pp.title,
            pp.status,
            pp.created_at,
            pp.updated_at,
            pg.group_name,
            author.full_name AS author_name
        FROM peer_posts pp
        INNER JOIN peer_groups pg ON pg.id = pp.group_id
        INNER JOIN users author ON author.id = pp.author_user_id
        WHERE pp.created_at >= DATE_SUB(NOW(), INTERVAL 21 DAY)
        ORDER BY pp.created_at DESC
        LIMIT 20
        `
    );

    for (const row of peerPosts) {
        add(output, {
            key: eventKey("admin_peer_post", row.id, row.updated_at || row.created_at),
            type: "peer",
            priority: row.status === "hidden" ? "important" : "normal",
            title: row.title,
            detail: `${row.group_name} • ${row.author_name} • ${row.status}`,
            createdAt: row.created_at,
            url: "/admin/peer-groups.html",
            action: "Moderate"
        });
    }

    return output;
}

async function buildNotifications(req) {
    const role = String(req.user.role || "").toLowerCase();

    let profile = null;
    let subjectIds = [];

    if (role === "student") {
        profile = await studentProfile(req.user.userId);
        subjectIds = await studentSubjectIds(profile);
    } else if (role === "faculty") {
        subjectIds = await facultySubjectIds(req.user.userId);
    }

    const output = await announcementEvents(req, role, profile, subjectIds);

    if (role === "student") {
        output.push(...await studentEvents(req, profile, subjectIds));
    } else if (role === "faculty") {
        output.push(...await facultyEvents(req, subjectIds));
    } else {
        output.push(...await adminEvents());
    }

    const priority = { urgent: 3, important: 2, normal: 1 };

    output.sort((a, b) => {
        const p = (priority[b.priority] || 1) - (priority[a.priority] || 1);
        if (p !== 0) return p;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    const unique = [];
    const seen = new Set();

    for (const item of output) {
        if (!item.key || seen.has(item.key)) continue;
        seen.add(item.key);
        unique.push(item);
        if (unique.length >= 80) break;
    }

    const keys = unique.map((item) => item.key);
    const readKeys = new Set();

    if (keys.length) {
        const [reads] = await db.query(
            `
            SELECT notification_key
            FROM user_notification_reads
            WHERE user_id = ?
                AND notification_key IN (${placeholders(keys)})
            `,
            [req.user.userId, ...keys]
        );

        for (const row of reads) readKeys.add(row.notification_key);
    }

    return unique.map((item) => ({
        ...item,
        isRead: readKeys.has(item.key)
    }));
}

/* GET FEED */

router.get(
    "/",
    authenticateUser,
    authorizeRoles("student", "faculty", "admin"),
    async (req, res) => {
        try {
            const notifications = await buildNotifications(req);

            return res.json({
                success: true,
                count: notifications.length,
                unreadCount: notifications.filter((item) => !item.isRead).length,
                notifications
            });
        } catch (error) {
            console.error("Universal notifications error:", error);
            return res.status(500).json({
                success: false,
                message: "Unable to load notifications"
            });
        }
    }
);

router.get(
    "/unread-count",
    authenticateUser,
    authorizeRoles("student", "faculty", "admin"),
    async (req, res) => {
        try {
            const notifications = await buildNotifications(req);
            return res.json({
                success: true,
                unreadCount: notifications.filter((item) => !item.isRead).length
            });
        } catch (_) {
            return res.json({ success: true, unreadCount: 0 });
        }
    }
);

/* READ STATE */

router.post(
    "/read",
    authenticateUser,
    authorizeRoles("student", "faculty", "admin"),
    async (req, res) => {
        const keys =
            Array.isArray(req.body.keys)
                ? req.body.keys
                    .map(clean)
                    .filter((key) => key && key.length <= 190)
                    .slice(0, 100)
                : [];

        if (!keys.length) {
            return res.json({ success: true, message: "Nothing to mark as read" });
        }

        try {
            const rows = keys.map((key) => [req.user.userId, key]);

            await db.query(
                `
                INSERT INTO user_notification_reads (user_id, notification_key)
                VALUES ?
                ON DUPLICATE KEY UPDATE read_at = CURRENT_TIMESTAMP
                `,
                [rows]
            );

            return res.json({
                success: true,
                message: "Notifications marked as read"
            });
        } catch (error) {
            console.error("Mark notifications read error:", error);
            return res.status(500).json({
                success: false,
                message: "Unable to update notification state"
            });
        }
    }
);

router.post(
    "/read-all",
    authenticateUser,
    authorizeRoles("student", "faculty", "admin"),
    async (req, res) => {
        try {
            const notifications = await buildNotifications(req);
            const keys = notifications.map((item) => item.key).filter(Boolean);

            if (!keys.length) {
                return res.json({ success: true, message: "No notifications to mark" });
            }

            const rows = keys.map((key) => [req.user.userId, key]);

            await db.query(
                `
                INSERT INTO user_notification_reads (user_id, notification_key)
                VALUES ?
                ON DUPLICATE KEY UPDATE read_at = CURRENT_TIMESTAMP
                `,
                [rows]
            );

            return res.json({
                success: true,
                message: "All notifications marked as read"
            });
        } catch (error) {
            console.error("Read all notifications error:", error);
            return res.status(500).json({
                success: false,
                message: "Unable to mark all notifications"
            });
        }
    }
);

/* ANNOUNCEMENT OPTIONS */

router.get(
    "/announcement-options",
    authenticateUser,
    authorizeRoles("faculty", "admin"),
    async (req, res) => {
        try {
            if (req.user.role === "faculty") {
                const [subjects] = await db.query(
                    `
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
                    WHERE
                        fsa.faculty_user_id = ?
                        AND fsa.is_active = 1
                        AND s.is_active = 1
                        AND c.is_active = 1
                    ORDER BY c.course_name, s.subject_name
                    `,
                    [req.user.userId]
                );

                return res.json({ success: true, role: "faculty", subjects });
            }

            const [courses] = await db.query(
                `
                SELECT id, course_code, course_name
                FROM courses
                WHERE is_active = 1
                ORDER BY course_name
                `
            );

            const [levels] = await db.query(
                `
                SELECT id, course_id, level_name, level_order
                FROM course_levels
                WHERE is_active = 1
                ORDER BY course_id, level_order, level_name
                `
            );

            const [subjects] = await db.query(
                `
                SELECT
                    s.id,
                    s.course_id,
                    s.course_level_id,
                    s.subject_code,
                    s.subject_name,
                    c.course_name,
                    cl.level_name
                FROM subjects s
                INNER JOIN courses c ON c.id = s.course_id
                LEFT JOIN course_levels cl ON cl.id = s.course_level_id
                WHERE s.is_active = 1 AND c.is_active = 1
                ORDER BY c.course_name, s.subject_name
                `
            );

            return res.json({
                success: true,
                role: "admin",
                courses,
                levels,
                subjects
            });
        } catch (error) {
            console.error("Announcement options error:", error);
            return res.status(500).json({
                success: false,
                message: "Unable to load announcement options"
            });
        }
    }
);

/* CREATE ANNOUNCEMENT */

router.post(
    "/announcements",
    authenticateUser,
    authorizeRoles("faculty", "admin"),
    async (req, res) => {
        const title = clean(req.body.title);
        const body = clean(req.body.body);
        const priority = clean(req.body.priority).toLowerCase() || "normal";

        let targetType = clean(req.body.targetType).toLowerCase();
        let targetRole = clean(req.body.targetRole).toLowerCase() || null;
        let courseId = Number(req.body.courseId || 0) || null;
        let courseLevelId = Number(req.body.courseLevelId || 0) || null;
        let subjectId = Number(req.body.subjectId || 0) || null;
        const expiresAt = clean(req.body.expiresAt) || null;

        if (title.length < 2 || title.length > 180 || body.length < 2) {
            return res.status(400).json({
                success: false,
                message: "Announcement Title and Message are required"
            });
        }

        if (!["normal", "important", "urgent"].includes(priority)) {
            return res.status(400).json({
                success: false,
                message: "Invalid announcement priority"
            });
        }

        try {
            if (req.user.role === "faculty") {
                if (!subjectId) {
                    return res.status(400).json({
                        success: false,
                        message: "Faculty announcements must target an assigned Subject"
                    });
                }

                const [allowed] = await db.query(
                    `
                    SELECT fsa.id
                    FROM faculty_subject_assignments fsa
                    INNER JOIN subjects s ON s.id = fsa.subject_id
                    WHERE
                        fsa.faculty_user_id = ?
                        AND fsa.subject_id = ?
                        AND fsa.is_active = 1
                        AND s.is_active = 1
                    LIMIT 1
                    `,
                    [req.user.userId, subjectId]
                );

                if (!allowed.length) {
                    return res.status(403).json({
                        success: false,
                        message: "You can announce only to your assigned Subjects"
                    });
                }

                targetType = "subject";
                targetRole = "student";
                courseId = null;
                courseLevelId = null;
            } else {
                if (!["all", "role", "course", "level", "subject"].includes(targetType)) {
                    return res.status(400).json({
                        success: false,
                        message: "Select a valid announcement audience"
                    });
                }

                if (
                    targetType === "role" &&
                    !["student", "faculty", "admin"].includes(targetRole)
                ) {
                    return res.status(400).json({
                        success: false,
                        message: "Select Student, Faculty or Admin audience"
                    });
                }

                if (targetType === "course" && !courseId) {
                    return res.status(400).json({
                        success: false,
                        message: "Select a Course"
                    });
                }

                if (targetType === "level" && !courseLevelId) {
                    return res.status(400).json({
                        success: false,
                        message: "Select a Level / Year"
                    });
                }

                if (targetType === "subject" && !subjectId) {
                    return res.status(400).json({
                        success: false,
                        message: "Select a Subject"
                    });
                }
            }

            const [result] = await db.query(
                `
                INSERT INTO announcements
                (
                    created_by,
                    target_type,
                    target_role,
                    course_id,
                    course_level_id,
                    subject_id,
                    title,
                    body,
                    priority,
                    status,
                    starts_at,
                    expires_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', NOW(), ?)
                `,
                [
                    req.user.userId,
                    targetType,
                    targetRole,
                    courseId,
                    courseLevelId,
                    subjectId,
                    title,
                    body,
                    priority,
                    expiresAt
                ]
            );

            return res.status(201).json({
                success: true,
                message: "Announcement published",
                announcementId: result.insertId
            });
        } catch (error) {
            console.error("Create announcement error:", error);
            return res.status(500).json({
                success: false,
                message: "Unable to publish announcement"
            });
        }
    }
);

module.exports = router;
