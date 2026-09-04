const express = require("express");
const db = require("../config/db");
const authenticateUser = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");
const router = express.Router();

const n = (v) => Number.isFinite(Number(v)) ? Number(v) : 0;
const r2 = (v) => Number(n(v).toFixed(2));
const pct = (a,b) => n(b) ? r2((n(a)/n(b))*100) : 0;
const level = (v) => n(v) >= 75 ? "strong" : n(v) >= 60 ? "developing" : "needs_focus";
const label = (v) => level(v) === "strong" ? "Strong" : level(v) === "developing" ? "Developing" : "Needs Focus";

async function studentProfile(userId){
    const [rows]=await db.query(`
        SELECT sp.user_id,sp.course_id,sp.course_level_id,
               c.course_code,c.course_name,cl.level_name,
               d.department_name,ed.domain_name
        FROM student_profiles sp
        JOIN courses c ON c.id=sp.course_id
        LEFT JOIN course_levels cl ON cl.id=sp.course_level_id
        LEFT JOIN departments d ON d.id=c.department_id
        LEFT JOIN education_domains ed ON ed.id=c.domain_id
        WHERE sp.user_id=? AND c.is_active=1 LIMIT 1`,[userId]);
    return rows[0]||null;
}
function levelClause(profile,alias="s"){
    return profile.course_level_id
      ? {sql:`AND (${alias}.course_level_id IS NULL OR ${alias}.course_level_id=?)`,values:[profile.course_level_id]}
      : {sql:`AND ${alias}.course_level_id IS NULL`,values:[]};
}
function mergeSubjects(base,attempts,answers){
    const am=new Map(attempts.map(x=>[String(x.subject_id),x]));
    const qm=new Map(answers.map(x=>[String(x.subject_id),x]));
    return base.map(s=>{
        const a=am.get(String(s.id))||{}, q=qm.get(String(s.id))||{};
        const ac=n(a.attempts), answered=n(q.answered_questions), correct=n(q.correct_answers);
        const avg=r2(a.average_percentage), accuracy=pct(correct,answered);
        let mastery=0;
        if(ac&&answered) mastery=r2((avg+accuracy)/2); else if(ac) mastery=avg; else if(answered) mastery=accuracy;
        return {subjectId:s.id,subjectCode:s.subject_code,subjectName:s.subject_name,courseName:s.course_name,levelName:s.level_name,
          attempts:ac,quizzesAttempted:n(a.quizzes_attempted),averageScore:avg,bestScore:r2(a.best_percentage),
          passedAttempts:n(a.passed_attempts),passRate:pct(a.passed_attempts,ac),answeredQuestions:answered,correctAnswers:correct,
          answerAccuracy:accuracy,masteryScore:mastery,masteryLevel:(ac||answered)?level(mastery):"no_data",masteryLabel:(ac||answered)?label(mastery):"No Activity"};
    });
}

async function studentSubjects(userId,profile){
    const lv=levelClause(profile,"s");
    const [base]=await db.query(`SELECT s.id,s.subject_code,s.subject_name,c.course_name,cl.level_name
      FROM subjects s JOIN courses c ON c.id=s.course_id LEFT JOIN course_levels cl ON cl.id=s.course_level_id
      WHERE s.course_id=? AND s.is_active=1 AND c.is_active=1 ${lv.sql} ORDER BY s.subject_name`,[profile.course_id,...lv.values]);
    const [attempts]=await db.query(`SELECT s.id subject_id,COUNT(qa.id) attempts,COUNT(DISTINCT qa.quiz_id) quizzes_attempted,
      AVG(qa.percentage) average_percentage,MAX(qa.percentage) best_percentage,
      SUM(CASE WHEN qa.percentage>=q.pass_percentage THEN 1 ELSE 0 END) passed_attempts
      FROM subjects s LEFT JOIN quizzes q ON q.subject_id=s.id
      LEFT JOIN quiz_attempts qa ON qa.quiz_id=q.id AND qa.student_user_id=? AND qa.status='submitted'
      WHERE s.course_id=? AND s.is_active=1 ${lv.sql} GROUP BY s.id`,[userId,profile.course_id,...lv.values]);
    const [answers]=await db.query(`SELECT qb.subject_id,COUNT(qaa.id) answered_questions,
      SUM(CASE WHEN qaa.is_correct=1 THEN 1 ELSE 0 END) correct_answers
      FROM quiz_attempt_answers qaa JOIN quiz_attempts qa ON qa.id=qaa.attempt_id AND qa.status='submitted'
      JOIN question_bank qb ON qb.id=qaa.question_id WHERE qa.student_user_id=? GROUP BY qb.subject_id`,[userId]);
    return mergeSubjects(base,attempts,answers);
}

