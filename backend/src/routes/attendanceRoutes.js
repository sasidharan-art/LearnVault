const express = require("express");
const db = require("../config/db");
const authenticateUser = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

const router = express.Router();

async function facultyOwnsSubject(facultyUserId, subjectId) {
    const [[row]] = await db.query(`
        SELECT fsa.id
        FROM faculty_subject_assignments fsa
        INNER JOIN subjects s ON s.id = fsa.subject_id AND s.is_active = 1
        WHERE fsa.faculty_user_id=? AND fsa.subject_id=? AND fsa.is_active=1
        LIMIT 1
    `, [facultyUserId, subjectId]);
    return !!row;
}

router.post("/sessions", authenticateUser, authorizeRoles("faculty"), async (req, res) => {
    try {
        const subjectId = Number(req.body.subjectId);
        const sessionDate = req.body.sessionDate || new Date().toISOString().slice(0,10);
        const topic = String(req.body.topic || "").trim() || null;
        if (!Number.isInteger(subjectId)) return res.status(400).json({success:false,message:"Valid subject is required"});
        if (!(await facultyOwnsSubject(req.user.userId, subjectId))) return res.status(403).json({success:false,message:"You can mark attendance only for an assigned subject"});
        const [result] = await db.query(`INSERT INTO attendance_sessions(subject_id,faculty_user_id,session_date,topic,status) VALUES(?,?,?,?, 'open')`,[subjectId,req.user.userId,sessionDate,topic]);
        return res.status(201).json({success:true,sessionId:result.insertId,message:"Attendance session created"});
    } catch (error) {
        console.error("Create attendance session error:", error);
        return res.status(500).json({success:false,message:"Unable to create attendance session"});
    }
});


router.get("/roster", authenticateUser, authorizeRoles("faculty"), async (req,res)=>{
    try {
        const subjectId=Number(req.query.subjectId);
        if(!Number.isInteger(subjectId)) return res.status(400).json({success:false,message:"Valid subject is required"});
        if(!(await facultyOwnsSubject(req.user.userId,subjectId))) return res.status(403).json({success:false,message:"You can view rosters only for assigned subjects"});
        const [[subject]]=await db.query(`SELECT id,course_id,course_level_id,subject_name FROM subjects WHERE id=? LIMIT 1`,[subjectId]);
        if(!subject) return res.status(404).json({success:false,message:"Subject not found"});
        const params=[subject.course_id];
        let level="";
        if(subject.course_level_id){ level="AND (sp.course_level_id IS NULL OR sp.course_level_id=?)"; params.push(subject.course_level_id); }
        const [students]=await db.query(`SELECT u.id AS user_id,u.full_name,u.username,sp.course_level_id,cl.level_name FROM users u INNER JOIN student_profiles sp ON sp.user_id=u.id LEFT JOIN course_levels cl ON cl.id=sp.course_level_id WHERE u.status='active' AND sp.course_id=? ${level} ORDER BY u.full_name`,params);
        res.json({success:true,subject,students});
    } catch(error){console.error(error);res.status(500).json({success:false,message:"Unable to load student roster"});}
});

router.post("/sessions/:id/records", authenticateUser, authorizeRoles("faculty"), async (req, res) => {
    const connection = await db.getConnection();
    try {
        const sessionId = Number(req.params.id);
        const records = Array.isArray(req.body.records) ? req.body.records : [];
        if (!Number.isInteger(sessionId) || !records.length) return res.status(400).json({success:false,message:"Attendance records are required"});
        const [[session]] = await connection.query(`SELECT id,subject_id,faculty_user_id,status FROM attendance_sessions WHERE id=? LIMIT 1`,[sessionId]);
        if (!session) return res.status(404).json({success:false,message:"Attendance session not found"});
        if (session.faculty_user_id !== req.user.userId) return res.status(403).json({success:false,message:"You do not own this attendance session"});
        if (session.status === "cancelled") return res.status(400).json({success:false,message:"Cancelled sessions cannot be marked"});
        await connection.beginTransaction();
        for (const record of records) {
            const studentId = Number(record.studentUserId);
            const status = ["present","absent","late"].includes(record.status) ? record.status : "present";
            if (!Number.isInteger(studentId)) continue;
            await connection.query(`INSERT INTO attendance_records(session_id,student_user_id,attendance_status) VALUES(?,?,?) ON DUPLICATE KEY UPDATE attendance_status=VALUES(attendance_status),marked_at=CURRENT_TIMESTAMP`,[sessionId,studentId,status]);
        }
        await connection.commit();
        return res.json({success:true,message:"Attendance saved"});
    } catch (error) {
        await connection.rollback();
        console.error("Save attendance error:", error);
        return res.status(500).json({success:false,message:"Unable to save attendance"});
    } finally { connection.release(); }
});

