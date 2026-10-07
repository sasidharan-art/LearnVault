const express = require('express');
const db = require('../config/db');
const authenticateUser = require('../middleware/authMiddleware');
const authorizeRoles = require('../middleware/roleMiddleware');
const rateLimit = require('../middleware/rateLimit');
const cache = require('../middleware/cache');
const router = express.Router();

const clean = v => String(v ?? '').trim();
const id = v => Number.isInteger(Number(v)) && Number(v) > 0 ? Number(v) : null;
const pageParams = req => ({ page: Math.max(1, Number(req.query.page) || 1), limit: Math.min(50, Math.max(1, Number(req.query.limit) || 12)) });
const safeUrl = v => {
  const value = clean(v);
  if (!value) return '';
  try { const u = new URL(value); return ['http:', 'https:'].includes(u.protocol) ? value : ''; }
  catch { return ''; }
};

async function facultySubjectAllowed(userId, subjectId) {
  if (!subjectId) return true;
  const [r] = await db.query('SELECT 1 FROM faculty_subject_assignments WHERE faculty_user_id=? AND subject_id=? AND is_active=1 LIMIT 1', [userId, subjectId]);
  return r.length > 0;
}

async function classAccessible(classId, req) {
  const [[row]] = await db.query(`SELECT lc.*, sp.course_id student_course_id, sp.course_level_id student_level_id
    FROM live_classes lc
    LEFT JOIN student_profiles sp ON sp.user_id=?
    WHERE lc.id=? LIMIT 1`, [req.user.userId, classId]);
  if (!row) return null;
  if (req.user.role === 'admin' || (req.user.role === 'faculty' && Number(row.faculty_user_id) === Number(req.user.userId))) return row;
  if (req.user.role === 'student' && (!row.course_id || Number(row.course_id) === Number(row.student_course_id)) && (!row.course_level_id || Number(row.course_level_id) === Number(row.student_level_id))) return row;
  return null;
}

async function classOwnerOrAdmin(classId, req) {
  const [[row]] = await db.query('SELECT * FROM live_classes WHERE id=? LIMIT 1', [classId]);
  if (!row) return null;
  if (req.user.role === 'admin' || (req.user.role === 'faculty' && Number(row.faculty_user_id) === Number(req.user.userId))) return row;
  return null;
}

router.get('/', authenticateUser, authorizeRoles('student','faculty','admin'), cache(5_000), async (req,res) => {
  try {
    const {page,limit}=pageParams(req); const offset=(page-1)*limit;
    let rows, total=0;
    if (req.user.role === 'faculty') {
      const [[count]] = await db.query('SELECT COUNT(*) total FROM live_classes WHERE faculty_user_id=?', [req.user.userId]); total=Number(count.total);
      [rows] = await db.query(`SELECT lc.*,s.subject_code,s.subject_name,c.course_name,cl.level_name,
        (SELECT COUNT(DISTINCT a.user_id) FROM live_class_attendance a WHERE a.live_class_id=lc.id) participants
        FROM live_classes lc LEFT JOIN subjects s ON s.id=lc.subject_id LEFT JOIN courses c ON c.id=lc.course_id LEFT JOIN course_levels cl ON cl.id=lc.course_level_id
        WHERE lc.faculty_user_id=? ORDER BY FIELD(lc.status,'live','scheduled','completed','cancelled'),lc.starts_at DESC LIMIT ? OFFSET ?`, [req.user.userId,limit,offset]);
    } else if (req.user.role === 'admin') {
      const [[count]] = await db.query('SELECT COUNT(*) total FROM live_classes'); total=Number(count.total);
      [rows] = await db.query(`SELECT lc.*,u.full_name faculty_name,s.subject_code,s.subject_name,c.course_name,cl.level_name,
        (SELECT COUNT(DISTINCT a.user_id) FROM live_class_attendance a WHERE a.live_class_id=lc.id) participants
        FROM live_classes lc JOIN users u ON u.id=lc.faculty_user_id LEFT JOIN subjects s ON s.id=lc.subject_id LEFT JOIN courses c ON c.id=lc.course_id LEFT JOIN course_levels cl ON cl.id=lc.course_level_id
        ORDER BY FIELD(lc.status,'live','scheduled','completed','cancelled'),lc.starts_at DESC LIMIT ? OFFSET ?`, [limit,offset]);
    } else {
      const [[profile]] = await db.query('SELECT course_id,course_level_id FROM student_profiles WHERE user_id=? LIMIT 1', [req.user.userId]);
      if (!profile) return res.json({success:true,classes:[],pagination:{page,limit,total:0,pages:0}});
      const levelSql=profile.course_level_id ? ' AND (lc.course_level_id IS NULL OR lc.course_level_id=?)' : '';
      const baseParams=profile.course_level_id ? [profile.course_id,profile.course_level_id] : [profile.course_id];
      const [[count]] = await db.query(`SELECT COUNT(*) total FROM live_classes lc WHERE lc.status<>'cancelled' AND (lc.course_id IS NULL OR lc.course_id=?)${levelSql}`, baseParams); total=Number(count.total);
      [rows] = await db.query(`SELECT lc.*,u.full_name faculty_name,s.subject_code,s.subject_name,c.course_name,cl.level_name,
        (SELECT COUNT(DISTINCT a.user_id) FROM live_class_attendance a WHERE a.live_class_id=lc.id) participants,
        EXISTS(SELECT 1 FROM live_class_attendance a WHERE a.live_class_id=lc.id AND a.user_id=?) joined
        FROM live_classes lc JOIN users u ON u.id=lc.faculty_user_id LEFT JOIN subjects s ON s.id=lc.subject_id LEFT JOIN courses c ON c.id=lc.course_id LEFT JOIN course_levels cl ON cl.id=lc.course_level_id
        WHERE lc.status<>'cancelled' AND (lc.course_id IS NULL OR lc.course_id=?)${levelSql}
        ORDER BY FIELD(lc.status,'live','scheduled','completed'),lc.starts_at ASC LIMIT ? OFFSET ?`, [req.user.userId,...baseParams,limit,offset]);
    }
    res.json({success:true,classes:rows,pagination:{page,limit,total,pages:Math.ceil(total/limit)}});
  } catch(e){ console.error(e); res.status(500).json({success:false,message:'Unable to load Live Classes'}); }
});

