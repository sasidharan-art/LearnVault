const express=require("express");
const db=require("../config/db");
const authenticateUser=require("../middleware/authMiddleware");
const authorizeRoles=require("../middleware/roleMiddleware");
const router=express.Router();
const clean=v=>String(v||"").trim();

async function studentProfile(userId){
    const [r]=await db.query(`SELECT sp.user_id,sp.course_id,sp.course_level_id,c.course_name,cl.level_name,ed.domain_name
        FROM student_profiles sp JOIN courses c ON c.id=sp.course_id LEFT JOIN course_levels cl ON cl.id=sp.course_level_id
        LEFT JOIN education_domains ed ON ed.id=c.domain_id WHERE sp.user_id=? AND c.is_active=1 LIMIT 1`,[userId]);
    return r[0]||null;
}
function levelClause(p,a="s"){return p.course_level_id?{sql:` AND (${a}.course_level_id IS NULL OR ${a}.course_level_id=?)`,vals:[p.course_level_id]}:{sql:` AND ${a}.course_level_id IS NULL`,vals:[]};}
async function facultyCanSubject(uid,sid){const [r]=await db.query(`SELECT s.id FROM faculty_subject_assignments fsa JOIN subjects s ON s.id=fsa.subject_id JOIN courses c ON c.id=s.course_id
    WHERE fsa.faculty_user_id=? AND fsa.subject_id=? AND fsa.is_active=1 AND s.is_active=1 AND c.is_active=1 LIMIT 1`,[uid,sid]);return r.length>0;}
async function getGroup(id){const [r]=await db.query(`SELECT pg.*,s.course_id,s.course_level_id,s.subject_code,s.subject_name,c.course_name,u.full_name creator_name
    FROM peer_groups pg JOIN subjects s ON s.id=pg.subject_id JOIN courses c ON c.id=s.course_id JOIN users u ON u.id=pg.created_by WHERE pg.id=? LIMIT 1`,[id]);return r[0]||null;}
async function canAccess(req,g,needMember=false){
    if(!g)return false;if(req.user.role==='admin')return true;
    if(req.user.role==='faculty')return await facultyCanSubject(req.user.userId,g.subject_id);
    const p=await studentProfile(req.user.userId);if(!p||Number(g.course_id)!==Number(p.course_id)||g.status==='archived')return false;
    if(g.course_level_id!=null&&Number(g.course_level_id)!==Number(p.course_level_id))return false;
    if(needMember){const [m]=await db.query(`SELECT group_id FROM peer_group_members WHERE group_id=? AND user_id=? LIMIT 1`,[g.id,req.user.userId]);return m.length>0;}
    return true;
}

