const express = require("express");
const db = require("../config/db");
const authenticateUser = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

const router = express.Router();
const n = (v) => Number.isFinite(Number(v)) ? Number(v) : 0;
const r2 = (v) => Number(n(v).toFixed(2));
const pct = (a,b) => n(b) ? r2((n(a) / n(b)) * 100) : 0;

async function studentProfile(userId){
  const [rows] = await db.query(`
    SELECT sp.user_id,sp.course_id,sp.course_level_id,c.course_code,c.course_name,cl.level_name,
           d.department_name,ed.domain_name
    FROM student_profiles sp
    JOIN courses c ON c.id=sp.course_id
    LEFT JOIN course_levels cl ON cl.id=sp.course_level_id
    LEFT JOIN departments d ON d.id=c.department_id
    LEFT JOIN education_domains ed ON ed.id=c.domain_id
    WHERE sp.user_id=? LIMIT 1`, [userId]);
  return rows[0] || null;
}

function successBand(score){
  if(score >= 90) return "Excellent";
  if(score >= 75) return "Good";
  if(score >= 50) return "Average";
  return "Needs Attention";
}

function levelFromXp(xp){
  if(xp >= 5000) return {name:"Master Scholar", next:null, min:5000};
  if(xp >= 3000) return {name:"Expert", next:"Master Scholar", min:3000};
  if(xp >= 1800) return {name:"Advanced", next:"Expert", min:1800};
  if(xp >= 900) return {name:"Skilled", next:"Advanced", min:900};
  if(xp >= 300) return {name:"Learner", next:"Skilled", min:300};
  return {name:"Beginner", next:"Learner", min:0};
}

async function awardBadges(userId){
  const earned=[];
  const [[quiz]] = await db.query(`SELECT COUNT(*) count FROM quiz_attempts WHERE student_user_id=? AND status='submitted'`,[userId]);
  if(n(quiz.count)>=3){
    const [[b]] = await db.query(`SELECT id FROM gamification_badges WHERE badge_key='quiz_master'`);
    if(b) { const [r]=await db.query(`INSERT IGNORE INTO user_badges(user_id,badge_id) VALUES(?,?)`,[userId,b.id]); if(r.affectedRows) earned.push("Quiz Master"); }
  }
  const [[challenge]] = await db.query(`SELECT COUNT(*) count FROM education_challenge_submissions WHERE student_user_id=?`,[userId]);
  if(n(challenge.count)>=1){
    const [[b]] = await db.query(`SELECT id FROM gamification_badges WHERE badge_key='problem_solver'`);
    if(b) { const [r]=await db.query(`INSERT IGNORE INTO user_badges(user_id,badge_id) VALUES(?,?)`,[userId,b.id]); if(r.affectedRows) earned.push("Problem Solver"); }
  }
  const [[community]] = await db.query(`SELECT COUNT(*) count FROM community_participation WHERE user_id=?`,[userId]);
  if(n(community.count)>=1){
    const [[b]] = await db.query(`SELECT id FROM gamification_badges WHERE badge_key='community_contributor'`);
    if(b) { const [r]=await db.query(`INSERT IGNORE INTO user_badges(user_id,badge_id) VALUES(?,?)`,[userId,b.id]); if(r.affectedRows) earned.push("Community Contributor"); }
  }
  return earned;
}