router.get("/student",authenticateUser,authorizeRoles("student"),async(req,res)=>{
  try{
    const p=await studentProfile(req.user.userId); if(!p)return res.status(400).json({success:false,message:"Your student course profile is not configured"});
    const lv=levelClause(p,"s");
    const [[a]]=await db.query(`SELECT COUNT(qa.id) submitted_attempts,COUNT(DISTINCT qa.quiz_id) quizzes_attempted,
      AVG(qa.percentage) average_percentage,MAX(qa.percentage) best_percentage,
      SUM(CASE WHEN qa.percentage>=q.pass_percentage THEN 1 ELSE 0 END) passed_attempts
      FROM quiz_attempts qa JOIN quizzes q ON q.id=qa.quiz_id WHERE qa.student_user_id=? AND qa.status='submitted'`,[req.user.userId]);
    const [[ans]]=await db.query(`SELECT COUNT(qaa.id) answered_questions,SUM(CASE WHEN qaa.is_correct=1 THEN 1 ELSE 0 END) correct_answers
      FROM quiz_attempt_answers qaa JOIN quiz_attempts qa ON qa.id=qaa.attempt_id AND qa.status='submitted' WHERE qa.student_user_id=?`,[req.user.userId]);
    const [[av]]=await db.query(`SELECT COUNT(DISTINCT q.id) available_quizzes FROM quizzes q JOIN subjects s ON s.id=q.subject_id JOIN courses c ON c.id=s.course_id
      WHERE q.verification_status='approved' AND q.is_published=1 AND s.is_active=1 AND c.is_active=1 AND s.course_id=? ${lv.sql}`,[p.course_id,...lv.values]);
    const [recent]=await db.query(`SELECT qa.id attempt_id,qa.attempt_number,qa.score,qa.total_marks,qa.percentage,qa.submitted_at,
      q.id quiz_id,q.title,q.pass_percentage,s.id subject_id,s.subject_code,s.subject_name,su.unit_name
      FROM quiz_attempts qa JOIN quizzes q ON q.id=qa.quiz_id JOIN subjects s ON s.id=q.subject_id LEFT JOIN subject_units su ON su.id=q.unit_id
      WHERE qa.student_user_id=? AND qa.status='submitted' ORDER BY qa.submitted_at DESC,qa.id DESC LIMIT 10`,[req.user.userId]);
    const subjects=await studentSubjects(req.user.userId,p);
    const [unitsRaw]=await db.query(`SELECT s.id subject_id,s.subject_code,s.subject_name,su.id unit_id,su.unit_name,
      COUNT(qaa.id) answered_questions,SUM(CASE WHEN qaa.is_correct=1 THEN 1 ELSE 0 END) correct_answers
      FROM quiz_attempt_answers qaa JOIN quiz_attempts qa ON qa.id=qaa.attempt_id AND qa.status='submitted'
      JOIN question_bank qb ON qb.id=qaa.question_id JOIN subjects s ON s.id=qb.subject_id JOIN subject_units su ON su.id=qb.unit_id
      WHERE qa.student_user_id=? AND s.course_id=? ${lv.sql}
      GROUP BY s.id,s.subject_code,s.subject_name,su.id,su.unit_name ORDER BY s.subject_name,su.unit_order,su.unit_name`,[req.user.userId,p.course_id,...lv.values]);
    const units=unitsRaw.map(x=>{const answered=n(x.answered_questions),correct=n(x.correct_answers),accuracy=pct(correct,answered);return {subjectId:x.subject_id,subjectCode:x.subject_code,subjectName:x.subject_name,unitId:x.unit_id,unitName:x.unit_name,answeredQuestions:answered,correctAnswers:correct,accuracy,masteryLevel:level(accuracy)};});
    const weak=[];
    for(const s of subjects)if((s.attempts||s.answeredQuestions)&&s.masteryScore<65)weak.push({type:"subject",title:s.subjectName,context:s.subjectCode,score:s.masteryScore,level:s.masteryLevel,reason:`Average quiz ${s.averageScore}% • Accuracy ${s.answerAccuracy}%`});
    for(const u of units)if(u.answeredQuestions>=2&&u.accuracy<65)weak.push({type:"unit",title:u.unitName,context:`${u.subjectCode} — ${u.subjectName}`,score:u.accuracy,level:u.masteryLevel,reason:`${u.correctAnswers} correct of ${u.answeredQuestions} answers`});
    weak.sort((x,y)=>x.score-y.score);
    const submitted=n(a.submitted_attempts), attempted=n(a.quizzes_attempted), available=n(av.available_quizzes), answered=n(ans.answered_questions), correct=n(ans.correct_answers), avg=r2(a.average_percentage), accuracy=pct(correct,answered);
    const mastery=submitted&&answered?r2((avg+accuracy)/2):submitted?avg:answered?accuracy:0;
    const recentAttempts=recent.map(x=>({attemptId:x.attempt_id,attemptNumber:x.attempt_number,quizId:x.quiz_id,title:x.title,subjectId:x.subject_id,subjectCode:x.subject_code,subjectName:x.subject_name,unitName:x.unit_name,score:n(x.score),totalMarks:n(x.total_marks),percentage:r2(x.percentage),passPercentage:r2(x.pass_percentage),passed:n(x.percentage)>=n(x.pass_percentage),submittedAt:x.submitted_at}));
    res.json({success:true,profile:{courseId:p.course_id,courseCode:p.course_code,courseName:p.course_name,levelName:p.level_name,departmentName:p.department_name,domainName:p.domain_name},
      overview:{submittedAttempts:submitted,quizzesAttempted:attempted,availableQuizzes:available,averageScore:avg,bestScore:r2(a.best_percentage),passedAttempts:n(a.passed_attempts),passRate:pct(a.passed_attempts,submitted),answeredQuestions:answered,correctAnswers:correct,answerAccuracy:accuracy,completionRate:pct(attempted,available),overallMastery:mastery,masteryLevel:(submitted||answered)?level(mastery):"no_data",masteryLabel:(submitted||answered)?label(mastery):"Getting Started"},
      subjects,units,weakAreas:weak.slice(0,8),recentAttempts,trend:[...recentAttempts].reverse().map((x,i)=>({index:i+1,attemptId:x.attemptId,title:x.title,subjectCode:x.subjectCode,percentage:x.percentage,passed:x.passed,submittedAt:x.submittedAt}))});
  }catch(e){console.error("Student progress error:",e);res.status(500).json({success:false,message:"Unable to load learning progress"});}
});