router.get('/options', authenticateUser, authorizeRoles('faculty','admin'), async (req,res) => {
  try {
    if (req.user.role === 'faculty') {
      const [subjects] = await db.query(`SELECT s.id,s.subject_code,s.subject_name,s.course_id,s.course_level_id,c.course_name,cl.level_name
        FROM faculty_subject_assignments fsa INNER JOIN subjects s ON s.id=fsa.subject_id
        INNER JOIN courses c ON c.id=s.course_id LEFT JOIN course_levels cl ON cl.id=s.course_level_id
        WHERE fsa.faculty_user_id=? AND fsa.is_active=1 AND s.is_active=1 AND c.is_active=1 ORDER BY c.course_name,s.subject_name`, [req.user.userId]);
      return res.json({success:true,subjects});
    }
    const [subjects] = await db.query(`SELECT s.id,s.subject_code,s.subject_name,s.course_id,s.course_level_id,c.course_name,cl.level_name
      FROM subjects s INNER JOIN courses c ON c.id=s.course_id LEFT JOIN course_levels cl ON cl.id=s.course_level_id
      WHERE s.is_active=1 AND c.is_active=1 ORDER BY c.course_name,s.subject_name`);
    const [courses] = await db.query('SELECT id,course_code,course_name FROM courses WHERE is_active=1 ORDER BY course_name');
    const [levels] = await db.query('SELECT id,course_id,level_name,level_order FROM course_levels WHERE is_active=1 ORDER BY course_id,level_order');
    return res.json({success:true,subjects,courses,levels});
  } catch(e){ console.error(e); res.status(500).json({success:false,message:'Unable to load Live Class options'}); }
});

