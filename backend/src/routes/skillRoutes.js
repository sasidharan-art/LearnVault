const express = require("express");
const db = require("../config/db");
const authenticateUser = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");
const router = express.Router();

const clean = (v) => String(v || "").trim();
const num = (v) => Number(v || 0);

async function getStudentProfile(userId) {
    const [rows] = await db.query(`
        SELECT sp.user_id,sp.course_id,sp.course_level_id,c.course_code,c.course_name,
               cl.level_name,d.department_name,ed.domain_name
        FROM student_profiles sp
        JOIN courses c ON c.id=sp.course_id
        LEFT JOIN course_levels cl ON cl.id=sp.course_level_id
        LEFT JOIN departments d ON d.id=c.department_id
        LEFT JOIN education_domains ed ON ed.id=c.domain_id
        WHERE sp.user_id=? AND c.is_active=1 LIMIT 1`, [userId]);
    return rows[0] || null;
}

function levelClause(profile, alias="s") {
    return profile.course_level_id
        ? {sql:` AND (${alias}.course_level_id IS NULL OR ${alias}.course_level_id=?)`, vals:[profile.course_level_id]}
        : {sql:` AND ${alias}.course_level_id IS NULL`, vals:[]};
}


async function facultyCanUseSubject(facultyUserId, subjectId) {
    const [rows] = await db.query(`
        SELECT s.id
        FROM faculty_subject_assignments fsa
        JOIN subjects s ON s.id=fsa.subject_id
        JOIN courses c ON c.id=s.course_id
        WHERE fsa.faculty_user_id=?
          AND fsa.subject_id=?
          AND fsa.is_active=1
          AND s.is_active=1
          AND c.is_active=1
        LIMIT 1`,
        [facultyUserId,subjectId]
    );
    return rows.length > 0;
}

router.get("/student", authenticateUser, authorizeRoles("student"), async (req,res)=>{
    try {
        const profile = await getStudentProfile(req.user.userId);
        if(!profile) return res.status(400).json({success:false,message:"Your student course profile is not configured"});
        const level=levelClause(profile);
        const [skills]=await db.query(`
            SELECT sk.id,sk.skill_name,sk.description,sk.skill_level,
                   s.id subject_id,s.subject_code,s.subject_name,
                   COALESCE(ssp.progress_percent,0) progress_percent,
                   COALESCE(ssp.status,'not_started') progress_status
            FROM skills sk
            JOIN subjects s ON s.id=sk.subject_id
            JOIN courses c ON c.id=s.course_id
            LEFT JOIN student_skill_progress ssp ON ssp.skill_id=sk.id AND ssp.student_user_id=?
            WHERE sk.is_active=1 AND s.is_active=1 AND c.is_active=1 AND s.course_id=? ${level.sql}
            ORDER BY s.subject_name,FIELD(sk.skill_level,'foundational','intermediate','advanced'),sk.skill_name`,
            [req.user.userId,profile.course_id,...level.vals]);
        const total=skills.length, completed=skills.filter(x=>x.progress_status==='completed').length,
              inProgress=skills.filter(x=>x.progress_status==='in_progress').length,
              average=total?Math.round(skills.reduce((a,x)=>a+num(x.progress_percent),0)/total):0;
        res.json({success:true,profile:{courseName:profile.course_name,levelName:profile.level_name,domainName:profile.domain_name},
            overview:{totalSkills:total,completedSkills:completed,inProgressSkills:inProgress,averageProgress:average},skills});
    } catch(e){console.error(e);res.status(500).json({success:false,message:"Unable to load Skills"});}
});

router.patch("/student/:id/progress", authenticateUser, authorizeRoles("student"), async (req,res)=>{
    const id=Number(req.params.id), progress=Number(req.body.progressPercent);
    if(!Number.isInteger(id)||id<=0||!Number.isInteger(progress)||progress<0||progress>100)
        return res.status(400).json({success:false,message:"Progress must be between 0 and 100"});
    try {
        const profile=await getStudentProfile(req.user.userId);
        if(!profile) return res.status(400).json({success:false,message:"Your student course profile is not configured"});
        const level=levelClause(profile);
        const [rows]=await db.query(`SELECT sk.id FROM skills sk JOIN subjects s ON s.id=sk.subject_id JOIN courses c ON c.id=s.course_id
            WHERE sk.id=? AND sk.is_active=1 AND s.is_active=1 AND c.is_active=1 AND s.course_id=? ${level.sql} LIMIT 1`,
            [id,profile.course_id,...level.vals]);
        if(!rows.length) return res.status(403).json({success:false,message:"This skill is not part of your current course"});
        const status=progress===0?'not_started':progress===100?'completed':'in_progress';
        await db.query(`INSERT INTO student_skill_progress(student_user_id,skill_id,progress_percent,status) VALUES(?,?,?,?)
            ON DUPLICATE KEY UPDATE progress_percent=VALUES(progress_percent),status=VALUES(status)`,
            [req.user.userId,id,progress,status]);
        res.json({success:true,message:"Skill progress updated",progressPercent:progress,status});
    } catch(e){console.error(e);res.status(500).json({success:false,message:"Unable to update skill progress"});}
});