async function assignedSubjectIds(facultyId){const [r]=await db.query(`SELECT s.id,s.subject_code,s.subject_name,c.course_name,cl.level_name
  FROM faculty_subject_assignments fsa JOIN subjects s ON s.id=fsa.subject_id JOIN courses c ON c.id=s.course_id LEFT JOIN course_levels cl ON cl.id=s.course_level_id
  WHERE fsa.faculty_user_id=? AND fsa.is_active=1 AND s.is_active=1 AND c.is_active=1 ORDER BY c.course_name,s.subject_name`,[facultyId]);return r;}
async function aggregateSubjects(base){
  if(!base.length)return [];
  const ids=base.map(x=>x.id), ph=ids.map(()=>"?").join(",");
  const [attempts]=await db.query(`SELECT q.subject_id,COUNT(qa.id) attempts,COUNT(DISTINCT qa.student_user_id) learners,COUNT(DISTINCT qa.quiz_id) quizzes_attempted,
    AVG(qa.percentage) average_percentage,MAX(qa.percentage) best_percentage,SUM(CASE WHEN qa.percentage>=q.pass_percentage THEN 1 ELSE 0 END) passed_attempts
    FROM quizzes q LEFT JOIN quiz_attempts qa ON qa.quiz_id=q.id AND qa.status='submitted' WHERE q.subject_id IN (${ph}) GROUP BY q.subject_id`,ids);
  const [answers]=await db.query(`SELECT qb.subject_id,COUNT(qaa.id) answered_questions,SUM(CASE WHEN qaa.is_correct=1 THEN 1 ELSE 0 END) correct_answers
    FROM quiz_attempt_answers qaa JOIN quiz_attempts qa ON qa.id=qaa.attempt_id AND qa.status='submitted' JOIN question_bank qb ON qb.id=qaa.question_id WHERE qb.subject_id IN (${ph}) GROUP BY qb.subject_id`,ids);
  const merged=mergeSubjects(base,attempts,answers), lm=new Map(attempts.map(x=>[String(x.subject_id),n(x.learners)])); merged.forEach(x=>x.activeLearners=lm.get(String(x.subjectId))||0); return merged;
}