router.post('/', authenticateUser, authorizeRoles('faculty','admin'), rateLimit({windowMs:60_000,max:20,keyGenerator:req=>`${req.user.userId}:live-create`}), async (req,res)=>{
  const subjectId=id(req.body.subjectId),courseId=id(req.body.courseId),levelId=id(req.body.courseLevelId);
  const title=clean(req.body.title).slice(0,180),description=clean(req.body.description).slice(0,2000);
  const startsAt=clean(req.body.startsAt),endsAt=clean(req.body.endsAt);
  const nativeEnabled=req.body.nativeEnabled !== false;
  const meetingUrl=safeUrl(req.body.meetingUrl);
  if(!title||!startsAt)return res.status(400).json({success:false,message:'Title and start time are required'});
  try {
    if(req.user.role==='faculty' && !(await facultySubjectAllowed(req.user.userId,subjectId)))return res.status(403).json({success:false,message:'You can schedule Live Classes only for your assigned subjects'});
    const [r]=await db.query(`INSERT INTO live_classes(faculty_user_id,subject_id,course_id,course_level_id,title,description,meeting_url,stream_provider,stream_url,thumbnail_url,chat_enabled,native_enabled,starts_at,ends_at,status) VALUES(?,?,?,?,?,?,?,?,?,?,1,?,?,?,?,'scheduled')`,[req.user.userId,subjectId,courseId,levelId,title,description||null,meetingUrl||'', 'native',null,null,nativeEnabled?1:0,startsAt,endsAt||null]);
    const classId=r.insertId;
    if(req.body.notifyStudents && subjectId){
      const notificationBody=clean(req.body.notificationMessage)||`Live Class scheduled: ${title}. Join LearnVault at the scheduled time.`;
      await db.query(`INSERT INTO announcements(created_by,target_type,target_role,subject_id,title,body,priority,status,starts_at,expires_at) VALUES(?,?,?,?,?,?,'important','published',NOW(),?)`,[req.user.userId,'subject','student',subjectId,`Live Class: ${title}`,notificationBody,endsAt||null]);
    }
    res.status(201).json({success:true,message:'Native LearnVault Live Class scheduled',classId});
  } catch(e){console.error(e);res.status(500).json({success:false,message:'Unable to schedule Live Class'});}
});

router.patch('/:id/status', authenticateUser, authorizeRoles('faculty','admin'), async (req,res)=>{
  const classId=id(req.params.id),status=clean(req.body.status).toLowerCase();
  if(!classId||!['scheduled','live','completed','cancelled'].includes(status))return res.status(400).json({success:false,message:'Invalid Live Class status'});
  try { const row=await classOwnerOrAdmin(classId,req); if(!row)return res.status(404).json({success:false,message:'Live Class not found'}); await db.query('UPDATE live_classes SET status=? WHERE id=?',[status,classId]);
    if(status==='live' && row.subject_id){
      await db.query(`INSERT INTO announcements(created_by,target_type,target_role,subject_id,title,body,priority,status,starts_at) VALUES(?,?,?,?,?,?,'urgent','published',NOW())`,[req.user.userId,'subject','student',row.subject_id,`Live Now: ${row.title}`,`The live class “${row.title}” is now live in LearnVault. Join from Live Classes.`]);
    }
    res.json({success:true,message:`Live Class marked ${status}`});
  } catch(e){console.error(e);res.status(500).json({success:false,message:'Unable to update Live Class'});}
});

router.delete('/:id', authenticateUser, authorizeRoles('faculty','admin'), async (req,res)=>{
  const classId=id(req.params.id); if(!classId)return res.status(400).json({success:false,message:'Invalid Live Class'});
  try { const row=await classOwnerOrAdmin(classId,req); if(!row)return res.status(404).json({success:false,message:'Live Class not found'}); await db.query('DELETE FROM live_classes WHERE id=?',[classId]); res.json({success:true,message:'Live Class deleted'}); }
  catch(e){console.error(e);res.status(500).json({success:false,message:'Unable to delete Live Class'});}
});

router.get('/:id', authenticateUser, authorizeRoles('student','faculty','admin'), async (req,res)=>{
  const classId=id(req.params.id); if(!classId)return res.status(400).json({success:false,message:'Invalid Live Class'});
  try { const row=await classAccessible(classId,req); if(!row)return res.status(404).json({success:false,message:'Live Class not found or unavailable'}); const [[stats]]=await db.query(`SELECT COUNT(DISTINCT user_id) participants,COALESCE(AVG(attendance_minutes),0) avgMinutes FROM live_class_attendance WHERE live_class_id=?`,[classId]); res.json({success:true,class:{...row,participants:Number(stats.participants),avgMinutes:Number(stats.avgMinutes)}}); }
  catch(e){console.error(e);res.status(500).json({success:false,message:'Unable to load Live Class'});}
});

router.post('/:id/join', authenticateUser, authorizeRoles('student','faculty','admin'), async (req,res)=>{
  const classId=id(req.params.id); if(!classId)return res.status(400).json({success:false,message:'Invalid Live Class'});
  try { const row=await classAccessible(classId,req); if(!row)return res.status(404).json({success:false,message:'Live Class not found or unavailable'}); await db.query(`INSERT INTO live_class_attendance(live_class_id,user_id,joined_at) VALUES(?,?,NOW()) ON DUPLICATE KEY UPDATE joined_at=NOW(),left_at=NULL`,[classId,req.user.userId]); res.json({success:true,status:row.status,nativeEnabled:Boolean(row.native_enabled)}); }
  catch(e){console.error(e);res.status(500).json({success:false,message:'Unable to join Live Class'});}
});