router.get("/groups",authenticateUser,authorizeRoles("student","faculty","admin"),async(req,res)=>{
    try{
        let subjects=[],groups=[],profile=null;
        if(req.user.role==='student'){
            profile=await studentProfile(req.user.userId);if(!profile)return res.status(400).json({success:false,message:"Your student course profile is not configured"});
            const l=levelClause(profile);
            [subjects]=await db.query(`SELECT s.id,s.subject_code,s.subject_name FROM subjects s WHERE s.course_id=? AND s.is_active=1 ${l.sql} ORDER BY s.subject_name`,[profile.course_id,...l.vals]);
            [groups]=await db.query(`SELECT pg.id,pg.group_name,pg.description,pg.max_members,pg.status,pg.created_at,s.id subject_id,s.subject_code,s.subject_name,u.full_name creator_name,
                COUNT(DISTINCT m.user_id) member_count,COUNT(DISTINCT p.id) post_count,MAX(CASE WHEN m.user_id=? THEN 1 ELSE 0 END) joined
                FROM peer_groups pg JOIN subjects s ON s.id=pg.subject_id JOIN users u ON u.id=pg.created_by
                LEFT JOIN peer_group_members m ON m.group_id=pg.id LEFT JOIN peer_posts p ON p.group_id=pg.id AND p.status='visible'
                WHERE s.course_id=? AND s.is_active=1 AND pg.status<>'archived' ${l.sql}
                GROUP BY pg.id,pg.group_name,pg.description,pg.max_members,pg.status,pg.created_at,s.id,s.subject_code,s.subject_name,u.full_name
                HAVING pg.status='open' OR joined=1 ORDER BY joined DESC,pg.created_at DESC`,[req.user.userId,profile.course_id,...l.vals]);
        }else if(req.user.role==='faculty'){
            [subjects]=await db.query(`SELECT s.id,s.subject_code,s.subject_name,c.course_name FROM faculty_subject_assignments fsa JOIN subjects s ON s.id=fsa.subject_id JOIN courses c ON c.id=s.course_id
                WHERE fsa.faculty_user_id=? AND fsa.is_active=1 AND s.is_active=1 AND c.is_active=1 ORDER BY c.course_name,s.subject_name`,[req.user.userId]);
            const ids=subjects.map(x=>x.id);if(ids.length){const ph=ids.map(()=>'?').join(',');[groups]=await db.query(`SELECT pg.id,pg.group_name,pg.description,pg.max_members,pg.status,pg.created_at,pg.created_by,s.id subject_id,s.subject_code,s.subject_name,u.full_name creator_name,
                COUNT(DISTINCT m.user_id) member_count,COUNT(DISTINCT p.id) post_count FROM peer_groups pg JOIN subjects s ON s.id=pg.subject_id JOIN users u ON u.id=pg.created_by
                LEFT JOIN peer_group_members m ON m.group_id=pg.id LEFT JOIN peer_posts p ON p.group_id=pg.id WHERE pg.subject_id IN (${ph}) AND pg.status<>'archived'
                GROUP BY pg.id,pg.group_name,pg.description,pg.max_members,pg.status,pg.created_at,pg.created_by,s.id,s.subject_code,s.subject_name,u.full_name ORDER BY pg.created_at DESC`,ids);}
        }else{
            [subjects]=await db.query(`SELECT s.id,s.subject_code,s.subject_name,c.course_name FROM subjects s JOIN courses c ON c.id=s.course_id WHERE s.is_active=1 AND c.is_active=1 ORDER BY c.course_name,s.subject_name`);
            [groups]=await db.query(`SELECT pg.id,pg.group_name,pg.description,pg.max_members,pg.status,pg.created_at,pg.created_by,s.id subject_id,s.subject_code,s.subject_name,c.course_name,u.full_name creator_name,
                COUNT(DISTINCT m.user_id) member_count,COUNT(DISTINCT p.id) post_count FROM peer_groups pg JOIN subjects s ON s.id=pg.subject_id JOIN courses c ON c.id=s.course_id JOIN users u ON u.id=pg.created_by
                LEFT JOIN peer_group_members m ON m.group_id=pg.id LEFT JOIN peer_posts p ON p.group_id=pg.id GROUP BY pg.id,pg.group_name,pg.description,pg.max_members,pg.status,pg.created_at,pg.created_by,s.id,s.subject_code,s.subject_name,c.course_name,u.full_name ORDER BY pg.created_at DESC`);
        }
        res.json({success:true,profile:profile?{courseName:profile.course_name,levelName:profile.level_name,domainName:profile.domain_name}:null,subjects,groups});
    }catch(e){console.error(e);res.status(500).json({success:false,message:"Unable to load Peer Groups"});}
});

router.post("/groups",authenticateUser,authorizeRoles("faculty","admin"),async(req,res)=>{
    const sid=Number(req.body.subjectId),name=clean(req.body.groupName),desc=clean(req.body.description),raw=req.body.maxMembers,max=raw==null||raw===''?null:Number(raw);
    if(!Number.isInteger(sid)||sid<=0||!name||(max!==null&&(!Number.isInteger(max)||max<2||max>500)))return res.status(400).json({success:false,message:"Subject, group name and valid member limit are required"});
    try{
        if(req.user.role==='faculty'&&!(await facultyCanSubject(req.user.userId,sid)))return res.status(403).json({success:false,message:"You can create groups only for assigned subjects"});
        const [r]=await db.query(`INSERT INTO peer_groups(subject_id,created_by,group_name,description,max_members,status) VALUES(?,?,?,?,?,'open')`,[sid,req.user.userId,name,desc||null,max]);
        await db.query(`INSERT IGNORE INTO peer_group_members(group_id,user_id,member_role) VALUES(?,?,'moderator')`,[r.insertId,req.user.userId]);
        res.status(201).json({success:true,message:"Peer Group created",groupId:r.insertId});
    }catch(e){if(e.code==='ER_DUP_ENTRY')return res.status(409).json({success:false,message:"A group with this name already exists for the subject"});console.error(e);res.status(500).json({success:false,message:"Unable to create Peer Group"});}
});

