const express = require("express");
const db = require("../config/db");
const authenticateUser = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

const router = express.Router();
const ROLES = ["student", "faculty", "admin"];
const ONLINE_MINUTES = 2;
const RECENT_MINUTES = 15;

const n = (v) => Number(v || 0);
const r2 = (v) => Math.round((n(v) + Number.EPSILON) * 100) / 100;
const pct = (a, b) => b ? r2((n(a) / n(b)) * 100) : 0;
const clean = (v, max = 255) => String(v ?? "").trim().slice(0, max);

async function getRoleName(userId) {
    const [rows] = await db.query(`
        SELECT r.role_name
        FROM users u
        INNER JOIN roles r ON r.id=u.role_id
        WHERE u.id=? LIMIT 1
    `, [userId]);
    return rows[0]?.role_name || null;
}

async function assignedSubjectIds(userId) {
    const [rows] = await db.query(`
        SELECT subject_id
        FROM faculty_subject_assignments
        WHERE faculty_user_id=? AND is_active=1
    `, [userId]);
    return rows.map(x => Number(x.subject_id));
}

async function studentCourse(userId) {
    const [rows] = await db.query(`
        SELECT sp.course_id, sp.course_level_id
        FROM student_profiles sp
        WHERE sp.user_id=? LIMIT 1
    `, [userId]);
    return rows[0] || null;
}

