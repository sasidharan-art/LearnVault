const express = require("express");
const db = require("../config/db");
const authenticateUser = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");
const router = express.Router();
const clean = v => String(v ?? "").trim();
const id = v => Number.isInteger(Number(v)) && Number(v) > 0 ? Number(v) : null;

async function facultySubjectAllowed(userId, subjectId) {
    if (!subjectId) return true;
    const [r] = await db.query(`SELECT 1 FROM faculty_subject_assignments WHERE faculty_user_id=? AND subject_id=? AND is_active=1 LIMIT 1`, [userId, subjectId]);
    return r.length > 0;
}

router.get("/", authenticateUser, authorizeRoles("student","faculty","admin"), async (req,res)=>{
    try {
        let rows;
        if (req.user.role === "faculty") {
            [rows] = await db.query(`SELECT lc.*,s.subject_code,s.subject_name,c.course_name,cl.level_name,
                (SELECT COUNT(*) FROM live_class_attendance a WHERE a.live_class_id=lc.id) participants
                FROM live_classes lc LEFT JOIN subjects s ON s.id=lc.subject_id LEFT JOIN courses c ON c.id=lc.course_id LEFT JOIN course_levels cl ON cl.id=lc.course_level_id
                WHERE lc.faculty_user_id=? ORDER BY lc.starts_at DESC LIMIT 100`, [req.user.userId]);
        } else if (req.user.role === "admin") {
            [rows] = await db.query(`SELECT lc.*,u.full_name faculty_name,s.subject_code,s.subject_name,c.course_name,cl.level_name,
                (SELECT COUNT(*) FROM live_class_attendance a WHERE a.live_class_id=lc.id) participants
                FROM live_classes lc JOIN users u ON u.id=lc.faculty_user_id LEFT JOIN subjects s ON s.id=lc.subject_id LEFT JOIN courses c ON c.id=lc.course_id LEFT JOIN course_levels cl ON cl.id=lc.course_level_id
                ORDER BY lc.starts_at DESC LIMIT 200`);
        } else {
            const [[profile]] = await db.query(`SELECT sp.course_id,sp.course_level_id FROM student_profiles sp WHERE sp.user_id=? LIMIT 1`, [req.user.userId]);
            if (!profile) return res.json({success:true,classes:[]});
            [rows] = await db.query(`SELECT lc.*,u.full_name faculty_name,s.subject_code,s.subject_name,c.course_name,cl.level_name,
                (SELECT COUNT(*) FROM live_class_attendance a WHERE a.live_class_id=lc.id) participants,
                EXISTS(SELECT 1 FROM live_class_attendance a WHERE a.live_class_id=lc.id AND a.user_id=?) joined
                FROM live_classes lc JOIN users u ON u.id=lc.faculty_user_id LEFT JOIN subjects s ON s.id=lc.subject_id LEFT JOIN courses c ON c.id=lc.course_id LEFT JOIN course_levels cl ON cl.id=lc.course_level_id
                WHERE lc.status<>'cancelled' AND (lc.course_id IS NULL OR lc.course_id=?) AND (lc.course_level_id IS NULL OR lc.course_level_id=?)
                ORDER BY lc.starts_at ASC LIMIT 100`, [req.user.userId, profile.course_id, profile.course_level_id]);
        }
        res.json({success:true,classes:rows});
    } catch(e){ console.error(e); res.status(500).json({success:false,message:"Unable to load Live Classes"}); }
});

router.post("/", authenticateUser, authorizeRoles("faculty"), async (req,res)=>{
    const subjectId=id(req.body.subjectId),courseId=id(req.body.courseId),levelId=id(req.body.courseLevelId);
    const title=clean(req.body.title),description=clean(req.body.description),meetingUrl=clean(req.body.meetingUrl),startsAt=clean(req.body.startsAt),endsAt=clean(req.body.endsAt);
    if(!title||!meetingUrl||!startsAt) return res.status(400).json({success:false,message:"Title, meeting link and start time are required"});
    try {
        if(!(await facultySubjectAllowed(req.user.userId,subjectId))) return res.status(403).json({success:false,message:"You can schedule Live Classes only for your assigned subjects"});
        const [r]=await db.query(`INSERT INTO live_classes(faculty_user_id,subject_id,course_id,course_level_id,title,description,meeting_url,starts_at,ends_at,status) VALUES(?,?,?,?,?,?,?,?,?,'scheduled')`,[req.user.userId,subjectId,courseId,levelId,title,description||null,meetingUrl,startsAt,endsAt||null]);
        res.status(201).json({success:true,message:"Live Class scheduled",classId:r.insertId});
    } catch(e){console.error(e);res.status(500).json({success:false,message:"Unable to schedule Live Class"});}
});

router.patch("/:id/status", authenticateUser, authorizeRoles("faculty","admin"), async (req,res)=>{
    const classId=id(req.params.id),status=clean(req.body.status).toLowerCase();
    if(!classId||!["scheduled","live","completed","cancelled"].includes(status)) return res.status(400).json({success:false,message:"Invalid Live Class status"});
    try {
        const [r]=await db.query(`UPDATE live_classes SET status=? WHERE id=? AND (?='admin' OR faculty_user_id=?)`,[status,classId,req.user.role,req.user.userId]);
        if(!r.affectedRows)return res.status(404).json({success:false,message:"Live Class not found"});
        res.json({success:true,message:`Live Class marked ${status}`});
    } catch(e){console.error(e);res.status(500).json({success:false,message:"Unable to update Live Class"});}
});

router.post("/:id/join", authenticateUser, authorizeRoles("student","faculty","admin"), async (req,res)=>{
    const classId=id(req.params.id); if(!classId)return res.status(400).json({success:false,message:"Invalid Live Class"});
    try {
        const [rows]=await db.query(`SELECT id,meeting_url,status FROM live_classes WHERE id=? LIMIT 1`,[classId]);
        if(!rows.length)return res.status(404).json({success:false,message:"Live Class not found"});
        await db.query(`INSERT INTO live_class_attendance(live_class_id,user_id,joined_at) VALUES(?,?,NOW()) ON DUPLICATE KEY UPDATE joined_at=NOW(),left_at=NULL`,[classId,req.user.userId]);
        res.json({success:true,meetingUrl:rows[0].meeting_url,status:rows[0].status});
    } catch(e){console.error(e);res.status(500).json({success:false,message:"Unable to join Live Class"});}
});

router.post("/:id/leave", authenticateUser, authorizeRoles("student","faculty","admin"), async (req,res)=>{
    const classId=id(req.params.id); if(!classId)return res.status(400).json({success:false,message:"Invalid Live Class"});
    try {
        await db.query(`UPDATE live_class_attendance SET left_at=NOW(),attendance_minutes=GREATEST(0,TIMESTAMPDIFF(MINUTE,joined_at,NOW())) WHERE live_class_id=? AND user_id=?`,[classId,req.user.userId]);
        res.json({success:true,message:"Attendance session closed"});
    } catch(e){console.error(e);res.status(500).json({success:false,message:"Unable to close attendance"});}
});

module.exports=router;