router.get("/student", authenticateUser, authorizeRoles("student"), async (req,res)=>{
  try{
    const uid=req.user.userId;
    const profile=await studentProfile(uid);
    const [[quiz]] = await db.query(`SELECT COUNT(*) attempts,COALESCE(AVG(percentage),0) avg_score,COALESCE(MAX(percentage),0) best_score FROM quiz_attempts WHERE student_user_id=? AND status='submitted'`,[uid]);
    const [[ans]] = await db.query(`SELECT COUNT(qaa.id) answered,SUM(CASE WHEN qaa.is_correct=1 THEN 1 ELSE 0 END) correct FROM quiz_attempt_answers qaa JOIN quiz_attempts qa ON qa.id=qaa.attempt_id WHERE qa.student_user_id=? AND qa.status='submitted'`,[uid]);
    const [[assign]] = await db.query(`SELECT COUNT(*) total,SUM(CASE WHEN status IN ('submitted','graded','late') THEN 1 ELSE 0 END) completed FROM assignment_submissions WHERE student_user_id=?`,[uid]);
    const [[presence]] = await db.query(`SELECT COUNT(*) count FROM learning_events WHERE user_id=? AND created_at>=DATE_SUB(NOW(),INTERVAL 30 DAY)`,[uid]);
    const answered=n(ans.answered), correct=n(ans.correct), accuracy=pct(correct,answered), avg=n(quiz.avg_score), assignmentRate=pct(assign.completed,assign.total);
    const activityScore=Math.min(100,r2(n(presence.count)*2));
    const successScore=r2((avg*0.45)+(accuracy*0.20)+(assignmentRate*0.20)+(activityScore*0.15));
    const risk = successScore < 50 ? "High" : successScore < 70 ? "Medium" : "Low";
    const recommendations=[];
    if(avg<65) recommendations.push({type:"course",title:"Target weak quiz topics",reason:`Average quiz performance is ${r2(avg)}%. Review weak subjects before adding advanced topics.`});
    if(assignmentRate<80) recommendations.push({type:"action",title:"Complete pending assignments",reason:`Assignment completion is ${r2(assignmentRate)}%.`});
    if(accuracy<65) recommendations.push({type:"skill",title:"Practice more questions",reason:`Answer accuracy is ${r2(accuracy)}%. Use the Question Bank for targeted practice.`});
    if(recommendations.length===0) recommendations.push({type:"growth",title:"Build career-ready skills",reason:"Your current learning signals are stable. Use the Career Development Center to build role-specific skills."});

    const [[xpRow]] = await db.query(`SELECT COALESCE(SUM(xp),0) xp FROM user_xp_ledger WHERE user_id=?`,[uid]);
    const [[xpQuiz]] = await db.query(`SELECT COUNT(*) count FROM quiz_attempts WHERE student_user_id=? AND status='submitted'`,[uid]);
    const [[xpAssign]] = await db.query(`SELECT COUNT(*) count FROM assignment_submissions WHERE student_user_id=? AND status IN ('submitted','graded')`,[uid]);
    const [[xpChallenge]] = await db.query(`SELECT COUNT(*) count FROM education_challenge_submissions WHERE student_user_id=?`,[uid]);
    const [[xpSkills]] = await db.query(`SELECT COUNT(*) count FROM student_skill_progress WHERE student_user_id=? AND status='completed'`,[uid]);
    const [[xpPeer]] = await db.query(`SELECT COUNT(*) count FROM peer_posts WHERE author_user_id=?`,[uid]);
    const [[xpLive]] = await db.query(`SELECT COUNT(*) count FROM live_class_attendance WHERE user_id=?`,[uid]);
    const calculatedXp=n(xpQuiz.count)*100+n(xpAssign.count)*60+n(xpChallenge.count)*150+n(xpSkills.count)*100+n(xpPeer.count)*50+n(xpLive.count)*80;
    const xp=n(xpRow.xp)+calculatedXp;
    const level=levelFromXp(xp);
    const earned=await awardBadges(uid);
    const [badges]=await db.query(`SELECT gb.badge_name,gb.description,gb.icon,ub.awarded_at FROM user_badges ub JOIN gamification_badges gb ON gb.id=ub.badge_id WHERE ub.user_id=? ORDER BY ub.awarded_at DESC`,[uid]);
    const [certs]=await db.query(`SELECT name,issuer,status,issued_on,expires_on,credential_url FROM career_certifications WHERE user_id=? ORDER BY created_at DESC`,[uid]);
    const [[career]] = await db.query(`SELECT target_role,target_domain,readiness_score,resume_url,portfolio_url FROM career_profiles WHERE user_id=? LIMIT 1`,[uid]);
    const [projects]=await db.query(`SELECT cp.id,cp.title,cp.category,cp.description,cp.students_helped,cp.hours_contributed,cp.people_reached,cp.status,EXISTS(SELECT 1 FROM community_participation x WHERE x.project_id=cp.id AND x.user_id=?) joined FROM community_projects cp WHERE cp.status IN ('open','active') ORDER BY cp.created_at DESC LIMIT 8`,[uid]);
    const [[impact]] = await db.query(`SELECT COUNT(DISTINCT cp.id) projects,COALESCE(SUM(cpp.contribution_hours),0) hours,COALESCE(SUM(cp.students_helped),0) students_helped,COALESCE(SUM(cp.people_reached),0) people_reached FROM community_participation cpp JOIN community_projects cp ON cp.id=cpp.project_id WHERE cpp.user_id=?`,[uid]);
    res.json({success:true,profile,success:{score:successScore,band:successBand(successScore),risk,signals:{averageQuiz:r2(avg),accuracy,assignmentCompletion:r2(assignmentRate),activityScore},recommendations},career:career||{target_role:null,target_domain:null,readiness_score:0,resume_url:null,portfolio_url:null},certifications:certs,gamification:{xp,level,nextLevel:level.next,badges,earnedNow:earned},community:{projects,impact:{projects:n(impact.projects),hours:r2(impact.hours),studentsHelped:n(impact.students_helped),peopleReached:n(impact.people_reached)}}});
  }catch(e){console.error("Innovation student error:",e);res.status(500).json({success:false,message:"Unable to load AI Student Success Center"});}
});

