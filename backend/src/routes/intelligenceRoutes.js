const express = require("express");
const db = require("../config/db");
const authenticateUser = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

const router = express.Router();
const n = v => Number.isFinite(Number(v)) ? Number(v) : 0;
const r2 = v => Number(n(v).toFixed(2));
const pct = (a,b) => n(b) ? r2((n(a)/n(b))*100) : 0;

function riskBand(score){
    if(score >= 75) return "low";
    if(score >= 50) return "medium";
    return "high";
}

function riskLabel(band){
    return band === "high" ? "High Risk" : band === "medium" ? "Needs Attention" : "On Track";
}

async function safeOne(sql, params, fallback={}){ try { const [rows]=await db.query(sql,params); return rows[0]||fallback; } catch(error){ console.warn('Academic signal unavailable:', error.code || error.message); return fallback; } }
async function safeMany(sql, params){ try { const [rows]=await db.query(sql,params); return rows; } catch(error){ console.warn('Academic dataset unavailable:', error.code || error.message); return []; } }

async function studentSignals(userId){
    const attendance=await safeOne(`SELECT COUNT(ar.id) total, SUM(ar.attendance_status='present') present_count, SUM(ar.attendance_status='late') late_count, ROUND(100*SUM(ar.attendance_status='present')/NULLIF(COUNT(ar.id),0),2) attendance_rate FROM attendance_records ar INNER JOIN attendance_sessions ats ON ats.id=ar.session_id WHERE ar.student_user_id=? AND ats.status<>'cancelled'`,[userId]);
    const quiz=await safeOne(`SELECT COALESCE(AVG(percentage),0) average,COUNT(*) attempts FROM quiz_attempts WHERE student_user_id=? AND status='submitted'`,[userId]);
    const assign=await safeOne(`SELECT COUNT(DISTINCT a.id) total, COUNT(DISTINCT CASE WHEN s.status IN ('submitted','graded') THEN a.id END) completed FROM assignments a INNER JOIN subjects asub ON asub.id=a.subject_id INNER JOIN student_profiles sp ON sp.user_id=? AND sp.course_id=asub.course_id LEFT JOIN assignment_submissions s ON s.assignment_id=a.id AND s.student_user_id=? WHERE a.status='published'`,[userId,userId]);
    const events=await safeOne(`SELECT COUNT(*) count FROM learning_events WHERE user_id=? AND created_at>=DATE_SUB(NOW(),INTERVAL 30 DAY)`,[userId]);
    const skills=await safeOne(`SELECT COUNT(*) total, SUM(status='completed') completed FROM student_skill_progress WHERE student_user_id=?`,[userId]);
    const live=await safeOne(`SELECT COUNT(DISTINCT live_class_id) classes_joined, COALESCE(SUM(attendance_minutes),0) minutes, COALESCE(AVG(attendance_minutes),0) avg_minutes FROM live_class_attendance WHERE user_id=?`,[userId]);
    const attendanceRate=n(attendance.attendance_rate), quizAverage=n(quiz.average), assignmentCompletion=pct(assign.completed,assign.total), engagement=Math.min(100,r2(n(events.count)*2)), skillProgress=pct(skills.completed,skills.total), liveParticipation=Math.min(100,r2((n(live.minutes)/Math.max(1,n(live.classes_joined)*45))*100));
    const score=r2((attendanceRate*0.25)+(quizAverage*0.25)+(assignmentCompletion*0.20)+(engagement*0.10)+(skillProgress*0.10)+(liveParticipation*0.10));
    const band=riskBand(score), alerts=[], recommendations=[];
    if(attendanceRate < 75) alerts.push({type:'attendance',severity:'high',message:`Attendance is ${attendanceRate}%. Review attendance before the next academic checkpoint.`});
    if(quizAverage < 60 && n(quiz.attempts)>0) alerts.push({type:'performance',severity:'high',message:`Quiz average is ${quizAverage}%. Target weak topics with guided practice.`});
    if(assignmentCompletion < 70 && n(assign.total)>0) alerts.push({type:'assignment',severity:'medium',message:`Assignment completion is ${assignmentCompletion}%. Complete pending work.`});
    if(engagement < 25) alerts.push({type:'engagement',severity:'medium',message:'Learning activity is low. Use the Study Hub and recommended resources.'});
    if(attendanceRate < 80) recommendations.push('Attend upcoming sessions consistently and review missed topics.');
    if(quizAverage < 70) recommendations.push('Practice weak quiz topics using the Question Bank and targeted quizzes.');
    if(assignmentCompletion < 85) recommendations.push('Prioritize pending assignments before starting optional work.');
    if(engagement < 40) recommendations.push('Follow the personalized Study Hub plan for 20–30 minutes daily.');
    if(!recommendations.length) recommendations.push('Maintain your current learning rhythm and build career-ready skills.');
    return {score,band,label:riskLabel(band),attendanceRate,quizAverage,assignmentCompletion,engagement,skillProgress,liveParticipation,liveClasses:n(live.classes_joined),liveMinutes:n(live.minutes),attempts:n(quiz.attempts),events30d:n(events.count),alerts,recommendations};
}

