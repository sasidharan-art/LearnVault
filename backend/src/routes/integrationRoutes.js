const express = require("express");
const bcrypt = require("bcrypt");

const db = require("../config/db");
const authenticateUser = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

const router = express.Router();

const clean = (value) => String(value ?? "").trim();
const num = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const ph = (ids) => ids.map(() => "?").join(",");
const csv = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;

async function studentProfile(userId) {
    const [rows] = await db.query(`
        SELECT
            sp.user_id,
            sp.course_id,
            sp.course_level_id,
            c.course_code,
            c.course_name,
            cl.level_name,
            d.department_code,
            d.department_name,
            ed.domain_name
        FROM student_profiles sp
        INNER JOIN courses c ON c.id = sp.course_id
        LEFT JOIN course_levels cl ON cl.id = sp.course_level_id
        LEFT JOIN departments d ON d.id = c.department_id
        LEFT JOIN education_domains ed ON ed.id = c.domain_id
        WHERE sp.user_id = ?
        LIMIT 1
    `, [userId]);
    return rows[0] || null;
}

async function allowedSubjects(req) {
    if (req.user.role === "admin") {
        const [rows] = await db.query(`
            SELECT s.id,s.subject_code,s.subject_name,s.course_id,s.course_level_id,
                   c.course_code,c.course_name,cl.level_name
            FROM subjects s
            INNER JOIN courses c ON c.id=s.course_id
            LEFT JOIN course_levels cl ON cl.id=s.course_level_id
            WHERE s.is_active=1 AND c.is_active=1
            ORDER BY c.course_name,cl.level_order,s.subject_name
        `);
        return rows;
    }

    if (req.user.role === "faculty") {
        const [rows] = await db.query(`
            SELECT s.id,s.subject_code,s.subject_name,s.course_id,s.course_level_id,
                   c.course_code,c.course_name,cl.level_name
            FROM faculty_subject_assignments fsa
            INNER JOIN subjects s ON s.id=fsa.subject_id
            INNER JOIN courses c ON c.id=s.course_id
            LEFT JOIN course_levels cl ON cl.id=s.course_level_id
            WHERE fsa.faculty_user_id=? AND fsa.is_active=1
              AND s.is_active=1 AND c.is_active=1
            ORDER BY c.course_name,cl.level_order,s.subject_name
        `,[req.user.userId]);
        return rows;
    }

    const profile = await studentProfile(req.user.userId);
    if (!profile) return [];

    const values = [profile.course_id];
    let levelSql = `AND s.course_level_id IS NULL`;
    if (profile.course_level_id) {
        levelSql = `AND (s.course_level_id IS NULL OR s.course_level_id=?)`;
        values.push(profile.course_level_id);
    }

    const [rows] = await db.query(`
        SELECT s.id,s.subject_code,s.subject_name,s.course_id,s.course_level_id,
               c.course_code,c.course_name,cl.level_name
        FROM subjects s
        INNER JOIN courses c ON c.id=s.course_id
        LEFT JOIN course_levels cl ON cl.id=s.course_level_id
        WHERE s.course_id=? AND s.is_active=1 AND c.is_active=1 ${levelSql}
        ORDER BY cl.level_order,s.subject_name
    `,values);
    return rows;
}

function pageUrl(role,page,title) {
    return `/${role}/${page}?search=${encodeURIComponent(title || "")}`;
}