async function snapshot(req) {
    const role = req.user.role;
    const userId = Number(req.user.userId);

    const [[onlineRow]] = await db.query(`
        SELECT COUNT(*) AS online_now
        FROM user_presence
        WHERE last_seen >= NOW() - INTERVAL ${ONLINE_MINUTES} MINUTE
    `);

    const [onlineByRole] = await db.query(`
        SELECT role_name, COUNT(*) AS count
        FROM user_presence
        WHERE last_seen >= NOW() - INTERVAL ${ONLINE_MINUTES} MINUTE
        GROUP BY role_name
    `);

    const [pages] = await db.query(`
        SELECT current_page, COUNT(*) AS count
        FROM user_presence
        WHERE last_seen >= NOW() - INTERVAL ${ONLINE_MINUTES} MINUTE
          AND current_page IS NOT NULL AND current_page<>''
        GROUP BY current_page
        ORDER BY count DESC, current_page ASC
        LIMIT 8
    `);

    const [[eventRow]] = await db.query(`
        SELECT COUNT(*) AS events_last_15m
        FROM learning_events
        WHERE created_at >= NOW() - INTERVAL ${RECENT_MINUTES} MINUTE
    `);

    const [[quizToday]] = await db.query(`
        SELECT COUNT(*) AS count
        FROM quiz_attempts
        WHERE status='submitted' AND DATE(submitted_at)=CURDATE()
    `);

    const [[assignmentToday]] = await db.query(`
        SELECT COUNT(*) AS count
        FROM assignment_submissions
        WHERE DATE(submitted_at)=CURDATE()
    `);

    const [[newUsersToday]] = await db.query(`
        SELECT COUNT(*) AS count
        FROM users
        WHERE DATE(created_at)=CURDATE()
    `);

    const roleCounts = Object.fromEntries(ROLES.map(r => [r, 0]));
    onlineByRole.forEach(x => roleCounts[x.role_name] = n(x.count));

    const [recentEvents] = await db.query(`
        SELECT le.id, le.role_name, le.event_type, le.entity_type, le.entity_id,
               le.page_url, le.created_at, u.full_name
        FROM learning_events le
        LEFT JOIN users u ON u.id=le.user_id
        WHERE le.created_at >= NOW() - INTERVAL ${RECENT_MINUTES} MINUTE
        ORDER BY le.created_at DESC, le.id DESC
        LIMIT 24
    `);

    const base = {
        generatedAt: new Date().toISOString(),
        live: true,
        onlineNow: n(onlineRow.online_now),
        onlineByRole: roleCounts,
        eventsLast15m: n(eventRow.events_last_15m),
        quizzesToday: n(quizToday.count),
        submissionsToday: n(assignmentToday.count),
        newUsersToday: n(newUsersToday.count),
        activePages: pages.map(x => ({ page: x.current_page, count: n(x.count) })),
        recentEvents: recentEvents.map(x => ({
            id: x.id,
            role: x.role_name,
            type: x.event_type,
            entityType: x.entity_type,
            entityId: x.entity_id,
            page: x.page_url,
            userName: x.full_name || "LearnVault user",
            createdAt: x.created_at
        }))
    };

    if (role === "student") {
        const [presenceRows] = await db.query(`
            SELECT current_page, session_started_at, last_seen
            FROM user_presence WHERE user_id=? LIMIT 1
        `, [userId]);
        const presence = presenceRows[0] || null;

        const [[eventsToday]] = await db.query(`
            SELECT COUNT(*) AS count FROM learning_events
            WHERE user_id=? AND DATE(created_at)=CURDATE()
        `, [userId]);

        const [[myQuizzes]] = await db.query(`
            SELECT COUNT(*) AS count FROM quiz_attempts
            WHERE student_user_id=? AND status='submitted' AND DATE(submitted_at)=CURDATE()
        `, [userId]);

        const [[mySubmissions]] = await db.query(`
            SELECT COUNT(*) AS count FROM assignment_submissions
            WHERE student_user_id=? AND DATE(submitted_at)=CURDATE()
        `, [userId]);

        const [[dueSoon]] = await db.query(`
            SELECT COUNT(*) AS count
            FROM assignments a
            INNER JOIN subjects s ON s.id=a.subject_id
            INNER JOIN student_profiles sp ON sp.user_id=?
            WHERE a.status='published' AND a.due_at IS NOT NULL
              AND a.due_at BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 7 DAY)
              AND s.course_id=sp.course_id
              AND (sp.course_level_id IS NULL OR s.course_level_id IS NULL OR s.course_level_id=sp.course_level_id)
        `, [userId]);

        const [[myScore]] = await db.query(`
            SELECT AVG(percentage) AS average_score,
                   MAX(percentage) AS best_score,
                   COUNT(*) AS attempts
            FROM quiz_attempts
            WHERE student_user_id=? AND status='submitted'
        `, [userId]);

        let sessionMinutes = 0;
        if (presence?.session_started_at) {
            sessionMinutes = Math.max(0, Math.floor((Date.now() - new Date(presence.session_started_at).getTime()) / 60000));
        }

        base.personal = {
            currentPage: presence?.current_page || null,
            online: Boolean(presence && new Date(presence.last_seen).getTime() >= Date.now() - ONLINE_MINUTES * 60000),
            sessionMinutes,
            eventsToday: n(eventsToday.count),
            quizzesToday: n(myQuizzes.count),
            submissionsToday: n(mySubmissions.count),
            dueSoon: n(dueSoon.count),
            averageScore: r2(myScore.average_score),
            bestScore: r2(myScore.best_score),
            attempts: n(myScore.attempts)
        };
    }

    if (role === "faculty") {
        const subjectIds = await assignedSubjectIds(userId);
        const placeholders = subjectIds.map(() => "?").join(",");
        let faculty = {
            assignedSubjects: subjectIds.length,
            learners: 0,
            averageScore: 0,
            attemptsToday: 0,
            submissionsToday: 0,
            atRiskLearners: 0
        };

        if (subjectIds.length) {
            const [[score]] = await db.query(`
                SELECT COUNT(qa.id) attempts, COUNT(DISTINCT qa.student_user_id) learners,
                       AVG(qa.percentage) average_score
                FROM quiz_attempts qa
                INNER JOIN quizzes q ON q.id=qa.quiz_id
                WHERE qa.status='submitted' AND q.subject_id IN (${placeholders})
            `, subjectIds);
            const [[todayQ]] = await db.query(`
                SELECT COUNT(*) count FROM quiz_attempts qa
                INNER JOIN quizzes q ON q.id=qa.quiz_id
                WHERE qa.status='submitted' AND q.subject_id IN (${placeholders})
                  AND DATE(qa.submitted_at)=CURDATE()
            `, subjectIds);
            const [[todayS]] = await db.query(`
                SELECT COUNT(*) count FROM assignment_submissions sub
                INNER JOIN assignments a ON a.id=sub.assignment_id
                WHERE a.subject_id IN (${placeholders}) AND DATE(sub.submitted_at)=CURDATE()
            `, subjectIds);
            const [[risk]] = await db.query(`
                SELECT COUNT(*) count FROM (
                    SELECT qa.student_user_id, AVG(qa.percentage) avg_score
                    FROM quiz_attempts qa
                    INNER JOIN quizzes q ON q.id=qa.quiz_id
                    WHERE qa.status='submitted' AND q.subject_id IN (${placeholders})
                    GROUP BY qa.student_user_id
                    HAVING AVG(qa.percentage) < 50
                ) x
            `, subjectIds);
            const [riskLearners] = await db.query(`
                SELECT u.id student_id, u.full_name, AVG(qa.percentage) average_score, COUNT(*) attempts
                FROM quiz_attempts qa
                INNER JOIN quizzes q ON q.id=qa.quiz_id
                INNER JOIN users u ON u.id=qa.student_user_id
                WHERE qa.status='submitted' AND q.subject_id IN (${placeholders})
                GROUP BY u.id, u.full_name
                HAVING AVG(qa.percentage) < 50
                ORDER BY average_score ASC, attempts DESC
                LIMIT 6
            `, subjectIds);
            faculty = {
                assignedSubjects: subjectIds.length,
                learners: n(score.learners),
                averageScore: r2(score.average_score),
                attemptsToday: n(todayQ.count),
                submissionsToday: n(todayS.count),
                atRiskLearners: n(risk.count),
                riskLearners: riskLearners.map(x => ({ studentId: x.student_id, name: x.full_name, averageScore: r2(x.average_score), attempts: n(x.attempts) }))
            };
        }
        base.faculty = faculty;
    }

    if (role === "admin") {
        const [[risk]] = await db.query(`
            SELECT COUNT(*) count FROM (
                SELECT qa.student_user_id, AVG(qa.percentage) avg_score
                FROM quiz_attempts qa
                WHERE qa.status='submitted'
                GROUP BY qa.student_user_id
                HAVING AVG(qa.percentage) < 50
            ) x
        `);
        const [riskLearners] = await db.query(`
            SELECT u.id student_id, u.full_name, AVG(qa.percentage) average_score, COUNT(*) attempts
            FROM quiz_attempts qa
            INNER JOIN users u ON u.id=qa.student_user_id
            WHERE qa.status='submitted'
            GROUP BY u.id, u.full_name
            HAVING AVG(qa.percentage) < 50
            ORDER BY average_score ASC, attempts DESC
            LIMIT 8
        `);
        const [[users]] = await db.query(`
            SELECT COUNT(*) count FROM users WHERE status='active'
        `);
        const [[resources]] = await db.query(`
            SELECT COUNT(*) count FROM resources WHERE verification_status='approved'
        `);
        const [[publishedQuizzes]] = await db.query(`
            SELECT COUNT(*) count FROM quizzes WHERE is_published=1 AND verification_status='approved'
        `);
        base.admin = {
            activeUsers: n(users.count),
            approvedResources: n(resources.count),
            publishedQuizzes: n(publishedQuizzes.count),
            atRiskLearners: n(risk.count),
            riskLearners: riskLearners.map(x => ({ studentId: x.student_id, name: x.full_name, averageScore: r2(x.average_score), attempts: n(x.attempts) }))
        };
    }

    return base;
}