router.get("/student",authenticateUser,authorizeRoles("student"),async(req,res)=>{
    try{
        const signals=await studentSignals(req.user.userId);
        const profile=await db.query(`SELECT c.course_name,ed.domain_name,d.department_name,cl.level_name FROM student_profiles sp INNER JOIN courses c ON c.id=sp.course_id LEFT JOIN education_domains ed ON ed.id=c.domain_id LEFT JOIN departments d ON d.id=c.department_id LEFT JOIN course_levels cl ON cl.id=sp.course_level_id WHERE sp.user_id=? LIMIT 1`,[req.user.userId]);
        res.json({success:true,signals,profile:profile[0][0]||null,innovation:{name:"Explainable Early Intervention Engine",formula:"Attendance 25% + Quiz 25% + Assignments 20% + Engagement 10% + Skills 10% + Live participation 10%"}});
    }catch(error){console.error("Student intelligence error:",error);res.status(500).json({success:false,message:"Unable to load Academic Intelligence"});}
});

async function buildRiskRows(limit=100, facultyUserId=null){
    const params=[]; let scope="";
    if(facultyUserId){
        scope=`AND EXISTS (SELECT 1 FROM faculty_subject_assignments fsa INNER JOIN subjects fs ON fs.id=fsa.subject_id WHERE fsa.faculty_user_id=? AND fsa.is_active=1 AND fs.course_id=sp.course_id)`;
        params.push(facultyUserId);
    }
    const students=await safeMany(`SELECT u.id,u.full_name,u.username,c.course_name,ed.domain_name,d.department_name FROM users u INNER JOIN student_profiles sp ON sp.user_id=u.id INNER JOIN courses c ON c.id=sp.course_id LEFT JOIN education_domains ed ON ed.id=c.domain_id LEFT JOIN departments d ON d.id=c.department_id WHERE u.role_id=(SELECT id FROM roles WHERE role_name='student' LIMIT 1) AND u.status='active' ${scope} ORDER BY u.full_name LIMIT ${Number(limit)}`,params);
    const rows=[];
    for(const s of students){ const signals=await studentSignals(s.id); rows.push({...s, ...signals}); }
    return rows.sort((a,b)=>a.score-b.score);
}

router.get("/faculty/risk",authenticateUser,authorizeRoles("faculty"),async(req,res)=>{
    try{ const students=await buildRiskRows(100,req.user.userId); res.json({success:true,students}); }
    catch(error){console.error(error);res.status(500).json({success:false,message:"Unable to load at-risk learners"});}
});

router.get("/admin/overview",authenticateUser,authorizeRoles("admin"),async(req,res)=>{
    try{
        const students=await buildRiskRows(500,null);
        const active=students.filter(s=>s.band==='low').length;
        const medium=students.filter(s=>s.band==='medium').length;
        const high=students.filter(s=>s.band==='high').length;
        const avg=students.length?r2(students.reduce((a,s)=>a+s.score,0)/students.length):0;
        const attendance=students.length?r2(students.reduce((a,s)=>a+s.attendanceRate,0)/students.length):0;
        const quiz=students.length?r2(students.reduce((a,s)=>a+s.quizAverage,0)/students.length):0;
        const assignment=students.length?r2(students.reduce((a,s)=>a+s.assignmentCompletion,0)/students.length):0;
        res.json({success:true,overview:{studentCount:students.length,onTrack:active,needsAttention:medium,highRisk:high,averageSuccessScore:avg,averageAttendance:attendance,averageQuiz:quiz,averageAssignmentCompletion:assignment,graduationReadiness:r2((avg+attendance+assignment)/3)},atRisk:students.filter(s=>s.band!=='low').slice(0,25),innovation:{name:"Explainable Early Intervention Engine",measurableSignals:["attendance_rate","quiz_average","assignment_completion_rate","learning_events","skill_progress","live_class_participation"]}});
    }catch(error){console.error(error);res.status(500).json({success:false,message:"Unable to load institutional intelligence"});}
});

router.post("/interventions",authenticateUser,authorizeRoles("faculty","admin"),async(req,res)=>{
    try{
        const studentUserId=Number(req.body.studentUserId); const score=n(req.body.riskScore); const level=riskBand(score); const reason=String(req.body.reason||"Early intervention recommended based on academic signals.").slice(0,500); const action=String(req.body.action||"Faculty mentoring and targeted learning support.").slice(0,500);
        if(!Number.isInteger(studentUserId)) return res.status(400).json({success:false,message:"Valid student is required"});
        const [result]=await db.query(`INSERT INTO academic_interventions(student_user_id,risk_score,risk_level,trigger_reason,recommended_action) VALUES(?,?,?,?,?)`,[studentUserId,score,level,reason,action]);
        res.status(201).json({success:true,id:result.insertId,message:"Intervention recorded"});
    }catch(error){console.error(error);res.status(500).json({success:false,message:"Unable to record intervention"});}
});

module.exports=router;