router.get("/faculty",authenticateUser,authorizeRoles("faculty"),async(req,res)=>{
  try{
    const base=await assignedSubjectIds(req.user.userId); const subjects=await aggregateSubjects(base);
    const attempts=subjects.reduce((s,x)=>s+x.attempts,0), answered=subjects.reduce((s,x)=>s+x.answeredQuestions,0), correct=subjects.reduce((s,x)=>s+x.correctAnswers,0), passes=subjects.reduce((s,x)=>s+x.passedAttempts,0);
    const weightedScore=attempts?subjects.reduce((s,x)=>s+x.averageScore*x.attempts,0)/attempts:0;
    const learners=new Set();
    if(base.length){const ids=base.map(x=>x.id),ph=ids.map(()=>"?").join(",");const [lr]=await db.query(`SELECT DISTINCT qa.student_user_id FROM quiz_attempts qa JOIN quizzes q ON q.id=qa.quiz_id WHERE qa.status='submitted' AND q.subject_id IN (${ph})`,ids);lr.forEach(x=>learners.add(x.student_user_id));}
    const weakAreas=subjects.filter(x=>(x.attempts||x.answeredQuestions)&&x.masteryScore<65).sort((a,b)=>a.masteryScore-b.masteryScore).slice(0,8);
    res.json({success:true,overview:{assignedSubjects:base.length,activeLearners:learners.size,submittedAttempts:attempts,averageScore:r2(weightedScore),passRate:pct(passes,attempts),answeredQuestions:answered,correctAnswers:correct,answerAccuracy:pct(correct,answered)},subjects,weakAreas});
  }catch(e){console.error("Faculty progress error:",e);res.status(500).json({success:false,message:"Unable to load Faculty learning analytics"});}
});

router.get("/admin",authenticateUser,authorizeRoles("admin"),async(req,res)=>{
  try{
    const [[a]]=await db.query(`SELECT COUNT(qa.id) submitted_attempts,COUNT(DISTINCT qa.student_user_id) active_learners,COUNT(DISTINCT qa.quiz_id) quizzes_attempted,AVG(qa.percentage) average_percentage,SUM(CASE WHEN qa.percentage>=q.pass_percentage THEN 1 ELSE 0 END) passed_attempts FROM quiz_attempts qa JOIN quizzes q ON q.id=qa.quiz_id WHERE qa.status='submitted'`);
    const [[an]]=await db.query(`SELECT COUNT(qaa.id) answered_questions,SUM(CASE WHEN qaa.is_correct=1 THEN 1 ELSE 0 END) correct_answers FROM quiz_attempt_answers qaa JOIN quiz_attempts qa ON qa.id=qaa.attempt_id AND qa.status='submitted'`);
    const [base]=await db.query(`SELECT s.id,s.subject_code,s.subject_name,c.course_name,cl.level_name FROM subjects s JOIN courses c ON c.id=s.course_id LEFT JOIN course_levels cl ON cl.id=s.course_level_id WHERE s.is_active=1 AND c.is_active=1 ORDER BY c.course_name,s.subject_name`);
    const subjects=await aggregateSubjects(base);
    const weakSubjects=subjects.filter(x=>(x.attempts||x.answeredQuestions)&&x.masteryScore<65).sort((x,y)=>x.masteryScore-y.masteryScore).slice(0,10);
    const [courseRows]=await db.query(`SELECT c.id course_id,c.course_code,c.course_name,COUNT(qa.id) attempts,COUNT(DISTINCT qa.student_user_id) learners,AVG(qa.percentage) average_percentage,SUM(CASE WHEN qa.percentage>=q.pass_percentage THEN 1 ELSE 0 END) passed_attempts FROM courses c LEFT JOIN subjects s ON s.course_id=c.id LEFT JOIN quizzes q ON q.subject_id=s.id LEFT JOIN quiz_attempts qa ON qa.quiz_id=q.id AND qa.status='submitted' WHERE c.is_active=1 GROUP BY c.id,c.course_code,c.course_name ORDER BY c.course_name`);
    const attempts=n(a.submitted_attempts),answered=n(an.answered_questions),correct=n(an.correct_answers);
    res.json({success:true,overview:{activeLearners:n(a.active_learners),submittedAttempts:attempts,quizzesAttempted:n(a.quizzes_attempted),averageScore:r2(a.average_percentage),passRate:pct(a.passed_attempts,attempts),answeredQuestions:answered,correctAnswers:correct,answerAccuracy:pct(correct,answered),weakSubjectCount:weakSubjects.length},courses:courseRows.map(x=>({courseId:x.course_id,courseCode:x.course_code,courseName:x.course_name,attempts:n(x.attempts),learners:n(x.learners),averageScore:r2(x.average_percentage),passRate:pct(x.passed_attempts,x.attempts)})),subjects,weakSubjects});
  }catch(e){console.error("Admin progress error:",e);res.status(500).json({success:false,message:"Unable to load system learning analytics"});}
});

module.exports = router;