router.post('/:id/leave', authenticateUser, authorizeRoles('student','faculty','admin'), async (req,res)=>{
  const classId=id(req.params.id); if(!classId)return res.status(400).json({success:false,message:'Invalid Live Class'});
  try { await db.query('UPDATE live_class_attendance SET left_at=NOW(),attendance_minutes=GREATEST(0,TIMESTAMPDIFF(MINUTE,joined_at,NOW())) WHERE live_class_id=? AND user_id=? AND left_at IS NULL',[classId,req.user.userId]); res.json({success:true,message:'Attendance session closed'}); }
  catch(e){console.error(e);res.status(500).json({success:false,message:'Unable to close attendance'});}
});

router.post('/:id/native/start', authenticateUser, authorizeRoles('faculty','admin'), async (req,res)=>{
  const classId=id(req.params.id); if(!classId)return res.status(400).json({success:false,message:'Invalid Live Class'});
  try { const row=await classOwnerOrAdmin(classId,req); if(!row)return res.status(404).json({success:false,message:'Live Class not found'}); await db.query("UPDATE live_classes SET status='live', native_enabled=1 WHERE id=?",[classId]); res.json({success:true,message:'Native classroom is live'}); }
  catch(e){console.error(e);res.status(500).json({success:false,message:'Unable to start native classroom'});}
});

router.get('/:id/native/participants', authenticateUser, authorizeRoles('faculty','admin'), async (req,res)=>{
  const classId=id(req.params.id); if(!classId)return res.status(400).json({success:false,message:'Invalid Live Class'});
  try { const row=await classOwnerOrAdmin(classId,req); if(!row)return res.status(404).json({success:false,message:'Live Class not found'}); const [participants]=await db.query(`SELECT a.user_id,u.full_name,u.username,a.joined_at FROM live_class_attendance a INNER JOIN users u ON u.id=a.user_id WHERE a.live_class_id=? AND a.left_at IS NULL ORDER BY a.joined_at`,[classId]); res.json({success:true,participants}); }
  catch(e){console.error(e);res.status(500).json({success:false,message:'Unable to load participants'});}
});

router.post('/:id/native/offer', authenticateUser, authorizeRoles('faculty','admin'), rateLimit({windowMs:60_000,max:120,keyGenerator:req=>`${req.user.userId}:live-signal`}), async (req,res)=>{
  const classId=id(req.params.id),toUserId=id(req.body.toUserId),payload=clean(req.body.payload);
  if(!classId||!toUserId||payload.length<10||payload.length>200000)return res.status(400).json({success:false,message:'Invalid WebRTC offer'});
  try { const row=await classOwnerOrAdmin(classId,req); if(!row)return res.status(404).json({success:false,message:'Live Class not found'}); await db.query(`INSERT INTO live_class_signals(live_class_id,from_user_id,to_user_id,signal_type,payload) VALUES(?,?,?,?,?)`,[classId,req.user.userId,toUserId,'offer',payload]); res.json({success:true}); }
  catch(e){console.error(e);res.status(500).json({success:false,message:'Unable to send WebRTC offer'});}
});

router.get('/:id/native/offers', authenticateUser, authorizeRoles('student'), async (req,res)=>{
  const classId=id(req.params.id); if(!classId)return res.status(400).json({success:false,message:'Invalid Live Class'});
  try { const row=await classAccessible(classId,req); if(!row)return res.status(404).json({success:false,message:'Live Class not found'}); const [rows]=await db.query(`SELECT id,from_user_id,payload FROM live_class_signals WHERE live_class_id=? AND to_user_id=? AND signal_type='offer' AND consumed_at IS NULL ORDER BY id`,[classId,req.user.userId]); if(rows.length) await db.query(`UPDATE live_class_signals SET consumed_at=NOW() WHERE id IN (${rows.map(()=>'?').join(',')})`,rows.map(x=>x.id)); res.json({success:true,offers:rows}); }
  catch(e){console.error(e);res.status(500).json({success:false,message:'Unable to load WebRTC offers'});}
});