router.post("/career/profile", authenticateUser, authorizeRoles("student"), async(req,res)=>{
  try{
    const {targetRole,targetDomain,bio,resumeUrl,portfolioUrl}=req.body||{};
    await db.query(`INSERT INTO career_profiles(user_id,target_role,target_domain,bio,resume_url,portfolio_url) VALUES(?,?,?,?,?,?) ON DUPLICATE KEY UPDATE target_role=VALUES(target_role),target_domain=VALUES(target_domain),bio=VALUES(bio),resume_url=VALUES(resume_url),portfolio_url=VALUES(portfolio_url)`,[req.user.userId,targetRole||null,targetDomain||null,bio||null,resumeUrl||null,portfolioUrl||null]);
    res.json({success:true,message:"Career profile saved"});
  }catch(e){console.error(e);res.status(500).json({success:false,message:"Unable to save career profile"});}
});

router.post("/career/certifications", authenticateUser, authorizeRoles("student"), async(req,res)=>{
  try{const {name,issuer,status,issuedOn,expiresOn,credentialUrl}=req.body||{}; if(!name)return res.status(400).json({success:false,message:"Certification name is required"}); await db.query(`INSERT INTO career_certifications(user_id,name,issuer,status,issued_on,expires_on,credential_url) VALUES(?,?,?,?,?,?,?)`,[req.user.userId,name,issuer||null,status||"planned",issuedOn||null,expiresOn||null,credentialUrl||null]); res.json({success:true,message:"Certification added"});}
  catch(e){console.error(e);res.status(500).json({success:false,message:"Unable to add certification"});}
});

router.get("/community", authenticateUser, async(req,res)=>{
  try{const [rows]=await db.query(`SELECT cp.id,cp.title,cp.category,cp.description,cp.impact_goal,cp.students_helped,cp.hours_contributed,cp.people_reached,cp.status,COUNT(DISTINCT cpp.user_id) participants FROM community_projects cp LEFT JOIN community_participation cpp ON cpp.project_id=cp.id WHERE cp.status IN ('open','active') GROUP BY cp.id ORDER BY cp.created_at DESC`);res.json({success:true,projects:rows});}
  catch(e){console.error(e);res.status(500).json({success:false,message:"Unable to load Community Impact Hub"});}
});

router.post("/community/:id/join", authenticateUser, authorizeRoles("student"), async(req,res)=>{
  try{const id=Number(req.params.id); await db.query(`INSERT IGNORE INTO community_participation(project_id,user_id,status) VALUES(?,?,'joined')`,[id,req.user.userId]); await db.query(`INSERT INTO user_xp_ledger(user_id,source_type,source_id,xp,description) SELECT ?, 'community_join', ?, 25, 'Joined a Community Impact project' WHERE NOT EXISTS (SELECT 1 FROM user_xp_ledger WHERE user_id=? AND source_type='community_join' AND source_id=?)`,[req.user.userId,id,req.user.userId,id]); res.json({success:true,message:"Joined Community Impact project"});}
  catch(e){console.error(e);res.status(500).json({success:false,message:"Unable to join project"});}
});

