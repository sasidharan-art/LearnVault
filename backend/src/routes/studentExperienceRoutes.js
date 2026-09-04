const express = require("express");
const db = require("../config/db");
const authenticateUser = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

const router = express.Router();
const n = (v) => Number(v || 0);

async function getProfile(userId) {
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
        LEFT JOIN courses c ON c.id = sp.course_id
        LEFT JOIN course_levels cl ON cl.id = sp.course_level_id
        LEFT JOIN departments d ON d.id = c.department_id
        LEFT JOIN education_domains ed ON ed.id = c.domain_id
        WHERE sp.user_id = ?
        LIMIT 1
    `, [userId]);
    return rows[0] || null;
}

function configured(profile) {
    return Boolean(profile && profile.course_id && profile.course_name);
}

async function subjectIdsFor(profile) {
    if (!configured(profile)) return [];
    const values = [profile.course_id];
    let levelSql = `AND s.course_level_id IS NULL`;
    if (profile.course_level_id) {
        levelSql = `AND (s.course_level_id IS NULL OR s.course_level_id = ?)`;
        values.push(profile.course_level_id);
    }
    const [rows] = await db.query(`
        SELECT s.id, s.subject_code, s.subject_name
        FROM subjects s
        INNER JOIN courses c ON c.id = s.course_id
        WHERE s.course_id = ?
          AND s.is_active = 1
          AND c.is_active = 1
          ${levelSql}
        ORDER BY s.subject_name
    `, values);
    return rows;
}

function ph(ids) {
    return ids.map(() => "?").join(",");
}

router.get(
    "/profile-status",
    authenticateUser,
    authorizeRoles("student"),
    async (req, res) => {
        try {
            const profile = await getProfile(req.user.userId);
            return res.json({ success: true, configured: configured(profile), profile });
        } catch (error) {
            console.error("Student profile status error:", error);
            return res.status(500).json({ success: false, message: "Unable to check Student academic profile" });
        }
    }
);

router.patch(
    "/profile",
    authenticateUser,
    authorizeRoles("student"),
    async (req, res) => {
        const courseId = Number(req.body.courseId);
        const rawLevel = req.body.courseLevelId;
        const courseLevelId = rawLevel === "" || rawLevel === null || rawLevel === undefined ? null : Number(rawLevel);

        if (!Number.isInteger(courseId) || courseId <= 0) {
            return res.status(400).json({ success: false, message: "Select a valid Course / Program" });
        }

        try {
            const [courses] = await db.query(`
                SELECT c.id, c.course_name
                FROM courses c
                LEFT JOIN education_domains ed ON ed.id = c.domain_id
                LEFT JOIN departments d ON d.id = c.department_id
                WHERE c.id = ? AND c.is_active = 1
                  AND (ed.id IS NULL OR ed.is_active = 1)
                  AND (d.id IS NULL OR d.is_active = 1)
                LIMIT 1
            `, [courseId]);

            if (!courses.length) {
                return res.status(400).json({ success: false, message: "The selected Course / Program is not available" });
            }

            const [levels] = await db.query(`
                SELECT id, level_name
                FROM course_levels
                WHERE course_id = ? AND is_active = 1
                ORDER BY level_order, level_name
            `, [courseId]);

            if (levels.length) {
                if (!Number.isInteger(courseLevelId) || !levels.some((x) => Number(x.id) === courseLevelId)) {
                    return res.status(400).json({ success: false, message: "Select a valid Current Level / Year" });
                }
            } else if (courseLevelId !== null) {
                return res.status(400).json({ success: false, message: "This Course does not require a Level / Year" });
            }

            const [existing] = await db.query(`SELECT user_id, course_id FROM student_profiles WHERE user_id = ? LIMIT 1`, [req.user.userId]);

            if (existing.length && existing[0].course_id) {
                return res.status(403).json({
                    success: false,
                    code: "ACADEMIC_REQUEST_REQUIRED",
                    message:
                        "Your academic path is already configured. Use Academic Progress to request a Year / Level or Course change."
                });
            }

            if (existing.length) {
                await db.query(`UPDATE student_profiles SET course_id = ?, course_level_id = ? WHERE user_id = ?`, [courseId, courseLevelId, req.user.userId]);
            } else {
                await db.query(`INSERT INTO student_profiles (user_id, course_id, course_level_id) VALUES (?, ?, ?)`, [req.user.userId, courseId, courseLevelId]);
            }

            const profile = await getProfile(req.user.userId);

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

            return res.json({ success: true, message: "Your learning path is ready", profile });
        } catch (error) {
            console.error("Configure Student profile error:", error);
            return res.status(500).json({ success: false, message: "Unable to save your Course / Level" });
        }
    }
);

router.get(
    "/recommendations",
    authenticateUser,
    authorizeRoles("student"),
    async (req, res) => {
        try {
            const profile = await getProfile(req.user.userId);
            if (!configured(profile)) {
                return res.status(409).json({ success: false, code: "STUDENT_PROFILE_REQUIRED", message: "Configure your Course / Level first" });
            }

            const subjects = await subjectIdsFor(profile);
            const ids = subjects.map((x) => Number(x.id));
            if (!ids.length) return res.json({ success: true, profile, subjects, recommendations: [] });
            const marks = ph(ids);
            const recommendations = [];

            const [assignments] = await db.query(`
                SELECT a.id, a.title, a.due_at, s.subject_code, s.subject_name, sub.status AS submission_status
                FROM assignments a
                INNER JOIN subjects s ON s.id = a.subject_id
                LEFT JOIN assignment_submissions sub ON sub.assignment_id = a.id AND sub.student_user_id = ?
                WHERE a.subject_id IN (${marks}) AND a.status = 'published'
                  AND (sub.id IS NULL OR sub.status <> 'graded')
                ORDER BY a.due_at IS NULL, a.due_at ASC, a.created_at DESC
                LIMIT 5
            `, [req.user.userId, ...ids]);

            assignments.forEach((item) => {
                const overdue = item.due_at && new Date(item.due_at).getTime() < Date.now();
                recommendations.push({
                    type: "assignment", priority: overdue ? 100 : 92,
                    title: item.title, subjectCode: item.subject_code, subjectName: item.subject_name,
                    detail: overdue ? "Overdue — submit this Assignment" : item.due_at ? `Due ${new Date(item.due_at).toLocaleDateString()}` : "Assignment ready",
                    action: item.submission_status ? "Review Submission" : "Open Assignment", url: "/student/assignments.html"
                });
            });

            const [quizzes] = await db.query(`
                SELECT q.id, q.title, q.max_attempts, q.pass_percentage,
                       s.subject_code, s.subject_name,
                       COUNT(qa.id) AS attempts_used,
                       MAX(CASE WHEN qa.status='submitted' THEN qa.percentage ELSE NULL END) AS best_percentage
                FROM quizzes q
                INNER JOIN subjects s ON s.id = q.subject_id
                LEFT JOIN quiz_attempts qa ON qa.quiz_id = q.id AND qa.student_user_id = ?
                WHERE q.subject_id IN (${marks})
                  AND q.verification_status='approved' AND q.is_published=1
                GROUP BY q.id, q.title, q.max_attempts, q.pass_percentage, s.subject_code, s.subject_name
                HAVING COUNT(qa.id) < q.max_attempts
                ORDER BY best_percentage IS NULL DESC, best_percentage ASC, q.created_at DESC
                LIMIT 5
            `, [req.user.userId, ...ids]);

            quizzes.forEach((item) => {
                const best = item.best_percentage === null ? null : n(item.best_percentage);
                recommendations.push({
                    type: "quiz", priority: best === null ? 86 : best < n(item.pass_percentage) ? 90 : 72,
                    title: item.title, subjectCode: item.subject_code, subjectName: item.subject_name,
                    detail: best === null ? "New Quiz available" : `Best score ${Math.round(best)}% • ${n(item.attempts_used)}/${n(item.max_attempts)} attempts used`,
                    action: best === null ? "Start Quiz" : "Practice Again", url: "/student/quizzes.html"
                });
            });

            const [skills] = await db.query(`
                SELECT sk.skill_name, sk.skill_level, s.subject_code, s.subject_name,
                       COALESCE(ssp.progress_percent,0) AS progress_percent
                FROM skills sk
                INNER JOIN subjects s ON s.id = sk.subject_id
                LEFT JOIN student_skill_progress ssp ON ssp.skill_id = sk.id AND ssp.student_user_id = ?
                WHERE sk.subject_id IN (${marks}) AND sk.is_active=1
                  AND COALESCE(ssp.progress_percent,0) < 100
                ORDER BY progress_percent ASC, sk.skill_name
                LIMIT 5
            `, [req.user.userId, ...ids]);

            skills.forEach((item) => recommendations.push({
                type: "skill", priority: n(item.progress_percent) < 30 ? 78 : 66,
                title: item.skill_name, subjectCode: item.subject_code, subjectName: item.subject_name,
                detail: `${Math.round(n(item.progress_percent))}% progress • ${item.skill_level}`, action: "Build Skill", url: "/student/skills.html"
            }));

            const [resources] = await db.query(`
                SELECT r.title, r.created_at, s.subject_code, s.subject_name, rt.type_name
                FROM resources r
                INNER JOIN subjects s ON s.id = r.subject_id
                LEFT JOIN resource_types rt ON rt.id = r.resource_type_id
                WHERE r.subject_id IN (${marks}) AND r.verification_status='approved'
                ORDER BY r.created_at DESC LIMIT 5
            `, ids);

            resources.forEach((item) => recommendations.push({
                type: "resource", priority: 58, title: item.title,
                subjectCode: item.subject_code, subjectName: item.subject_name,
                detail: item.type_name || "Learning Resource", action: "Open Resource", url: "/student/resources.html"
            }));

            const [groups] = await db.query(`
                SELECT pg.group_name, s.subject_code, s.subject_name, pgm.user_id AS joined_user_id
                FROM peer_groups pg
                INNER JOIN subjects s ON s.id = pg.subject_id
                LEFT JOIN peer_group_members pgm ON pgm.group_id = pg.id AND pgm.user_id = ?
                WHERE pg.subject_id IN (${marks}) AND pg.status='open'
                ORDER BY pgm.user_id IS NULL DESC, pg.created_at DESC LIMIT 4
            `, [req.user.userId, ...ids]);

            groups.forEach((item) => recommendations.push({
                type: "peer", priority: item.joined_user_id ? 45 : 52,
                title: item.group_name, subjectCode: item.subject_code, subjectName: item.subject_name,
                detail: item.joined_user_id ? "Continue the discussion" : "Join this learning group",
                action: item.joined_user_id ? "Open Group" : "Join Group", url: "/student/peer-groups.html"
            }));

            recommendations.sort((a, b) => b.priority - a.priority);
            return res.json({ success: true, profile, subjects, recommendations: recommendations.slice(0, 14) });
        } catch (error) {
            console.error("Student recommendations error:", error);
            return res.status(500).json({ success: false, message: "Unable to build personalized recommendations" });
        }
    }
);

router.get(
    "/notifications",
    authenticateUser,
    authorizeRoles("student"),
    async (req, res) => {
        try {
            const profile = await getProfile(req.user.userId);
            if (!configured(profile)) {
                return res.status(409).json({ success: false, code: "STUDENT_PROFILE_REQUIRED", message: "Configure your Course / Level first" });
            }
            const subjects = await subjectIdsFor(profile);
            const ids = subjects.map((x) => Number(x.id));
            if (!ids.length) return res.json({ success: true, notifications: [] });
            const marks = ph(ids);
            const notifications = [];

            const [assignments] = await db.query(`
                SELECT a.title, a.due_at, s.subject_code, s.subject_name, sub.status AS submission_status
                FROM assignments a
                INNER JOIN subjects s ON s.id = a.subject_id
                LEFT JOIN assignment_submissions sub ON sub.assignment_id=a.id AND sub.student_user_id=?
                WHERE a.subject_id IN (${marks}) AND a.status='published'
                  AND (sub.id IS NULL OR sub.status <> 'graded')
                  AND a.due_at IS NOT NULL
                  AND a.due_at <= DATE_ADD(NOW(), INTERVAL 7 DAY)
                ORDER BY a.due_at ASC LIMIT 10
            `, [req.user.userId, ...ids]);
            assignments.forEach((item) => {
                const overdue = new Date(item.due_at).getTime() < Date.now();
                notifications.push({ type:"assignment", severity:overdue?"urgent":"important", title:overdue?`Overdue: ${item.title}`:`Assignment due: ${item.title}`, detail:`${item.subject_code} • ${item.subject_name}`, createdAt:item.due_at, action:"Open Assignment", url:"/student/assignments.html" });
            });

            const [grades] = await db.query(`
                SELECT sub.graded_at, sub.marks_awarded, a.title, a.total_marks, s.subject_code, s.subject_name
                FROM assignment_submissions sub
                INNER JOIN assignments a ON a.id=sub.assignment_id
                INNER JOIN subjects s ON s.id=a.subject_id
                WHERE sub.student_user_id=? AND sub.status='graded'
                  AND sub.graded_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                ORDER BY sub.graded_at DESC LIMIT 10
            `, [req.user.userId]);
            grades.forEach((item) => notifications.push({ type:"grade", severity:"success", title:`Assignment graded: ${item.title}`, detail:`${item.subject_code} • ${n(item.marks_awarded)} / ${n(item.total_marks)}`, createdAt:item.graded_at, action:"View Feedback", url:"/student/assignments.html" }));

            const [resources] = await db.query(`
                SELECT r.title, r.created_at, s.subject_code, s.subject_name
                FROM resources r INNER JOIN subjects s ON s.id=r.subject_id
                WHERE r.subject_id IN (${marks}) AND r.verification_status='approved'
                  AND r.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
                ORDER BY r.created_at DESC LIMIT 10
            `, ids);
            resources.forEach((item) => notifications.push({ type:"resource", severity:"normal", title:`New Resource: ${item.title}`, detail:`${item.subject_code} • ${item.subject_name}`, createdAt:item.created_at, action:"Open Resource", url:"/student/resources.html" }));

            const [quizzes] = await db.query(`
                SELECT q.title, q.created_at, s.subject_code, s.subject_name
                FROM quizzes q INNER JOIN subjects s ON s.id=q.subject_id
                WHERE q.subject_id IN (${marks}) AND q.verification_status='approved' AND q.is_published=1
                  AND q.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
                ORDER BY q.created_at DESC LIMIT 10
            `, ids);
            quizzes.forEach((item) => notifications.push({ type:"quiz", severity:"important", title:`Quiz available: ${item.title}`, detail:`${item.subject_code} • ${item.subject_name}`, createdAt:item.created_at, action:"Open Quiz", url:"/student/quizzes.html" }));

            const [posts] = await db.query(`
                SELECT pp.title, pp.created_at, pg.group_name, author.full_name AS author_name
                FROM peer_posts pp
                INNER JOIN peer_groups pg ON pg.id=pp.group_id
                INNER JOIN peer_group_members pgm ON pgm.group_id=pg.id AND pgm.user_id=?
                INNER JOIN users author ON author.id=pp.author_user_id
                WHERE pp.status='visible' AND pg.status <> 'archived'
                  AND pp.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
                ORDER BY pp.created_at DESC LIMIT 10
            `, [req.user.userId]);
            posts.forEach((item) => notifications.push({ type:"peer", severity:"normal", title:item.title, detail:`${item.group_name} • ${item.author_name}`, createdAt:item.created_at, action:"Open Discussion", url:"/student/peer-groups.html" }));

            notifications.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            return res.json({ success:true, count:notifications.length, notifications:notifications.slice(0,35) });
        } catch (error) {
            console.error("Student notifications error:", error);
            return res.status(500).json({ success:false, message:"Unable to load Student notifications" });
        }
    }
);

module.exports = router;