router.post('/:id/native/answer', authenticateUser, authorizeRoles('student'), rateLimit({windowMs:60_000,max:120,keyGenerator:req=>`${req.user.userId}:live-signal`}), async (req,res)=>{
  const classId=id(req.params.id),payload=clean(req.body.payload); if(!classId||payload.length<10||payload.length>200000)return res.status(400).json({success:false,message:'Invalid WebRTC answer'});
  try { const row=await classAccessible(classId,req); if(!row)return res.status(404).json({success:false,message:'Live Class not found'}); await db.query(`INSERT INTO live_class_signals(live_class_id,from_user_id,to_user_id,signal_type,payload) VALUES(?,?,?,?,?)`,[classId,req.user.userId,row.faculty_user_id,'answer',payload]); res.json({success:true}); }
  catch(e){console.error(e);res.status(500).json({success:false,message:'Unable to send WebRTC answer'});}
});

router.get('/:id/native/answers', authenticateUser, authorizeRoles('faculty','admin'), async (req,res)=>{
  const classId=id(req.params.id); if(!classId)return res.status(400).json({success:false,message:'Invalid Live Class'});
  try { const row=await classOwnerOrAdmin(classId,req); if(!row)return res.status(404).json({success:false,message:'Live Class not found'}); const [rows]=await db.query(`SELECT id,from_user_id,payload FROM live_class_signals WHERE live_class_id=? AND to_user_id=? AND signal_type='answer' AND consumed_at IS NULL ORDER BY id`,[classId,row.faculty_user_id]); if(rows.length) await db.query(`UPDATE live_class_signals SET consumed_at=NOW() WHERE id IN (${rows.map(()=>'?').join(',')})`,rows.map(x=>x.id)); res.json({success:true,answers:rows}); }
  catch(e){console.error(e);res.status(500).json({success:false,message:'Unable to load WebRTC answers'});}
});

router.post('/:id/notify', authenticateUser, authorizeRoles('faculty','admin'), rateLimit({windowMs:60_000,max:20,keyGenerator:req=>`${req.user.userId}:live-notify`}), async (req,res)=>{
  const classId=id(req.params.id),message=clean(req.body.message).slice(0,1000),priority=['normal','important','urgent'].includes(clean(req.body.priority).toLowerCase())?clean(req.body.priority).toLowerCase():'important';
  if(!classId||message.length<2)return res.status(400).json({success:false,message:'Notification message is required'});
  try { const row=await classOwnerOrAdmin(classId,req); if(!row)return res.status(404).json({success:false,message:'Live Class not found'}); if(!row.subject_id)return res.status(400).json({success:false,message:'This class has no Subject audience'}); await db.query(`INSERT INTO announcements(created_by,target_type,target_role,subject_id,title,body,priority,status,starts_at) VALUES(?,?,?,?,?,?,?,'published',NOW())`,[req.user.userId,'subject','student',row.subject_id,`Live Class: ${row.title}`,message,priority]); res.json({success:true,message:'Students notified'}); }
  catch(e){console.error(e);res.status(500).json({success:false,message:'Unable to send Live Class notification'});}
});

