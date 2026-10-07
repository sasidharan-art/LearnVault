const express = require("express");
const db = require("../config/db");
const authenticateUser = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");
const router = express.Router();
const clean=v=>String(v??"").trim(); const id=v=>Number.isInteger(Number(v))&&Number(v)>0?Number(v):null;

async function profile(userId){const [[p]]=await db.query(`SELECT sp.course_id,sp.course_level_id FROM student_profiles sp WHERE sp.user_id=? LIMIT 1`,[userId]);return p||null;}
async function facultySubjectAllowed(userId,subjectId){if(!subjectId)return true;const [r]=await db.query(`SELECT 1 FROM faculty_subject_assignments WHERE faculty_user_id=? AND subject_id=? AND is_active=1 LIMIT 1`,[userId,subjectId]);return r.length>0;}

router.get("/",authenticateUser,authorizeRoles("student","faculty","admin"),async(req,res)=>{
 try{
   let sql=`SELECT ec.*,s.subject_code,s.subject_name,c.course_name,cl.level_name,u.full_name creator_name,
      (SELECT COUNT(*) FROM education_challenge_submissions ecs WHERE ecs.challenge_id=ec.id) submission_count`;
   if(req.user.role==='student'){
     const p=await profile(req.user.userId); if(!p)return res.json({success:true,challenges:[]});
     sql+=` FROM education_challenges ec LEFT JOIN subjects s ON s.id=ec.subject_id LEFT JOIN courses c ON c.id=ec.course_id LEFT JOIN course_levels cl ON cl.id=ec.course_level_id LEFT JOIN users u ON u.id=ec.created_by
       WHERE ec.status='published' AND (ec.course_id IS NULL OR ec.course_id=?) AND (ec.course_level_id IS NULL OR ec.course_level_id=?) ORDER BY ec.created_at DESC`;
     const [rows]=await db.query(sql,[p.course_id,p.course_level_id]);
     const ids=rows.map(x=>x.id); let subs=[]; if(ids.length){const [s]=await db.query(`SELECT challenge_id,status,score,faculty_feedback FROM education_challenge_submissions WHERE student_user_id=? AND challenge_id IN (${ids.map(()=>'?').join(',')})`,[req.user.userId,...ids]);subs=s;}
     const map=new Map(subs.map(x=>[Number(x.challenge_id),x])); return res.json({success:true,challenges:rows.map(x=>({...x,submission:map.get(Number(x.id))||null}))});
   }
   if(req.user.role==='faculty'){
     const [subjects]=await db.query(`SELECT subject_id FROM faculty_subject_assignments WHERE faculty_user_id=? AND is_active=1`,[req.user.userId]);
     const ids=subjects.map(x=>x.subject_id); if(!ids.length)return res.json({success:true,challenges:[]});
     sql+=` FROM education_challenges ec LEFT JOIN subjects s ON s.id=ec.subject_id LEFT JOIN courses c ON c.id=ec.course_id LEFT JOIN course_levels cl ON cl.id=ec.course_level_id LEFT JOIN users u ON u.id=ec.created_by WHERE (ec.created_by=? OR ec.subject_id IN (${ids.map(()=>'?').join(',')})) ORDER BY ec.created_at DESC`;
     const [rows]=await db.query(sql,[req.user.userId,...ids]); return res.json({success:true,challenges:rows});
   }
   sql+=` FROM education_challenges ec LEFT JOIN subjects s ON s.id=ec.subject_id LEFT JOIN courses c ON c.id=ec.course_id LEFT JOIN course_levels cl ON cl.id=ec.course_level_id LEFT JOIN users u ON u.id=ec.created_by ORDER BY ec.created_at DESC`;
   const [rows]=await db.query(sql); res.json({success:true,challenges:rows});
 }catch(e){console.error(e);res.status(500).json({success:false,message:"Unable to load Education Challenges"});}
});

