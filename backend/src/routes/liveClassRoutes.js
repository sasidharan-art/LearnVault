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
    const [r]=await db.query(`INSERT INTO live_classes(faculty_user_id,subject_id,course_id,course_level_id,title,description,meeting_url,stream_provider,stream_url,thumbnail_url,chat_enabled,native_enabled,status) VALUES(?,?,?,?,?,?,?,?,?,?,1,?,'scheduled')`,[req.user.userId,subjectId,courseId,levelId,title,description||null,meetingUrl||null,'native',null,null,nativeEnabled?1:0]);
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
  try { const row=await classAccessible(classId,req); if(!row)return res.status(404).json({success:false,message:'Live Class not found'}); const [rows]=await db.query(`SELECT q.id,q.question,q.answer,q.answered_at,q.created_at,u.full_name FROM live_class_questions q INNER JOIN users u ON u.id=q.student_user_id WHERE q.live_class_id=? ORDER BY q.id DESC LIMIT 100`,[classId]); res.json({success:true,questions:rows}); } catch(e){console.error(e);res.status(500).json({success:false,message:'Unable to load questions'});}
});
router.post('/:id/questions', authenticateUser, authorizeRoles('student'), rateLimit({windowMs:60_000,max:10,keyGenerator:req=>`${req.user.userId}:live-q`}), async (req,res)=>{
  const classId=id(req.params.id),question=clean(req.body.question).slice(0,1000); if(!classId||question.length<2)return res.status(400).json({success:false,message:'Question is required'});
  try { const row=await classAccessible(classId,req); if(!row)return res.status(404).json({success:false,message:'Live Class not found'}); await db.query('INSERT INTO live_class_questions(live_class_id,student_user_id,question) VALUES(?,?,?)',[classId,req.user.userId,question]); res.status(201).json({success:true}); } catch(e){console.error(e);res.status(500).json({success:false,message:'Unable to send question'});}
});
router.patch('/:id/questions/:questionId', authenticateUser, authorizeRoles('faculty','admin'), async (req,res)=>{
  const classId=id(req.params.id),questionId=id(req.params.questionId),answer=clean(req.body.answer).slice(0,2000); if(!classId||!questionId||!answer)return res.status(400).json({success:false,message:'Answer is required'});
  try { const row=await classOwnerOrAdmin(classId,req); if(!row)return res.status(404).json({success:false,message:'Live Class not found'}); const [r]=await db.query('UPDATE live_class_questions SET answer=?,answered_at=NOW(),answered_by=? WHERE id=? AND live_class_id=?',[answer,req.user.userId,questionId,classId]); if(!r.affectedRows)return res.status(404).json({success:false,message:'Question not found'}); res.json({success:true}); } catch(e){console.error(e);res.status(500).json({success:false,message:'Unable to answer question'});}
});

module.exports = router;