// Existing chat/Q&A endpoints are preserved below this point.
router.get('/:id/chat', authenticateUser, authorizeRoles('student','faculty','admin'), async (req,res)=>{
  const classId=id(req.params.id); if(!classId)return res.status(400).json({success:false,message:'Invalid Live Class'});
  try { const row=await classAccessible(classId,req); if(!row)return res.status(404).json({success:false,message:'Live Class not found'}); const [rows]=await db.query(`SELECT m.id,m.message,m.created_at,u.full_name,u.role FROM live_class_messages m INNER JOIN users u ON u.id=m.user_id WHERE m.live_class_id=? ORDER BY m.id DESC LIMIT 100`,[classId]); res.json({success:true,messages:rows.reverse()}); } catch(e){console.error(e);res.status(500).json({success:false,message:'Unable to load chat'});}
});
router.post('/:id/chat', authenticateUser, authorizeRoles('student','faculty','admin'), rateLimit({windowMs:60_000,max:30,keyGenerator:req=>`${req.user.userId}:live-chat`}), async (req,res)=>{
  const classId=id(req.params.id),message=clean(req.body.message).slice(0,500); if(!classId||message.length<1)return res.status(400).json({success:false,message:'Message is required'});
  try { const row=await classAccessible(classId,req); if(!row)return res.status(404).json({success:false,message:'Live Class not found'}); await db.query('INSERT INTO live_class_messages(live_class_id,user_id,message) VALUES(?,?,?)',[classId,req.user.userId,message]); res.status(201).json({success:true}); } catch(e){console.error(e);res.status(500).json({success:false,message:'Unable to send chat message'});}
});
router.get('/:id/questions', authenticateUser, authorizeRoles('student','faculty','admin'), async (req,res)=>{
  const classId=id(req.params.id); if(!classId)return res.status(400).json({success:false,message:'Invalid Live Class'});
  try { const row=await classAccessible(classId,req); if(!row)return res.status(404).json({success:false,message:'Live Class not found'}); const [rows]=await db.query(`SELECT q.id,q.question,q.faculty_answer AS answer,q.answered_at,q.created_at,u.full_name FROM live_class_questions q INNER JOIN users u ON u.id=q.user_id WHERE q.live_class_id=? ORDER BY q.id DESC LIMIT 100`,[classId]); res.json({success:true,questions:rows}); } catch(e){console.error(e);res.status(500).json({success:false,message:'Unable to load questions'});}
});
router.post('/:id/questions', authenticateUser, authorizeRoles('student'), rateLimit({windowMs:60_000,max:10,keyGenerator:req=>`${req.user.userId}:live-q`}), async (req,res)=>{
  const classId=id(req.params.id),question=clean(req.body.question).slice(0,1000); if(!classId||question.length<2)return res.status(400).json({success:false,message:'Question is required'});
  try { const row=await classAccessible(classId,req); if(!row)return res.status(404).json({success:false,message:'Live Class not found'}); await db.query('INSERT INTO live_class_questions(live_class_id,user_id,question) VALUES(?,?,?)',[classId,req.user.userId,question]); res.status(201).json({success:true}); } catch(e){console.error(e);res.status(500).json({success:false,message:'Unable to send question'});}
});
router.patch('/:id/questions/:questionId', authenticateUser, authorizeRoles('faculty','admin'), async (req,res)=>{
  const classId=id(req.params.id),questionId=id(req.params.questionId),answer=clean(req.body.answer).slice(0,2000); if(!classId||!questionId||!answer)return res.status(400).json({success:false,message:'Answer is required'});
  try { const row=await classOwnerOrAdmin(classId,req); if(!row)return res.status(404).json({success:false,message:'Live Class not found'}); const [r]=await db.query('UPDATE live_class_questions SET faculty_answer=?,is_answered=1,answered_at=NOW() WHERE id=? AND live_class_id=?',[answer,questionId,classId]); if(!r.affectedRows)return res.status(404).json({success:false,message:'Question not found'}); res.json({success:true}); } catch(e){console.error(e);res.status(500).json({success:false,message:'Unable to answer question'});}
});


/* ============================================================
   FULL LIVE CLASSROOM CONTROL: polls, quizzes, materials,
   moderation and classroom analytics.
============================================================ */
router.get('/:id/polls', authenticateUser, authorizeRoles('student','faculty','admin'), async (req,res)=>{
  const classId=id(req.params.id); if(!classId) return res.status(400).json({success:false,message:'Invalid Live Class'});
  try {
    const row=await classAccessible(classId,req); if(!row) return res.status(404).json({success:false,message:'Live Class not found or unavailable'});
    const [polls]=await db.query(`SELECT p.id,p.question,p.poll_type,p.is_active,p.created_at,p.closed_at,
      EXISTS(SELECT 1 FROM live_class_poll_responses r WHERE r.poll_id=p.id AND r.user_id=?) responded,
      (SELECT option_id FROM live_class_poll_responses r WHERE r.poll_id=p.id AND r.user_id=? LIMIT 1) selected_option_id
      FROM live_class_polls p WHERE p.live_class_id=? ORDER BY p.id DESC`,[req.user.userId,req.user.userId,classId]);
    for(const poll of polls){
      const [options]=await db.query(`SELECT id,option_text,option_order FROM live_class_poll_options WHERE poll_id=? ORDER BY option_order,id`,[poll.id]);
      poll.options=options;
      if(req.user.role!=='student'){
        const [stats]=await db.query(`SELECT option_id,COUNT(*) count FROM live_class_poll_responses WHERE poll_id=? GROUP BY option_id`,[poll.id]);
        poll.results=stats;
      }
    }
    res.json({success:true,polls});
  }catch(e){console.error(e);res.status(500).json({success:false,message:'Unable to load live polls'});}
});