router.post("/groups/:id/join",authenticateUser,authorizeRoles("student"),async(req,res)=>{
    const id=Number(req.params.id);if(!Number.isInteger(id)||id<=0)return res.status(400).json({success:false,message:"Invalid Peer Group"});
    try{const g=await getGroup(id);if(!(await canAccess(req,g,false)))return res.status(403).json({success:false,message:"This Peer Group is not available for your course"});
        if(g.status!=='open')return res.status(400).json({success:false,message:"This Peer Group is not open for joining"});
        if(g.max_members){const [[c]]=await db.query(`SELECT COUNT(*) member_count FROM peer_group_members WHERE group_id=?`,[id]);if(Number(c.member_count)>=Number(g.max_members))return res.status(409).json({success:false,message:"This Peer Group is full"});}
        await db.query(`INSERT IGNORE INTO peer_group_members(group_id,user_id,member_role) VALUES(?,?,'member')`,[id,req.user.userId]);res.json({success:true,message:"Joined Peer Group"});
    }catch(e){console.error(e);res.status(500).json({success:false,message:"Unable to join Peer Group"});}
});
router.delete("/groups/:id/join",authenticateUser,authorizeRoles("student"),async(req,res)=>{try{await db.query(`DELETE FROM peer_group_members WHERE group_id=? AND user_id=? AND member_role='member'`,[Number(req.params.id),req.user.userId]);res.json({success:true,message:"Left Peer Group"});}catch(e){console.error(e);res.status(500).json({success:false,message:"Unable to leave Peer Group"});}});

router.patch("/groups/:id/status",authenticateUser,authorizeRoles("faculty","admin"),async(req,res)=>{
    const id=Number(req.params.id),status=clean(req.body.status).toLowerCase();if(!Number.isInteger(id)||id<=0||!["open","closed","archived"].includes(status))return res.status(400).json({success:false,message:"Invalid group status"});
    try{const g=await getGroup(id);if(!g)return res.status(404).json({success:false,message:"Peer Group not found"});
        if(req.user.role==='faculty'&&(Number(g.created_by)!==Number(req.user.userId)||status==='archived'))return res.status(403).json({success:false,message:"Faculty can open/close only groups they created"});
        await db.query(`UPDATE peer_groups SET status=? WHERE id=?`,[status,id]);res.json({success:true,message:`Peer Group ${status}`});
    }catch(e){console.error(e);res.status(500).json({success:false,message:"Unable to update Peer Group"});}
});

router.get("/groups/:id/posts",authenticateUser,authorizeRoles("student","faculty","admin"),async(req,res)=>{
    const id=Number(req.params.id);try{const g=await getGroup(id);if(!(await canAccess(req,g,req.user.role==='student')))return res.status(403).json({success:false,message:req.user.role==='student'?"Join this Peer Group to open discussions":"Peer Group access denied"});
        let q=`SELECT p.id,p.title,p.body,p.status,p.created_at,u.full_name author_name,r.role_name author_role FROM peer_posts p JOIN users u ON u.id=p.author_user_id JOIN roles r ON r.id=u.role_id WHERE p.group_id=?`;
        if(req.user.role!=='admin')q+=` AND p.status='visible'`;q+=` ORDER BY p.created_at DESC,p.id DESC`;const [posts]=await db.query(q,[id]);
        const ids=posts.map(x=>x.id);let comments=[];if(ids.length){const ph=ids.map(()=>'?').join(',');let cq=`SELECT c.id,c.post_id,c.body,c.status,c.created_at,u.full_name author_name,r.role_name author_role FROM peer_comments c JOIN users u ON u.id=c.author_user_id JOIN roles r ON r.id=u.role_id WHERE c.post_id IN (${ph})`;if(req.user.role!=='admin')cq+=` AND c.status='visible'`;cq+=` ORDER BY c.created_at,c.id`;[comments]=await db.query(cq,ids);}
        const map=new Map();for(const c of comments){const k=String(c.post_id);if(!map.has(k))map.set(k,[]);map.get(k).push(c);}res.json({success:true,group:g,posts:posts.map(p=>({...p,comments:map.get(String(p.id))||[]}))});
    }catch(e){console.error(e);res.status(500).json({success:false,message:"Unable to load discussions"});}
});