router.get("/faculty", authenticateUser, authorizeRoles("faculty"), async (req,res)=>{
    try {
        const [subjects]=await db.query(`SELECT s.id,s.subject_code,s.subject_name,c.course_name
            FROM faculty_subject_assignments fsa JOIN subjects s ON s.id=fsa.subject_id JOIN courses c ON c.id=s.course_id
            WHERE fsa.faculty_user_id=? AND fsa.is_active=1 AND s.is_active=1 AND c.is_active=1 ORDER BY c.course_name,s.subject_name`,[req.user.userId]);
        const ids=subjects.map(x=>x.id);
        if(!ids.length) return res.json({success:true,overview:{assignedSubjects:0,totalSkills:0,averageStudentProgress:0,completedStudentSkills:0},subjects:[],skills:[]});
        const ph=ids.map(()=>'?').join(',');
        const [skills]=await db.query(`SELECT sk.id,sk.skill_name,sk.description,sk.skill_level,sk.is_active,s.id subject_id,s.subject_code,s.subject_name,c.course_name,
            COUNT(DISTINCT sp.user_id) eligible_students,COALESCE(AVG(ssp.progress_percent),0) average_progress,
            SUM(CASE WHEN ssp.status='completed' THEN 1 ELSE 0 END) completed_students
            FROM skills sk JOIN subjects s ON s.id=sk.subject_id JOIN courses c ON c.id=s.course_id
            LEFT JOIN student_profiles sp ON sp.course_id=s.course_id AND (s.course_level_id IS NULL OR sp.course_level_id=s.course_level_id)
            LEFT JOIN student_skill_progress ssp ON ssp.skill_id=sk.id AND ssp.student_user_id=sp.user_id
            WHERE sk.subject_id IN (${ph})
            GROUP BY sk.id,sk.skill_name,sk.description,sk.skill_level,sk.is_active,s.id,s.subject_code,s.subject_name,c.course_name
            ORDER BY s.subject_name,sk.skill_name`,ids);
        const avg=skills.length?Math.round(skills.reduce((a,x)=>a+num(x.average_progress),0)/skills.length):0;
        res.json({success:true,overview:{assignedSubjects:subjects.length,totalSkills:skills.length,averageStudentProgress:avg,
            completedStudentSkills:skills.reduce((a,x)=>a+num(x.completed_students),0)},subjects,skills});
    } catch(e){console.error(e);res.status(500).json({success:false,message:"Unable to load Faculty Skills"});}
});



router.post("/faculty", authenticateUser, authorizeRoles("faculty"), async (req,res)=>{
    const subjectId=Number(req.body.subjectId),
          name=clean(req.body.skillName),
          description=clean(req.body.description),
          level=clean(req.body.skillLevel).toLowerCase();

    if(!Number.isInteger(subjectId)||subjectId<=0||!name||!["foundational","intermediate","advanced"].includes(level))
        return res.status(400).json({success:false,message:"Assigned Subject, skill name and valid skill level are required"});

    try {
        if(!(await facultyCanUseSubject(req.user.userId,subjectId)))
            return res.status(403).json({success:false,message:"You can create skills only for assigned subjects"});

        const [r]=await db.query(
            `INSERT INTO skills(subject_id,skill_name,description,skill_level,created_by,is_active)
             VALUES(?,?,?,?,?,1)`,
            [subjectId,name,description||null,level,req.user.userId]
        );

        res.status(201).json({success:true,message:"Skill published for this subject",skillId:r.insertId});
    } catch(e) {
        if(e.code==='ER_DUP_ENTRY')
            return res.status(409).json({success:false,message:"This skill already exists for the selected subject"});
        console.error(e);
        res.status(500).json({success:false,message:"Unable to create skill"});
    }
});