router.post('/:id/polls', authenticateUser, authorizeRoles('faculty','admin'), async (req,res)=>{
  const classId=id(req.params.id), question=clean(req.body.question).slice(0,1000), type=['poll','quiz'].includes(req.body.pollType)?req.body.pollType:'poll';
  const options=Array.isArray(req.body.options)?req.body.options.map(clean).map(x=>x.slice(0,500)).filter(Boolean).slice(0,8):[];
  if(!classId||question.length<2||options.length<2) return res.status(400).json({success:false,message:'Question and at least two options are required'});
  try{
    const row=await classOwnerOrAdmin(classId,req); if(!row)return res.status(404).json({success:false,message:'Live Class not found'});
    const conn=await db.getConnection(); try{await conn.beginTransaction();
      const [r]=await conn.query('INSERT INTO live_class_polls(live_class_id,created_by,question,poll_type,is_active) VALUES(?,?,?,?,1)',[classId,req.user.userId,question,type]);
      for(let i=0;i<options.length;i++) await conn.query('INSERT INTO live_class_poll_options(poll_id,option_text,option_order) VALUES(?,?,?)',[r.insertId,options[i],i]);
      if(type==='quiz' && Number.isInteger(Number(req.body.correctIndex)) && Number(req.body.correctIndex)>=0 && Number(req.body.correctIndex)<options.length){
        const [opt]=await conn.query('SELECT id FROM live_class_poll_options WHERE poll_id=? ORDER BY option_order,id LIMIT 1 OFFSET ?',[r.insertId,Number(req.body.correctIndex)]);
        if(opt[0]) await conn.query('UPDATE live_class_polls SET correct_option_id=? WHERE id=?',[opt[0].id,r.insertId]);
      }
      await conn.commit(); res.status(201).json({success:true,id:r.insertId,message:type==='quiz'?'Live quiz published':'Live poll published'});
    }catch(e){await conn.rollback();throw e;}finally{conn.release();}
  }catch(e){console.error(e);res.status(500).json({success:false,message:'Unable to publish live poll'});}
});

router.patch('/:id/polls/:pollId/close', authenticateUser, authorizeRoles('faculty','admin'), async(req,res)=>{
  const classId=id(req.params.id),pollId=id(req.params.pollId); try{const row=await classOwnerOrAdmin(classId,req);if(!row)return res.status(404).json({success:false,message:'Live Class not found'});await db.query('UPDATE live_class_polls SET is_active=0,closed_at=NOW() WHERE id=? AND live_class_id=?',[pollId,classId]);res.json({success:true,message:'Poll closed'});}catch(e){console.error(e);res.status(500).json({success:false,message:'Unable to close poll'});}
});

router.post('/:id/polls/:pollId/respond', authenticateUser, authorizeRoles('student'), async(req,res)=>{
  const classId=id(req.params.id),pollId=id(req.params.pollId),optionId=id(req.body.optionId); if(!classId||!pollId||!optionId)return res.status(400).json({success:false,message:'A poll option is required'});
  try{const row=await classAccessible(classId,req);if(!row)return res.status(404).json({success:false,message:'Live Class not found'});const [[poll]]=await db.query('SELECT * FROM live_class_polls WHERE id=? AND live_class_id=? AND is_active=1',[pollId,classId]);if(!poll)return res.status(404).json({success:false,message:'Poll is closed'});const [[opt]]=await db.query('SELECT id FROM live_class_poll_options WHERE id=? AND poll_id=?',[optionId,pollId]);if(!opt)return res.status(400).json({success:false,message:'Invalid option'});const correct=poll.poll_type==='quiz'&&poll.correct_option_id?Number(poll.correct_option_id)===optionId:null;await db.query('INSERT INTO live_class_poll_responses(poll_id,user_id,option_id,is_correct) VALUES(?,?,?,?) ON DUPLICATE KEY UPDATE option_id=VALUES(option_id),is_correct=VALUES(is_correct),responded_at=NOW()',[pollId,req.user.userId,optionId,correct]);res.json({success:true,correct});}catch(e){console.error(e);res.status(500).json({success:false,message:'Unable to submit response'});}
});

router.get('/:id/materials', authenticateUser, authorizeRoles('student','faculty','admin'), async(req,res)=>{
  const classId=id(req.params.id);try{const row=await classAccessible(classId,req);if(!row)return res.status(404).json({success:false,message:'Live Class not found'});const [materials]=await db.query(`SELECT m.id,m.title,m.resource_url,m.material_type,m.created_at,u.full_name uploaded_by_name FROM live_class_materials m INNER JOIN users u ON u.id=m.uploaded_by WHERE m.live_class_id=? ORDER BY m.id DESC`,[classId]);res.json({success:true,materials});}catch(e){console.error(e);res.status(500).json({success:false,message:'Unable to load materials'});}
});