router.get("/search", authenticateUser, authorizeRoles("student","faculty","admin"), async (req,res) => {
    const q = clean(req.query.q);
    const type = clean(req.query.type).toLowerCase();

    if (q.length < 2) {
        return res.json({success:true,query:q,count:0,results:[],subjects:[]});
    }

    try {
        const subjects = await allowedSubjects(req);
        const ids = subjects.map(x => Number(x.id));
        if (!ids.length) return res.json({success:true,query:q,count:0,results:[],subjects});

        const placeholders = ph(ids);
        const like = `%${q}%`;
        const role = req.user.role;
        const results = [];

        if (!type || type === "resource") {
            const extra = role === "student" ? `AND r.verification_status='approved'` : ``;
            const [rows] = await db.query(`
                SELECT r.id,r.title,r.description,r.verification_status,r.created_at,
                       s.subject_code,s.subject_name,rt.type_name
                FROM resources r
                INNER JOIN subjects s ON s.id=r.subject_id
                LEFT JOIN resource_types rt ON rt.id=r.resource_type_id
                WHERE r.subject_id IN (${placeholders}) ${extra}
                  AND (r.title LIKE ? OR r.description LIKE ? OR s.subject_code LIKE ? OR s.subject_name LIKE ? OR rt.type_name LIKE ?)
                ORDER BY r.created_at DESC LIMIT 10
            `,[...ids,like,like,like,like,like]);
            rows.forEach(row => results.push({type:"resource",id:row.id,title:row.title,subtitle:`${row.subject_code} — ${row.subject_name}`,detail:row.type_name||"Resource",state:row.verification_status,createdAt:row.created_at,url:pageUrl(role,"resources.html",row.title)}));
        }

        if (!type || type === "question") {
            const extra = role === "student" ? `AND qb.verification_status='approved'` : ``;
            const [rows] = await db.query(`
                SELECT qb.id,qb.question_text,qb.question_type,qb.difficulty,qb.verification_status,qb.created_at,
                       s.subject_code,s.subject_name,su.unit_name
                FROM question_bank qb
                INNER JOIN subjects s ON s.id=qb.subject_id
                LEFT JOIN subject_units su ON su.id=qb.unit_id
                WHERE qb.subject_id IN (${placeholders}) AND qb.is_active=1 ${extra}
                  AND (qb.question_text LIKE ? OR s.subject_code LIKE ? OR s.subject_name LIKE ? OR su.unit_name LIKE ?)
                ORDER BY qb.created_at DESC LIMIT 10
            `,[...ids,like,like,like,like]);
            rows.forEach(row => results.push({type:"question",id:row.id,title:row.question_text,subtitle:`${row.subject_code} — ${row.subject_name}`,detail:`${String(row.question_type).replaceAll("_"," ")} • ${row.difficulty}${row.unit_name?` • ${row.unit_name}`:""}`,state:row.verification_status,createdAt:row.created_at,url:pageUrl(role,"questions.html",row.question_text)}));
        }

        if (!type || type === "quiz") {
            const extra = role === "student" ? `AND qz.verification_status='approved' AND qz.is_published=1` : ``;
            const [rows] = await db.query(`
                SELECT qz.id,qz.title,qz.description,qz.verification_status,qz.is_published,qz.created_at,
                       s.subject_code,s.subject_name,su.unit_name
                FROM quizzes qz
                INNER JOIN subjects s ON s.id=qz.subject_id
                LEFT JOIN subject_units su ON su.id=qz.unit_id
                WHERE qz.subject_id IN (${placeholders}) ${extra}
                  AND (qz.title LIKE ? OR qz.description LIKE ? OR s.subject_code LIKE ? OR s.subject_name LIKE ? OR su.unit_name LIKE ?)
                ORDER BY qz.created_at DESC LIMIT 10
            `,[...ids,like,like,like,like,like]);
            rows.forEach(row => results.push({type:"quiz",id:row.id,title:row.title,subtitle:`${row.subject_code} — ${row.subject_name}`,detail:row.unit_name||"Quiz",state:Number(row.is_published)===1?"published":row.verification_status,createdAt:row.created_at,url:pageUrl(role,"quizzes.html",row.title)}));
        }

        if (!type || type === "assignment") {
            const extra = role === "student" ? `AND a.status='published'` : ``;
            const [rows] = await db.query(`
                SELECT a.id,a.title,a.description,a.instructions,a.status,a.due_at,a.created_at,
                       s.subject_code,s.subject_name
                FROM assignments a
                INNER JOIN subjects s ON s.id=a.subject_id
                WHERE a.subject_id IN (${placeholders}) ${extra}
                  AND (a.title LIKE ? OR a.description LIKE ? OR a.instructions LIKE ? OR s.subject_code LIKE ? OR s.subject_name LIKE ?)
                ORDER BY a.created_at DESC LIMIT 10
            `,[...ids,like,like,like,like,like]);
            rows.forEach(row => results.push({type:"assignment",id:row.id,title:row.title,subtitle:`${row.subject_code} — ${row.subject_name}`,detail:row.due_at?`Due ${new Date(row.due_at).toLocaleDateString()}`:"Assignment",state:row.status,createdAt:row.created_at,url:pageUrl(role,"assignments.html",row.title)}));
        }

        if (!type || type === "skill") {
            const extra = role === "student" ? `AND sk.is_active=1` : ``;
            const [rows] = await db.query(`
                SELECT sk.id,sk.skill_name,sk.description,sk.skill_level,sk.is_active,sk.created_at,
                       s.subject_code,s.subject_name
                FROM skills sk
                INNER JOIN subjects s ON s.id=sk.subject_id
                WHERE sk.subject_id IN (${placeholders}) ${extra}
                  AND (sk.skill_name LIKE ? OR sk.description LIKE ? OR sk.skill_level LIKE ? OR s.subject_code LIKE ? OR s.subject_name LIKE ?)
                ORDER BY sk.created_at DESC LIMIT 10
            `,[...ids,like,like,like,like,like]);
            rows.forEach(row => results.push({type:"skill",id:row.id,title:row.skill_name,subtitle:`${row.subject_code} — ${row.subject_name}`,detail:row.skill_level,state:Number(row.is_active)===1?"published":"hidden",createdAt:row.created_at,url:pageUrl(role,"skills.html",row.skill_name)}));
        }

        if (!type || type === "peer_group") {
            const extra = role === "student" ? `AND pg.status<>'archived'` : ``;
            const [rows] = await db.query(`
                SELECT pg.id,pg.group_name,pg.description,pg.status,pg.created_at,
                       s.subject_code,s.subject_name
                FROM peer_groups pg
                INNER JOIN subjects s ON s.id=pg.subject_id
                WHERE pg.subject_id IN (${placeholders}) ${extra}
                  AND (pg.group_name LIKE ? OR pg.description LIKE ? OR s.subject_code LIKE ? OR s.subject_name LIKE ?)
                ORDER BY pg.created_at DESC LIMIT 10
            `,[...ids,like,like,like,like]);
            rows.forEach(row => results.push({type:"peer_group",id:row.id,title:row.group_name,subtitle:`${row.subject_code} — ${row.subject_name}`,detail:"Peer Learning Group",state:row.status,createdAt:row.created_at,url:pageUrl(role,"peer-groups.html",row.group_name)}));
        }

        results.sort((a,b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        return res.json({success:true,query:q,count:results.length,results:results.slice(0,40),subjects});

    } catch (error) {
        console.error("Global search error:",error);
        return res.status(500).json({success:false,message:"Unable to search LearnVault"});
    }
});

router.get("/activity", authenticateUser, authorizeRoles("student","faculty","admin"), async (req,res) => {
    try {
        const activity = [];

        if (req.user.role === "student") {
            const subjects = await allowedSubjects(req);
            const ids = subjects.map(x => Number(x.id));

            if (ids.length) {
                const placeholders = ph(ids);
                const [resources] = await db.query(`
                    SELECT r.title,r.created_at,s.subject_code
                    FROM resources r INNER JOIN subjects s ON s.id=r.subject_id
                    WHERE r.subject_id IN (${placeholders}) AND r.verification_status='approved'
                    ORDER BY r.created_at DESC LIMIT 8
                `,ids);
                resources.forEach(x => activity.push({type:"resource",title:`New resource: ${x.title}`,detail:x.subject_code,createdAt:x.created_at,url:"/student/resources.html"}));

                const [quizzes] = await db.query(`
                    SELECT q.title,q.created_at,s.subject_code
                    FROM quizzes q INNER JOIN subjects s ON s.id=q.subject_id
                    WHERE q.subject_id IN (${placeholders}) AND q.verification_status='approved' AND q.is_published=1
                    ORDER BY q.created_at DESC LIMIT 8
                `,ids);
                quizzes.forEach(x => activity.push({type:"quiz",title:`Quiz available: ${x.title}`,detail:x.subject_code,createdAt:x.created_at,url:"/student/quizzes.html"}));

                const [assignments] = await db.query(`
                    SELECT a.title,a.due_at,a.created_at,s.subject_code
                    FROM assignments a INNER JOIN subjects s ON s.id=a.subject_id
                    WHERE a.subject_id IN (${placeholders}) AND a.status='published'
                    ORDER BY a.created_at DESC LIMIT 8
                `,ids);
                assignments.forEach(x => activity.push({type:"assignment",title:`Assignment: ${x.title}`,detail:x.due_at?`${x.subject_code} • Due ${new Date(x.due_at).toLocaleDateString()}`:x.subject_code,createdAt:x.created_at,url:"/student/assignments.html"}));
            }

            const [graded] = await db.query(`
                SELECT sub.marks_awarded,sub.graded_at,a.title,a.total_marks,s.subject_code
                FROM assignment_submissions sub
                INNER JOIN assignments a ON a.id=sub.assignment_id
                INNER JOIN subjects s ON s.id=a.subject_id
                WHERE sub.student_user_id=? AND sub.status='graded'
                ORDER BY sub.graded_at DESC LIMIT 10
            `,[req.user.userId]);
            graded.forEach(x => activity.push({type:"grade",title:`Graded: ${x.title}`,detail:`${x.subject_code} • ${num(x.marks_awarded)} / ${num(x.total_marks)}`,createdAt:x.graded_at,url:"/student/assignments.html"}));

        } else if (req.user.role === "faculty") {
            const [submissions] = await db.query(`
                SELECT sub.status,sub.submitted_at,a.title,s.subject_code,student.full_name AS student_name
                FROM assignment_submissions sub
                INNER JOIN assignments a ON a.id=sub.assignment_id
                INNER JOIN subjects s ON s.id=a.subject_id
                INNER JOIN users student ON student.id=sub.student_user_id
                WHERE a.created_by=?
                ORDER BY sub.submitted_at DESC LIMIT 14
            `,[req.user.userId]);
            submissions.forEach(x => activity.push({type:"submission",title:`${x.student_name} submitted ${x.title}`,detail:`${x.subject_code} • ${x.status}`,createdAt:x.submitted_at,url:"/faculty/assignments.html"}));

            const [attempts] = await db.query(`
                SELECT qa.percentage,qa.submitted_at,q.title,s.subject_code,student.full_name AS student_name
                FROM quiz_attempts qa
                INNER JOIN quizzes q ON q.id=qa.quiz_id
                INNER JOIN subjects s ON s.id=q.subject_id
                INNER JOIN users student ON student.id=qa.student_user_id
                WHERE q.created_by=? AND qa.status='submitted'
                ORDER BY qa.submitted_at DESC LIMIT 14
            `,[req.user.userId]);
            attempts.forEach(x => activity.push({type:"quiz_attempt",title:`${x.student_name} completed ${x.title}`,detail:`${x.subject_code} • ${num(x.percentage).toFixed(0)}%`,createdAt:x.submitted_at,url:"/faculty/progress.html"}));

        } else {
            const [users] = await db.query(`
                SELECT u.full_name,u.status,u.created_at,r.role_name
                FROM users u INNER JOIN roles r ON r.id=u.role_id
                ORDER BY u.created_at DESC LIMIT 10
            `);
            users.forEach(x => activity.push({type:"user",title:`New ${x.role_name}: ${x.full_name}`,detail:x.status,createdAt:x.created_at,url:"/admin/users.html"}));

            const [assignments] = await db.query(`
                SELECT a.title,a.status,a.created_at,u.full_name AS creator_name
                FROM assignments a INNER JOIN users u ON u.id=a.created_by
                ORDER BY a.created_at DESC LIMIT 10
            `);
            assignments.forEach(x => activity.push({type:"assignment",title:x.title,detail:`${x.creator_name} • ${x.status}`,createdAt:x.created_at,url:"/admin/assignments.html"}));

            const [quizzes] = await db.query(`
                SELECT q.title,q.is_published,q.verification_status,q.created_at,u.full_name AS creator_name
                FROM quizzes q INNER JOIN users u ON u.id=q.created_by
                ORDER BY q.created_at DESC LIMIT 10
            `);
            quizzes.forEach(x => activity.push({type:"quiz",title:x.title,detail:`${x.creator_name} • ${Number(x.is_published)===1?"published":x.verification_status}`,createdAt:x.created_at,url:"/admin/quizzes.html"}));
        }

        activity.sort((a,b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        return res.json({success:true,count:activity.length,activity:activity.slice(0,40)});

    } catch (error) {
        console.error("Activity Center error:",error);
        return res.status(500).json({success:false,message:"Unable to load Activity Center"});
    }
});

router.get("/profile", authenticateUser, authorizeRoles("student","faculty","admin"), async (req,res) => {
    try {
        const [rows] = await db.query(`
            SELECT u.id,u.full_name,u.username,u.email,u.phone,u.status,u.created_at,r.role_name
            FROM users u INNER JOIN roles r ON r.id=u.role_id
            WHERE u.id=? LIMIT 1
        `,[req.user.userId]);

        if (!rows.length) return res.status(404).json({success:false,message:"Account not found"});

        const u = rows[0];
        let academic = null;
        let subjects = [];
        if (u.role_name === "student") academic = await studentProfile(u.id);
        if (u.role_name === "faculty") subjects = await allowedSubjects(req);

        return res.json({
            success:true,
            profile:{id:u.id,fullName:u.full_name,username:u.username,email:u.email,phone:u.phone,role:u.role_name,status:u.status,createdAt:u.created_at},
            academic,
            subjects
        });
    } catch (error) {
        console.error("Profile load error:",error);
        return res.status(500).json({success:false,message:"Unable to load profile"});
    }
});

router.patch("/profile", authenticateUser, authorizeRoles("student","faculty","admin"), async (req,res) => {
    const fullName = clean(req.body.fullName);
    const phone = clean(req.body.phone);

    if (fullName.length < 2 || fullName.length > 120) return res.status(400).json({success:false,message:"Full Name must be between 2 and 120 characters"});
    if (phone && !/^[0-9+\-\s()]{6,20}$/.test(phone)) return res.status(400).json({success:false,message:"Enter a valid phone number"});

    try {
        await db.query(`UPDATE users SET full_name=?,phone=? WHERE id=?`,[fullName,phone||null,req.user.userId]);
        return res.json({success:true,message:"Profile updated"});
    } catch (error) {
        console.error("Profile update error:",error);
        return res.status(500).json({success:false,message:"Unable to update profile"});
    }
});

router.patch("/profile/password", authenticateUser, authorizeRoles("student","faculty","admin"), async (req,res) => {
    const currentPassword = String(req.body.currentPassword || "");
    const newPassword = String(req.body.newPassword || "");
    const confirmPassword = String(req.body.confirmPassword || "");

    if (!currentPassword || !newPassword || !confirmPassword) return res.status(400).json({success:false,message:"All password fields are required"});
    if (newPassword !== confirmPassword) return res.status(400).json({success:false,message:"New Password and Confirm Password do not match"});
    if (newPassword.length < 8) return res.status(400).json({success:false,message:"New Password must contain at least 8 characters"});
    if (newPassword === currentPassword) return res.status(400).json({success:false,message:"New Password must be different from Current Password"});

    try {
        const [rows] = await db.query(`SELECT password_hash FROM users WHERE id=? LIMIT 1`,[req.user.userId]);
        if (!rows.length) return res.status(404).json({success:false,message:"Account not found"});

        const valid = await bcrypt.compare(currentPassword,rows[0].password_hash);
        if (!valid) return res.status(401).json({success:false,message:"Current Password is incorrect"});

        const hash = await bcrypt.hash(newPassword,12);
        await db.query(`UPDATE users SET password_hash=? WHERE id=?`,[hash,req.user.userId]);
        return res.json({success:true,message:"Password changed successfully"});
    } catch (error) {
        console.error("Password change error:",error);
        return res.status(500).json({success:false,message:"Unable to change password"});
    }
});

async function courseReportRows() {
    const [rows] = await db.query(`
        SELECT c.id,c.course_code,c.course_name,
          (SELECT COUNT(*) FROM student_profiles sp WHERE sp.course_id=c.id) AS students,
          (SELECT COUNT(*) FROM subjects s WHERE s.course_id=c.id AND s.is_active=1) AS subjects,
          (SELECT COUNT(*) FROM resources r INNER JOIN subjects s ON s.id=r.subject_id WHERE s.course_id=c.id AND r.verification_status='approved') AS published_resources,
          (SELECT COUNT(*) FROM quizzes q INNER JOIN subjects s ON s.id=q.subject_id WHERE s.course_id=c.id AND q.verification_status='approved' AND q.is_published=1) AS published_quizzes,
          (SELECT COUNT(*) FROM assignments a INNER JOIN subjects s ON s.id=a.subject_id WHERE s.course_id=c.id AND a.status='published') AS published_assignments,
          (SELECT AVG(qa.percentage) FROM quiz_attempts qa INNER JOIN quizzes q ON q.id=qa.quiz_id INNER JOIN subjects s ON s.id=q.subject_id WHERE s.course_id=c.id AND qa.status='submitted') AS average_quiz_score
        FROM courses c
        WHERE c.is_active=1
        ORDER BY c.course_name
    `);
    return rows;
}

async function facultyReportRows() {
    const [rows] = await db.query(`
        SELECT u.id,u.full_name,u.username,u.email,u.status,
          (SELECT COUNT(*) FROM faculty_subject_assignments fsa WHERE fsa.faculty_user_id=u.id AND fsa.is_active=1) AS assigned_subjects,
          (SELECT COUNT(*) FROM resources r WHERE r.uploaded_by=u.id AND r.verification_status='approved') AS resources,
          (SELECT COUNT(*) FROM question_bank qb WHERE qb.created_by=u.id AND qb.verification_status='approved') AS questions,
          (SELECT COUNT(*) FROM quizzes q WHERE q.created_by=u.id AND q.verification_status='approved' AND q.is_published=1) AS quizzes,
          (SELECT COUNT(*) FROM assignments a WHERE a.created_by=u.id AND a.status='published') AS assignments,
          (SELECT COUNT(*) FROM peer_groups pg WHERE pg.created_by=u.id AND pg.status<>'archived') AS peer_groups
        FROM users u
        INNER JOIN roles r ON r.id=u.role_id
        WHERE r.role_name='faculty'
        ORDER BY u.full_name
    `);
    return rows;
}

router.get("/admin/reports", authenticateUser, authorizeRoles("admin"), async (req,res) => {
    try {
        const [[users]] = await db.query(`
            SELECT COUNT(*) total_users,
              SUM(r.role_name='student') students,
              SUM(r.role_name='faculty') faculty,
              SUM(r.role_name='admin') admins,
              SUM(u.status='active') active_users
            FROM users u INNER JOIN roles r ON r.id=u.role_id
        `);

        const [[learning]] = await db.query(`
            SELECT
              (SELECT COUNT(*) FROM courses WHERE is_active=1) courses,
              (SELECT COUNT(*) FROM subjects WHERE is_active=1) subjects,
              (SELECT COUNT(*) FROM resources WHERE verification_status='approved') resources,
              (SELECT COUNT(*) FROM question_bank WHERE verification_status='approved' AND is_active=1) questions,
              (SELECT COUNT(*) FROM quizzes WHERE verification_status='approved' AND is_published=1) quizzes,
              (SELECT COUNT(*) FROM assignments WHERE status='published') assignments,
              (SELECT COUNT(*) FROM skills WHERE is_active=1) skills,
              (SELECT COUNT(*) FROM peer_groups WHERE status<>'archived') peer_groups
        `);

        const [[assessment]] = await db.query(`
            SELECT
              (SELECT COUNT(*) FROM quiz_attempts WHERE status='submitted') quiz_attempts,
              (SELECT COALESCE(AVG(percentage),0) FROM quiz_attempts WHERE status='submitted') average_quiz_score,
              (SELECT COUNT(*) FROM assignment_submissions) submissions,
              (SELECT COUNT(*) FROM assignment_submissions WHERE status='graded') graded_submissions,
              (SELECT COUNT(*) FROM assignment_submissions WHERE status='submitted') pending_grading
        `);

        const courses = await courseReportRows();
        const faculty = await facultyReportRows();

        return res.json({
            success:true,
            overview:{
                totalUsers:num(users.total_users),students:num(users.students),faculty:num(users.faculty),admins:num(users.admins),activeUsers:num(users.active_users),
                courses:num(learning.courses),subjects:num(learning.subjects),resources:num(learning.resources),questions:num(learning.questions),quizzes:num(learning.quizzes),assignments:num(learning.assignments),skills:num(learning.skills),peerGroups:num(learning.peer_groups),
                quizAttempts:num(assessment.quiz_attempts),averageQuizScore:Number(num(assessment.average_quiz_score).toFixed(2)),submissions:num(assessment.submissions),gradedSubmissions:num(assessment.graded_submissions),pendingGrading:num(assessment.pending_grading)
            },
            courses:courses.map(x => ({...x,students:num(x.students),subjects:num(x.subjects),published_resources:num(x.published_resources),published_quizzes:num(x.published_quizzes),published_assignments:num(x.published_assignments),average_quiz_score:Number(num(x.average_quiz_score).toFixed(2))})),
            faculty:faculty.map(x => ({...x,assigned_subjects:num(x.assigned_subjects),resources:num(x.resources),questions:num(x.questions),quizzes:num(x.quizzes),assignments:num(x.assignments),peer_groups:num(x.peer_groups)}))
        });
    } catch (error) {
        console.error("Admin reports error:",error);
        return res.status(500).json({success:false,message:"Unable to load Admin reports"});
    }
});

router.get("/admin/reports.csv", authenticateUser, authorizeRoles("admin"), async (req,res) => {
    try {
        const report = clean(req.query.report).toLowerCase();
        let headers,rows,filename;

        if (report === "faculty") {
            const data = await facultyReportRows();
            headers=["Faculty ID","Full Name","Username","Email","Status","Assigned Subjects","Resources","Questions","Quizzes","Assignments","Peer Groups"];
            rows=data.map(x=>[x.id,x.full_name,x.username,x.email,x.status,x.assigned_subjects,x.resources,x.questions,x.quizzes,x.assignments,x.peer_groups]);
            filename="learnvault_faculty_contribution_report.csv";
        } else {
            const data = await courseReportRows();
            headers=["Course ID","Course Code","Course Name","Students","Subjects","Published Resources","Published Quizzes","Published Assignments","Average Quiz Score"];
            rows=data.map(x=>[x.id,x.course_code,x.course_name,x.students,x.subjects,x.published_resources,x.published_quizzes,x.published_assignments,Number(num(x.average_quiz_score).toFixed(2))]);
            filename="learnvault_course_learning_report.csv";
        }

        const text=[headers.map(csv).join(","),...rows.map(row=>row.map(csv).join(","))].join("\n");
        res.setHeader("Content-Type","text/csv; charset=utf-8");
        res.setHeader("Content-Disposition",`attachment; filename="${filename}"`);
        return res.send("\uFEFF"+text);
    } catch (error) {
        console.error("CSV report error:",error);
        return res.status(500).json({success:false,message:"Unable to export report"});
    }
});

router.get("/admin/system-check", authenticateUser, authorizeRoles("admin"), async (req,res) => {
    const required=[
        "roles","users","student_profiles","faculty_profiles","password_reset_otps",
        "education_domains","departments","courses","course_levels","subjects",
        "faculty_subject_assignments","resource_types","resources","subject_units",
        "question_bank","question_options","quizzes","quiz_questions","quiz_attempts",
        "quiz_attempt_answers","skills","student_skill_progress","peer_groups",
        "peer_group_members","peer_posts","peer_comments","assignments","assignment_submissions",
        "student_academic_history","student_academic_change_requests",
        "announcements","user_notification_reads"
    ];

    try {
        const [rows] = await db.query(`SELECT table_name FROM information_schema.tables WHERE table_schema=DATABASE()`);
        const current = new Set(rows.map(x=>String(x.TABLE_NAME || x.table_name).toLowerCase()));
        const tables=required.map(name=>({name,exists:current.has(name.toLowerCase())}));
        const missing=tables.filter(x=>!x.exists).map(x=>x.name);
        const [[info]] = await db.query(`SELECT DATABASE() database_name,VERSION() mysql_version`);
        return res.json({success:true,database:info.database_name,mysqlVersion:info.mysql_version,expectedTables:required.length,existingRequiredTables:tables.filter(x=>x.exists).length,healthy:missing.length===0,missing,tables});
    } catch (error) {
        console.error("System check error:",error);
        return res.status(500).json({success:false,message:"Unable to run system check"});
    }
});

module.exports = router;