router.patch("/faculty/:id/status", authenticateUser, authorizeRoles("faculty"), async (req,res)=>{
    const id=Number(req.params.id),
          active=req.body.isActive===true||req.body.isActive===1||req.body.isActive==='1';

    if(!Number.isInteger(id)||id<=0)
        return res.status(400).json({success:false,message:"Invalid skill"});

    try {
        const [rows]=await db.query(`SELECT id,subject_id FROM skills WHERE id=? LIMIT 1`,[id]);

        if(!rows.length)
            return res.status(404).json({success:false,message:"Skill not found"});

        if(!(await facultyCanUseSubject(req.user.userId,rows[0].subject_id)))
            return res.status(403).json({success:false,message:"You cannot manage this skill"});

        await db.query(`UPDATE skills SET is_active=? WHERE id=?`,[active?1:0,id]);

        res.json({success:true,message:active?"Skill published":"Skill hidden"});
    } catch(e) {
        console.error(e);
        res.status(500).json({success:false,message:"Unable to update skill"});
    }
});


router.get("/admin", authenticateUser, authorizeRoles("admin"), async (req,res)=>{
    try {
        const [subjects]=await db.query(`SELECT s.id,s.subject_code,s.subject_name,c.course_name FROM subjects s JOIN courses c ON c.id=s.course_id
            WHERE s.is_active=1 AND c.is_active=1 ORDER BY c.course_name,s.subject_name`);
        const [skills]=await db.query(`SELECT sk.id,sk.skill_name,sk.description,sk.skill_level,sk.is_active,sk.created_at,s.id subject_id,s.subject_code,s.subject_name,c.course_name,
            u.full_name creator_name,COUNT(DISTINCT sp.user_id) eligible_students,COALESCE(AVG(ssp.progress_percent),0) average_progress,
            SUM(CASE WHEN ssp.status='completed' THEN 1 ELSE 0 END) completed_students
            FROM skills sk JOIN subjects s ON s.id=sk.subject_id JOIN courses c ON c.id=s.course_id JOIN users u ON u.id=sk.created_by
            LEFT JOIN student_profiles sp ON sp.course_id=s.course_id AND (s.course_level_id IS NULL OR sp.course_level_id=s.course_level_id)
            LEFT JOIN student_skill_progress ssp ON ssp.skill_id=sk.id AND ssp.student_user_id=sp.user_id
            GROUP BY sk.id,sk.skill_name,sk.description,sk.skill_level,sk.is_active,sk.created_at,s.id,s.subject_code,s.subject_name,c.course_name,u.full_name
            ORDER BY sk.is_active DESC,c.course_name,s.subject_name,sk.skill_name`);
        res.json({success:true,subjects,skills});
    } catch(e){console.error(e);res.status(500).json({success:false,message:"Unable to load Skills"});}
});

router.post("/admin", authenticateUser, authorizeRoles("admin"), async (req,res)=>{
    const subjectId=Number(req.body.subjectId),name=clean(req.body.skillName),description=clean(req.body.description),level=clean(req.body.skillLevel).toLowerCase();
    if(!Number.isInteger(subjectId)||subjectId<=0||!name||!["foundational","intermediate","advanced"].includes(level))
        return res.status(400).json({success:false,message:"Subject, skill name and valid skill level are required"});
    try {
        const [r]=await db.query(`INSERT INTO skills(subject_id,skill_name,description,skill_level,created_by,is_active) VALUES(?,?,?,?,?,1)`,
            [subjectId,name,description||null,level,req.user.userId]);
        res.status(201).json({success:true,message:"Skill created successfully",skillId:r.insertId});
    } catch(e){if(e.code==='ER_DUP_ENTRY')return res.status(409).json({success:false,message:"This skill already exists for the selected subject"});
        console.error(e);res.status(500).json({success:false,message:"Unable to create skill"});}
});

router.patch("/admin/:id/status", authenticateUser, authorizeRoles("admin"), async (req,res)=>{
    const id=Number(req.params.id),active=req.body.isActive===true||req.body.isActive===1||req.body.isActive==='1';
    if(!Number.isInteger(id)||id<=0)return res.status(400).json({success:false,message:"Invalid skill"});
    try{const [r]=await db.query(`UPDATE skills SET is_active=? WHERE id=?`,[active?1:0,id]);
        if(!r.affectedRows)return res.status(404).json({success:false,message:"Skill not found"});
        res.json({success:true,message:active?"Skill activated":"Skill deactivated"});
    }catch(e){console.error(e);res.status(500).json({success:false,message:"Unable to update skill"});}
});

module.exports = router;