router.post("/groups/:id/posts",authenticateUser,authorizeRoles("student","faculty","admin"),async(req,res)=>{
    const id=Number(req.params.id),title=clean(req.body.title),body=clean(req.body.body);if(!title||!body)return res.status(400).json({success:false,message:"Discussion title and message are required"});
    try{const g=await getGroup(id);if(!(await canAccess(req,g,req.user.role==='student')))return res.status(403).json({success:false,message:"Peer Group access denied"});if(g.status==='archived'||(req.user.role==='student'&&g.status!=='open'))return res.status(400).json({success:false,message:"This Peer Group is read-only"});
        const [r]=await db.query(`INSERT INTO peer_posts(group_id,author_user_id,title,body,status) VALUES(?,?,?,?,'visible')`,[id,req.user.userId,title,body]);res.status(201).json({success:true,message:"Discussion posted",postId:r.insertId});
    }catch(e){console.error(e);res.status(500).json({success:false,message:"Unable to post discussion"});}
});

router.post("/posts/:id/comments",authenticateUser,authorizeRoles("student","faculty","admin"),async(req,res)=>{
    const id=Number(req.params.id),body=clean(req.body.body);if(!body)return res.status(400).json({success:false,message:"Reply text is required"});
    try{const [p]=await db.query(`SELECT group_id FROM peer_posts WHERE id=? LIMIT 1`,[id]);if(!p.length)return res.status(404).json({success:false,message:"Discussion not found"});const g=await getGroup(p[0].group_id);
        if(!(await canAccess(req,g,req.user.role==='student')))return res.status(403).json({success:false,message:"Peer Group access denied"});if(g.status==='archived'||(req.user.role==='student'&&g.status!=='open'))return res.status(400).json({success:false,message:"This Peer Group is read-only"});
        const [r]=await db.query(`INSERT INTO peer_comments(post_id,author_user_id,body,status) VALUES(?,?,?,'visible')`,[id,req.user.userId,body]);res.status(201).json({success:true,message:"Reply added",commentId:r.insertId});
    }catch(e){console.error(e);res.status(500).json({success:false,message:"Unable to add reply"});}
});

router.patch("/admin/posts/:id/status",authenticateUser,authorizeRoles("admin"),async(req,res)=>{const status=clean(req.body.status).toLowerCase();if(!["visible","hidden"].includes(status))return res.status(400).json({success:false,message:"Invalid moderation request"});try{await db.query(`UPDATE peer_posts SET status=? WHERE id=?`,[status,Number(req.params.id)]);res.json({success:true,message:`Discussion ${status}`});}catch(e){console.error(e);res.status(500).json({success:false,message:"Unable to moderate discussion"});}});
router.patch("/admin/comments/:id/status",authenticateUser,authorizeRoles("admin"),async(req,res)=>{const status=clean(req.body.status).toLowerCase();if(!["visible","hidden"].includes(status))return res.status(400).json({success:false,message:"Invalid moderation request"});try{await db.query(`UPDATE peer_comments SET status=? WHERE id=?`,[status,Number(req.params.id)]);res.json({success:true,message:`Reply ${status}`});}catch(e){console.error(e);res.status(500).json({success:false,message:"Unable to moderate reply"});}});

module.exports=router;