router.post('/:id/materials', authenticateUser, authorizeRoles('faculty','admin'), async(req,res)=>{
  const classId=id(req.params.id),title=clean(req.body.title).slice(0,255),url=safeUrl(req.body.url),type=clean(req.body.materialType).slice(0,60)||'resource';if(!classId||!title||!url)return res.status(400).json({success:false,message:'Title and valid HTTPS/HTTP URL are required'});
  try{const row=await classOwnerOrAdmin(classId,req);if(!row)return res.status(404).json({success:false,message:'Live Class not found'});const [r]=await db.query('INSERT INTO live_class_materials(live_class_id,uploaded_by,title,resource_url,material_type) VALUES(?,?,?,?,?)',[classId,req.user.userId,title,url,type]);res.status(201).json({success:true,id:r.insertId,message:'Material shared'});}catch(e){console.error(e);res.status(500).json({success:false,message:'Unable to share material'});}
});

router.get('/:id/moderation', authenticateUser, authorizeRoles('faculty','admin'), async(req,res)=>{const classId=id(req.params.id);try{const row=await classOwnerOrAdmin(classId,req);if(!row)return res.status(404).json({success:false,message:'Live Class not found'});const [rows]=await db.query(`SELECT m.target_user_id,u.full_name,MAX(CASE WHEN m.action='ban' THEN 1 ELSE 0 END) banned,MAX(CASE WHEN m.action='mute' THEN 1 ELSE 0 END) muted FROM live_class_moderation m INNER JOIN users u ON u.id=m.target_user_id WHERE m.live_class_id=? GROUP BY m.target_user_id,u.full_name`,[classId]);res.json({success:true,moderation:rows});}catch(e){console.error(e);res.status(500).json({success:false,message:'Unable to load moderation state'});}});

router.post('/:id/moderation', authenticateUser, authorizeRoles('faculty','admin'), async(req,res)=>{const classId=id(req.params.id),target=id(req.body.targetUserId),action=clean(req.body.action).toLowerCase(),reason=clean(req.body.reason).slice(0,500);if(!classId||!target||!['mute','unmute','remove','ban','unban'].includes(action))return res.status(400).json({success:false,message:'Invalid moderation request'});try{const row=await classOwnerOrAdmin(classId,req);if(!row)return res.status(404).json({success:false,message:'Live Class not found'});await db.query('INSERT INTO live_class_moderation(live_class_id,moderator_user_id,target_user_id,action,reason) VALUES(?,?,?,?,?)',[classId,req.user.userId,target,action,reason||null]);if(['remove','ban'].includes(action))await db.query('UPDATE live_class_attendance SET left_at=NOW(),attendance_minutes=GREATEST(0,TIMESTAMPDIFF(MINUTE,joined_at,NOW())) WHERE live_class_id=? AND user_id=? AND left_at IS NULL',[classId,target]);res.json({success:true,message:`Participant ${action} applied`});}catch(e){console.error(e);res.status(500).json({success:false,message:'Unable to apply moderation action'});}});

router.get('/:id/analytics', authenticateUser, authorizeRoles('faculty','admin'), async(req,res)=>{const classId=id(req.params.id);try{const row=await classOwnerOrAdmin(classId,req);if(!row)return res.status(404).json({success:false,message:'Live Class not found'});const [[a]]=await db.query(`SELECT COUNT(DISTINCT user_id) participants,COALESCE(AVG(attendance_minutes),0) avg_minutes,COALESCE(SUM(attendance_minutes),0) total_minutes FROM live_class_attendance WHERE live_class_id=?`,[classId]);const [[m]]=await db.query('SELECT COUNT(*) count FROM live_class_messages WHERE live_class_id=?',[classId]);const [[q]]=await db.query('SELECT COUNT(*) total,SUM(is_answered=1) answered FROM live_class_questions WHERE live_class_id=?',[classId]);const [[p]]=await db.query('SELECT COUNT(*) polls FROM live_class_polls WHERE live_class_id=?',[classId]);const [[r]]=await db.query('SELECT COUNT(*) responses,COALESCE(SUM(is_correct=1),0) correct FROM live_class_poll_responses r INNER JOIN live_class_polls p ON p.id=r.poll_id WHERE p.live_class_id=?',[classId]);res.json({success:true,analytics:{participants:Number(a.participants||0),avgMinutes:Number(a.avg_minutes||0),totalMinutes:Number(a.total_minutes||0),messages:Number(m.count||0),questions:Number(q.total||0),answeredQuestions:Number(q.answered||0),polls:Number(p.polls||0),pollResponses:Number(r.responses||0),correctResponses:Number(r.correct||0)}});}catch(e){console.error(e);res.status(500).json({success:false,message:'Unable to load classroom analytics'});}});

module.exports = router;