router.patch("/sessions/:id/close", authenticateUser, authorizeRoles("faculty","admin"), async (req,res)=>{
    try {
        const id=Number(req.params.id);
        const [result]=await db.query(`UPDATE attendance_sessions SET status='closed',closed_at=NOW() WHERE id=? AND status='open' ${req.user.role==='faculty'?'AND faculty_user_id=?':''}`,
            req.user.role==='faculty' ? [id,req.user.userId] : [id]);
        if(!result.affectedRows) return res.status(404).json({success:false,message:"Open attendance session not found"});
        res.json({success:true,message:"Attendance session closed"});
    } catch(error){ console.error(error); res.status(500).json({success:false,message:"Unable to close attendance session"}); }
});

router.get("/student", authenticateUser, authorizeRoles("student"), async (req,res)=>{
    try {
        const [[summary]] = await db.query(`
            SELECT
                COUNT(ar.id) total_marked,
                SUM(ar.attendance_status='present') present_count,
                SUM(ar.attendance_status='late') late_count,
                SUM(ar.attendance_status='absent') absent_count,
                ROUND(100 * SUM(ar.attendance_status='present') / NULLIF(COUNT(ar.id),0),2) attendance_rate
            FROM attendance_records ar
            INNER JOIN attendance_sessions ats ON ats.id=ar.session_id
            WHERE ar.student_user_id=? AND ats.status<>'cancelled'
        `,[req.user.userId]);
        const [subjects] = await db.query(`
            SELECT s.id,s.subject_code,s.subject_name,
                   COUNT(ar.id) total_marked,
                   SUM(ar.attendance_status='present') present_count,
                   ROUND(100 * SUM(ar.attendance_status='present') / NULLIF(COUNT(ar.id),0),2) attendance_rate
            FROM attendance_records ar
            INNER JOIN attendance_sessions ats ON ats.id=ar.session_id
            INNER JOIN subjects s ON s.id=ats.subject_id
            WHERE ar.student_user_id=? AND ats.status<>'cancelled'
            GROUP BY s.id,s.subject_code,s.subject_name
            ORDER BY attendance_rate ASC, s.subject_name
        `,[req.user.userId]);
        res.json({success:true,summary:summary||{},subjects});
    } catch(error){ console.error(error); res.status(500).json({success:false,message:"Unable to load attendance"}); }
});

router.get("/sessions", authenticateUser, authorizeRoles("faculty","admin"), async (req,res)=>{
    try {
        const params=[];
        let where="";
        if(req.user.role==='faculty'){where="WHERE ats.faculty_user_id=?";params.push(req.user.userId);}
        const [rows]=await db.query(`
            SELECT ats.id,ats.session_date,ats.topic,ats.status,s.subject_code,s.subject_name,
                   COUNT(ar.id) marked_count,
                   SUM(ar.attendance_status='present') present_count,
                   SUM(ar.attendance_status='late') late_count,
                   SUM(ar.attendance_status='absent') absent_count
            FROM attendance_sessions ats
            INNER JOIN subjects s ON s.id=ats.subject_id
            LEFT JOIN attendance_records ar ON ar.session_id=ats.id
            ${where}
            GROUP BY ats.id,ats.session_date,ats.topic,ats.status,s.subject_code,s.subject_name
            ORDER BY ats.session_date DESC,ats.id DESC
            LIMIT 100
        `,params);
        res.json({success:true,sessions:rows});
    } catch(error){console.error(error);res.status(500).json({success:false,message:"Unable to load attendance sessions"});}
});

module.exports=router;