router.post("/heartbeat", authenticateUser, authorizeRoles("student", "faculty", "admin"), async (req, res) => {
    try {
        const role = await getRoleName(req.user.userId);
        if (!role) return res.status(401).json({ success: false, message: "Account not found" });
        const page = clean(req.body?.page || "");
        await db.query(`
            INSERT INTO user_presence (user_id, role_name, current_page, session_started_at, last_seen)
            VALUES (?, ?, ?, NOW(), NOW())
            ON DUPLICATE KEY UPDATE
                role_name=VALUES(role_name),
                current_page=VALUES(current_page),
                last_seen=NOW()
        `, [req.user.userId, role, page]);
        return res.json({ success: true, online: true, at: new Date().toISOString() });
    } catch (error) {
        console.error("Live heartbeat error:", error.message);
        return res.status(500).json({ success: false, message: "Live presence unavailable" });
    }
});

router.post("/event", authenticateUser, authorizeRoles("student", "faculty", "admin"), async (req, res) => {
    try {
        const eventType = clean(req.body?.eventType, 60) || "interaction";
        const entityType = clean(req.body?.entityType, 60) || null;
        const entityId = Number.isInteger(Number(req.body?.entityId)) ? Number(req.body.entityId) : null;
        const pageUrl = clean(req.body?.pageUrl || req.headers.referer || "", 255) || null;
        let metadata = req.body?.metadata ?? null;
        if (metadata && typeof metadata !== "object") metadata = { value: String(metadata) };
        const role = await getRoleName(req.user.userId);
        await db.query(`
            INSERT INTO learning_events (user_id, role_name, event_type, entity_type, entity_id, page_url, metadata_json)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [req.user.userId, role || req.user.role, eventType, entityType, entityId, pageUrl, metadata ? JSON.stringify(metadata) : null]);
        return res.status(201).json({ success: true });
    } catch (error) {
        console.error("Live event error:", error.message);
        return res.status(500).json({ success: false, message: "Live event could not be recorded" });
    }
});

router.get("/snapshot", authenticateUser, authorizeRoles("student", "faculty", "admin"), async (req, res) => {
    try {
        return res.json({ success: true, data: await snapshot(req) });
    } catch (error) {
        console.error("Live snapshot error:", error);
        return res.status(500).json({ success: false, message: "Unable to load live analytics" });
    }
});

router.get("/stream", authenticateUser, authorizeRoles("student", "faculty", "admin"), async (req, res) => {
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    if (typeof res.flushHeaders === "function") res.flushHeaders();

    let closed = false;
    let timer = null;

    const send = async () => {
        if (closed) return;
        try {
            const data = await snapshot(req);
            res.write(`event: snapshot\ndata: ${JSON.stringify(data)}\n\n`);
        } catch (error) {
            res.write(`event: error\ndata: ${JSON.stringify({ message: "Live analytics refresh failed" })}\n\n`);
        }
    };

    await send();
    timer = setInterval(send, 6000);

    const close = () => {
        if (closed) return;
        closed = true;
        if (timer) clearInterval(timer);
    };

    req.on("close", close);
    res.on("close", close);
});

module.exports = router;