router.get("/admin", authenticateUser, authorizeRoles("admin"), async(req,res)=>{
  try{
    const [[users]] = await db.query(`SELECT COUNT(*) total, SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) active FROM users`);
    const [[online]] = await db.query(`SELECT COUNT(DISTINCT user_id) count FROM user_presence WHERE last_seen>=DATE_SUB(NOW(),INTERVAL 3 MINUTE)`);
    const [[quizzes]] = await db.query(`SELECT COUNT(*) attempts,COALESCE(AVG(percentage),0) avg_score FROM quiz_attempts WHERE status='submitted'`);
    const [[assign]] = await db.query(`SELECT COUNT(*) total, SUM(CASE WHEN status IN ('submitted','graded','late') THEN 1 ELSE 0 END) completed FROM assignment_submissions`);
    const [[events]] = await db.query(`SELECT COUNT(*) count FROM learning_events WHERE created_at>=DATE_SUB(NOW(),INTERVAL 30 DAY)`);
    const [[innovation]] = await db.query(`SELECT COUNT(*) submissions,COALESCE(AVG(score),0) avg_score FROM education_challenge_submissions`);
    const [[community]] = await db.query(`SELECT COUNT(DISTINCT project_id) projects,COALESCE(SUM(contribution_hours),0) hours,COUNT(DISTINCT user_id) contributors FROM community_participation`);
    const [[xp]] = await db.query(`SELECT COALESCE(SUM(xp),0) xp FROM user_xp_ledger`);
    const [[xq]] = await db.query(`SELECT COUNT(*) count FROM quiz_attempts WHERE status='submitted'`);
    const [[xa]] = await db.query(`SELECT COUNT(*) count FROM assignment_submissions WHERE status IN ('submitted','graded')`);
    const [[xc]] = await db.query(`SELECT COUNT(*) count FROM education_challenge_submissions`);
    const [[xs]] = await db.query(`SELECT COUNT(*) count FROM student_skill_progress WHERE status='completed'`);
    const [[xppeer]] = await db.query(`SELECT COUNT(*) count FROM peer_posts`);
    const [[xlive]] = await db.query(`SELECT COUNT(*) count FROM live_class_attendance`);
    const calculatedPlatformXp=n(xq.count)*100+n(xa.count)*60+n(xc.count)*150+n(xs.count)*100+n(xppeer.count)*50+n(xlive.count)*80;
    const completion=pct(assign.completed,assign.total);
    const engagement=Math.min(100,r2(n(events.count)/Math.max(1,n(users.active))*2));
    const readiness=r2((n(quizzes.avg_score)*0.45)+(completion*0.25)+(engagement*0.30));
    res.json({success:true,analytics:{activeUsers:n(users.active),onlineStudents:n(online.count),courseCompletionRate:completion,assignmentCompletionRatio:completion,quizPerformance:r2(quizzes.avg_score),studentEngagementScore:engagement,learningImprovementPercentage:r2(Math.min(100,readiness*0.8)),graduationReadinessIndicator:readiness,innovationSubmissions:n(innovation.submissions),innovationAverageScore:r2(innovation.avg_score),communityProjects:n(community.projects),communityHours:r2(community.hours),communityContributors:n(community.contributors),totalXp:n(xp.xp)+calculatedPlatformXp}});
  }catch(e){console.error("Innovation admin error:",e);res.status(500).json({success:false,message:"Unable to load Smart Education Analytics"});}
});

router.get("/faculty", authenticateUser, authorizeRoles("faculty"), async(req,res)=>{
  try{
    const [[classes]] = await db.query(`SELECT COUNT(*) count FROM live_classes WHERE faculty_user_id=?`,[req.user.userId]);
    const [[submissions]] = await db.query(`SELECT COUNT(*) count,COALESCE(AVG(score),0) avg_score FROM education_challenge_submissions ecs JOIN education_challenges ec ON ec.id=ecs.challenge_id WHERE ec.created_by=?`,[req.user.userId]);
    const [[students]] = await db.query(`SELECT COUNT(DISTINCT qa.student_user_id) count FROM quiz_attempts qa JOIN quizzes q ON q.id=qa.quiz_id JOIN faculty_subject_assignments fsa ON fsa.subject_id=q.subject_id WHERE fsa.faculty_user_id=? AND fsa.is_active=1 AND qa.status='submitted'`,[req.user.userId]);
    res.json({success:true,analytics:{liveClasses:n(classes.count),innovationSubmissions:n(submissions.count),innovationAverageScore:r2(submissions.avg_score),activeLearners:n(students.count)}});
  }catch(e){console.error(e);res.status(500).json({success:false,message:"Unable to load Faculty Innovation Center"});}
});

module.exports=router;