router.post("/",authenticateUser,authorizeRoles("faculty","admin"),async(req,res)=>{
 const subjectId=id(req.body.subjectId),courseId=id(req.body.courseId),levelId=id(req.body.courseLevelId); const title=clean(req.body.title),domain=clean(req.body.domain),problem=clean(req.body.problemStatement),context=clean(req.body.realWorldContext),outcome=clean(req.body.expectedOutcome),skills=clean(req.body.skills),difficulty=clean(req.body.difficulty).toLowerCase(),guidance=clean(req.body.solutionGuidance);
 if(!title||!domain||!problem||!context)return res.status(400).json({success:false,message:"Title, domain, problem and real-world context are required"});
 if(!['beginner','intermediate','advanced'].includes(difficulty))return res.status(400).json({success:false,message:"Invalid difficulty"});
 try{if(req.user.role==='faculty'&&!(await facultySubjectAllowed(req.user.userId,subjectId)))return res.status(403).json({success:false,message:"You can create challenges only for assigned subjects"});
   const [r]=await db.query(`INSERT INTO education_challenges(created_by,subject_id,course_id,course_level_id,title,domain,problem_statement,real_world_context,impact_analysis,expected_outcome,learning_outcomes,skills,difficulty,solution_guidance,status) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'published')`,[req.user.userId,subjectId,courseId,levelId,title,domain,problem,context,impact||null,outcome||null,outcomes||null,skills||null,difficulty,guidance||null]);
   res.status(201).json({success:true,message:"Education Challenge published",challengeId:r.insertId});
 }catch(e){console.error(e);res.status(500).json({success:false,message:"Unable to create Education Challenge"});}
});

router.post("/:id/submit",authenticateUser,authorizeRoles("student"),async(req,res)=>{const challengeId=id(req.params.id),solution=clean(req.body.solution);if(!challengeId||!solution)return res.status(400).json({success:false,message:"Write your solution before submitting"});try{const [c]=await db.query(`SELECT id FROM education_challenges WHERE id=? AND status='published' LIMIT 1`,[challengeId]);if(!c.length)return res.status(404).json({success:false,message:"Challenge not found"});await db.query(`INSERT INTO education_challenge_submissions(challenge_id,student_user_id,solution_text,status,submitted_at) VALUES(?,?,?,'submitted',NOW()) ON DUPLICATE KEY UPDATE solution_text=VALUES(solution_text),status='submitted',faculty_feedback=NULL,score=NULL,reviewed_at=NULL,reviewed_by=NULL,submitted_at=NOW()`,[challengeId,req.user.userId,solution]);res.json({success:true,message:"Solution submitted for faculty review"});}catch(e){console.error(e);res.status(500).json({success:false,message:"Unable to submit solution"});}});

router.get("/submissions",authenticateUser,authorizeRoles("faculty","admin"),async(req,res)=>{try{let q=`SELECT ecs.*,ec.title,ec.domain,u.full_name student_name,c.course_name,cl.level_name FROM education_challenge_submissions ecs JOIN education_challenges ec ON ec.id=ecs.challenge_id JOIN users u ON u.id=ecs.student_user_id LEFT JOIN student_profiles sp ON sp.user_id=u.id LEFT JOIN courses c ON c.id=sp.course_id LEFT JOIN course_levels cl ON cl.id=sp.course_level_id`;
 if(req.user.role==='faculty')q+=` WHERE ec.created_by=? OR ec.subject_id IN (SELECT subject_id FROM faculty_subject_assignments WHERE faculty_user_id=? AND is_active=1)`;q+=` ORDER BY ecs.submitted_at DESC LIMIT 300`;const [rows]=await db.query(q,req.user.role==='faculty'?[req.user.userId,req.user.userId]:[]);res.json({success:true,submissions:rows});}catch(e){console.error(e);res.status(500).json({success:false,message:"Unable to load submissions"});}});

router.patch("/submissions/:id/review",authenticateUser,authorizeRoles("faculty","admin"),async(req,res)=>{const submissionId=id(req.params.id),score=req.body.score===''||req.body.score==null?null:Number(req.body.score),feedback=clean(req.body.feedback),improvement=clean(req.body.improvementSuggestions),status=clean(req.body.status).toLowerCase();if(!submissionId||!['reviewed','needs_revision'].includes(status)||(score!==null&&(Number.isNaN(score)||score<0||score>100)))return res.status(400).json({success:false,message:"Valid review status and score are required"});try{const [r]=await db.query(`UPDATE education_challenge_submissions ecs JOIN education_challenges ec ON ec.id=ecs.challenge_id SET ecs.status=?,ecs.score=?,ecs.faculty_feedback=?,ecs.improvement_suggestions=?,ecs.reviewed_at=NOW(),ecs.reviewed_by=? WHERE ecs.id=? AND (?='admin' OR ec.created_by=? OR ec.subject_id IN (SELECT subject_id FROM faculty_subject_assignments WHERE faculty_user_id=? AND is_active=1))`,[status,score,feedback||null,improvement||null,req.user.userId,submissionId,req.user.role,req.user.userId,req.user.userId]);if(!r.affectedRows)return res.status(404).json({success:false,message:"Submission not found or access denied"});res.json({success:true,message:"Solution review saved"});}catch(e){console.error(e);res.status(500).json({success:false,message:"Unable to review solution"});}});

module.exports=router;
