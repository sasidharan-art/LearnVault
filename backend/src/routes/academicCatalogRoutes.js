const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const db = require("../config/db");
const authenticateUser = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

const router = express.Router();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }
});

const syllabusDirectory = path.join(__dirname, "../../../uploads/syllabi");
fs.mkdirSync(syllabusDirectory, { recursive: true });

function clean(value) {
    return String(value ?? "").trim();
}

function nullableNumber(value) {
    if (value === "" || value === null || value === undefined) return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

function bool(value, fallback = true) {
    if (value === undefined || value === null || value === "") return fallback;
    return value === true || value === 1 || value === "1" || String(value).toLowerCase() === "true";
}

function safeFileName(name) {
    return clean(name).replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "syllabus";
}

function parseCsv(text) {
    const rows = [];
    let row = [];
    let cell = "";
    let quoted = false;
    for (let i = 0; i < text.length; i += 1) {
        const ch = text[i];
        const next = text[i + 1];
        if (ch === '"') {
            if (quoted && next === '"') {
                cell += '"';
                i += 1;
            } else {
                quoted = !quoted;
            }
        } else if (ch === "," && !quoted) {
            row.push(cell);
            cell = "";
        } else if ((ch === "\n" || ch === "\r") && !quoted) {
            if (ch === "\r" && next === "\n") i += 1;
            row.push(cell);
            if (row.some(v => clean(v) !== "")) rows.push(row);
            row = [];
            cell = "";
        } else {
            cell += ch;
        }
    }
    if (cell.length || row.length) {
        row.push(cell);
        if (row.some(v => clean(v) !== "")) rows.push(row);
    }
    if (!rows.length) return [];
    const headers = rows.shift().map(h => clean(h).toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, ""));
    return rows.map(values => Object.fromEntries(headers.map((h, i) => [h, clean(values[i] || "")] )));
}

function normalizeImportRow(row) {
    const get = (...names) => {
        for (const name of names) {
            if (row[name] !== undefined && clean(row[name]) !== "") return clean(row[name]);
        }
        return "";
    };
    return {
        domainName: get("domain", "domain_name", "education_domain"),
        departmentCode: get("department_code", "dept_code"),
        departmentName: get("department", "department_name", "stream"),
        courseCode: get("course_code", "program_code"),
        courseName: get("course", "course_name", "program", "program_name"),
        structureType: get("structure_type", "structure") || "flexible",
        durationYears: get("duration_years", "duration"),
        levelName: get("level", "level_name", "year", "class"),
        levelOrder: get("level_order", "year_order"),
        semesterName: get("semester", "semester_name", "term"),
        semesterNumber: get("semester_number", "term_number"),
        subjectCode: get("subject_code", "code"),
        subjectName: get("subject", "subject_name"),
        credits: get("credits", "credit"),
        isCore: get("is_core", "core"),
        learningOutcomes: get("learning_outcomes", "outcomes"),
        resourceRequirements: get("resource_requirements", "resources")
    };
}

async function catalogSnapshot() {
    const [domains] = await db.query(`SELECT id, domain_name, is_active, created_at FROM education_domains ORDER BY domain_name`);
    const [departments] = await db.query(`SELECT id, domain_id, department_code, department_name, is_active, created_at FROM departments ORDER BY department_name`);
    const [courses] = await db.query(`
        SELECT c.id, c.domain_id, c.department_id, c.course_code, c.course_name,
               c.duration_years, c.structure_type, c.is_active, c.created_at,
               ed.domain_name, d.department_name, d.department_code
        FROM courses c
        LEFT JOIN education_domains ed ON ed.id=c.domain_id
        LEFT JOIN departments d ON d.id=c.department_id
        ORDER BY ed.domain_name, d.department_name, c.course_name
    `);
    const [levels] = await db.query(`
        SELECT cl.id, cl.course_id, cl.level_name, cl.level_order, cl.is_active,
               c.course_code, c.course_name
        FROM course_levels cl JOIN courses c ON c.id=cl.course_id
        ORDER BY c.course_name, cl.level_order, cl.level_name
    `);
    const [semesters] = await db.query(`
        SELECT cs.id, cs.course_id, cs.course_level_id, cs.semester_name,
               cs.semester_number, cs.is_active, c.course_code, cl.level_name
        FROM course_semesters cs
        JOIN courses c ON c.id=cs.course_id
        LEFT JOIN course_levels cl ON cl.id=cs.course_level_id
        ORDER BY c.course_name, cl.level_order, cs.semester_number, cs.semester_name
    `);
    const [subjects] = await db.query(`
        SELECT s.id, s.course_id, s.course_level_id, s.subject_code, s.subject_name,
               s.study_year, s.semester, s.level_name, s.is_active,
               c.course_code, c.course_name, cl.level_name AS mapped_level_name
        FROM subjects s
        JOIN courses c ON c.id=s.course_id
        LEFT JOIN course_levels cl ON cl.id=s.course_level_id
        ORDER BY c.course_name, COALESCE(cl.level_order,999), s.subject_name
    `);
    const [curricula] = await db.query(`
        SELECT cv.id, cv.course_id, cv.course_level_id, cv.curriculum_name,
               cv.version_code, cv.academic_year_label, cv.status,
               cv.syllabus_file_url, cv.syllabus_file_name, cv.notes,
               cv.created_at, cv.updated_at,
               c.course_code, c.course_name, cl.level_name
        FROM curriculum_versions cv
        JOIN courses c ON c.id=cv.course_id
        LEFT JOIN course_levels cl ON cl.id=cv.course_level_id
        ORDER BY c.course_name, cv.academic_year_label DESC, cv.version_code
    `);
    const [curriculumSubjects] = await db.query(`
        SELECT cs.id, cs.curriculum_id, cs.subject_id, cs.semester_id,
               cs.credits, cs.is_core, cs.learning_outcomes, cs.resource_requirements,
               s.subject_code, s.subject_name, cv.curriculum_name
        FROM curriculum_subjects cs
        JOIN subjects s ON s.id=cs.subject_id
        JOIN curriculum_versions cv ON cv.id=cs.curriculum_id
        ORDER BY cv.id, s.subject_name
    `);
    return { domains, departments, courses, levels, semesters, subjects, curricula, curriculumSubjects };
}

router.get("/catalog", authenticateUser, authorizeRoles("admin"), async (req, res) => {
    try {
        const catalog = await catalogSnapshot();
        return res.json({ success: true, catalog });
    } catch (error) {
        console.error("Academic catalog snapshot error:", error);
        return res.status(500).json({ success: false, message: "Unable to load academic catalog" });
    }
});

router.patch("/catalog/:entity/:id", authenticateUser, authorizeRoles("admin"), async (req, res) => {
    const entity = clean(req.params.entity).toLowerCase();
    const id = Number(req.params.id);
    const maps = {
        domains: { table: "education_domains", fields: { domainName: "domain_name", isActive: "is_active" } },
        departments: { table: "departments", fields: { domainId: "domain_id", departmentCode: "department_code", departmentName: "department_name", isActive: "is_active" } },
        courses: { table: "courses", fields: { domainId: "domain_id", departmentId: "department_id", courseCode: "course_code", courseName: "course_name", durationYears: "duration_years", structureType: "structure_type", isActive: "is_active" } },
        levels: { table: "course_levels", fields: { courseId: "course_id", levelName: "level_name", levelOrder: "level_order", isActive: "is_active" } },
        semesters: { table: "course_semesters", fields: { courseId: "course_id", courseLevelId: "course_level_id", semesterName: "semester_name", semesterNumber: "semester_number", isActive: "is_active" } },
        subjects: { table: "subjects", fields: { courseId: "course_id", courseLevelId: "course_level_id", subjectCode: "subject_code", subjectName: "subject_name", isActive: "is_active" } }
    };
    const config = maps[entity];
    if (!config || !Number.isInteger(id) || id <= 0) return res.status(400).json({ success: false, message: "Invalid catalog item" });

    const assignments = [];
    for (const [input, column] of Object.entries(config.fields)) {
        if (req.body[input] !== undefined) {
            let value = req.body[input];
            if (input === "isActive") value = bool(value) ? 1 : 0;
            if (["domainId","departmentId","courseId","courseLevelId","levelOrder","semesterNumber"].includes(input)) value = nullableNumber(value);
            if (input === "durationYears") value = nullableNumber(value);
            if (["departmentCode","courseCode","subjectCode"].includes(input)) value = clean(value).toUpperCase();
            if (["domainName","departmentName","courseName","levelName","semesterName","subjectName"].includes(input)) value = clean(value);
            assignments.push(`${column} = ?`);
            assignments.push(value);
        }
    }
    if (!assignments.length) return res.status(400).json({ success: false, message: "No editable fields supplied" });

    const setSql = assignments.filter((_, i) => i % 2 === 0).join(", ");
    const values = assignments.filter((_, i) => i % 2 === 1);
    values.push(id);
    try {
        const [result] = await db.query(`UPDATE ${config.table} SET ${setSql} WHERE id = ?`, values);
        if (!result.affectedRows) return res.status(404).json({ success: false, message: "Catalog item not found" });
        return res.json({ success: true, message: "Academic catalog item updated" });
    } catch (error) {
        if (error.code === "ER_DUP_ENTRY") return res.status(409).json({ success: false, message: "An item with the same code or name already exists" });
        console.error("Academic catalog update error:", error);
        return res.status(500).json({ success: false, message: "Unable to update academic catalog item" });
    }
});

router.post("/catalog/courses/:courseId/duplicate", authenticateUser, authorizeRoles("admin"), async (req, res) => {
    const sourceId = Number(req.params.courseId);
    if (!Number.isInteger(sourceId) || sourceId <= 0) return res.status(400).json({ success: false, message: "Invalid source course" });
    const suffix = clean(req.body.codeSuffix) || `COPY-${Date.now().toString().slice(-6)}`;
    const requestedCode = clean(req.body.courseCode).toUpperCase() || null;
    const requestedName = clean(req.body.courseName) || null;
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const [[source]] = await connection.query(`SELECT * FROM courses WHERE id=?`, [sourceId]);
        if (!source) throw Object.assign(new Error("Source course not found"), { statusCode: 404 });
        const newCode = requestedCode || `${source.course_code}-${suffix}`.slice(0, 80);
        const newName = requestedName || `${source.course_name} Copy`;
        const [courseResult] = await connection.query(`INSERT INTO courses (domain_id,department_id,course_code,course_name,duration_years,structure_type,is_active) VALUES (?,?,?,?,?,?,1)`, [source.domain_id,source.department_id,newCode,newName,source.duration_years,source.structure_type]);
        const newCourseId = courseResult.insertId;
        const [levels] = await connection.query(`SELECT * FROM course_levels WHERE course_id=? ORDER BY level_order,id`, [sourceId]);
        const levelMap = new Map();
        for (const level of levels) {
            const [r] = await connection.query(`INSERT INTO course_levels (course_id,level_name,level_order,is_active) VALUES (?,?,?,?)`, [newCourseId,level.level_name,level.level_order,level.is_active]);
            levelMap.set(level.id, r.insertId);
        }
        const [semesters] = await connection.query(`SELECT * FROM course_semesters WHERE course_id=? ORDER BY id`, [sourceId]);
        const semesterMap = new Map();
        for (const semester of semesters) {
            const [r] = await connection.query(`INSERT INTO course_semesters (course_id,course_level_id,semester_name,semester_number,is_active) VALUES (?,?,?,?,?)`, [newCourseId, levelMap.get(semester.course_level_id) || null, semester.semester_name, semester.semester_number, semester.is_active]);
            semesterMap.set(semester.id, r.insertId);
        }
        const [subjects] = await connection.query(`SELECT * FROM subjects WHERE course_id=?`, [sourceId]);
        const subjectMap = new Map();
        for (const subject of subjects) {
            const code = `${subject.subject_code}-${suffix}`.slice(0, 100);
            const [r] = await connection.query(`INSERT INTO subjects (course_id,course_level_id,subject_code,subject_name,study_year,semester,level_name,is_active) VALUES (?,?,?,?,?,?,?,?)`, [newCourseId,levelMap.get(subject.course_level_id) || null,code,subject.subject_name,subject.study_year,subject.semester,subject.level_name,subject.is_active]);
            subjectMap.set(subject.id, r.insertId);
        }
        const [curricula] = await connection.query(`SELECT * FROM curriculum_versions WHERE course_id=?`, [sourceId]);
        for (const curriculum of curricula) {
            const [cr] = await connection.query(`INSERT INTO curriculum_versions (course_id,course_level_id,curriculum_name,version_code,academic_year_label,status,syllabus_file_url,syllabus_file_name,notes,created_by) VALUES (?,?,?,?,?,?,?,?,?,?)`, [newCourseId,levelMap.get(curriculum.course_level_id) || null,`${curriculum.curriculum_name} Copy`,`${curriculum.version_code}-${suffix}`,curriculum.academic_year_label,curriculum.status,curriculum.syllabus_file_url,curriculum.syllabus_file_name,curriculum.notes,req.user.id]);
            const [mapped] = await connection.query(`SELECT * FROM curriculum_subjects WHERE curriculum_id=?`, [curriculum.id]);
            for (const item of mapped) {
                await connection.query(`INSERT INTO curriculum_subjects (curriculum_id,subject_id,semester_id,credits,is_core,learning_outcomes,resource_requirements) VALUES (?,?,?,?,?,?,?)`, [cr.insertId,subjectMap.get(item.subject_id),semesterMap.get(item.semester_id) || null,item.credits,item.is_core,item.learning_outcomes,item.resource_requirements]);
            }
        }
        await connection.query(`INSERT INTO course_clone_history (source_course_id,cloned_course_id,cloned_by) VALUES (?,?,?)`, [sourceId,newCourseId,req.user.id]);
        await connection.commit();
        return res.status(201).json({ success:true, message:"Course cloned successfully", courseId:newCourseId });
    } catch (error) {
        await connection.rollback();
        console.error("Course clone error:", error);
        return res.status(error.statusCode || 500).json({ success:false, message:error.code === "ER_DUP_ENTRY" ? "The cloned course code already exists" : error.message || "Unable to clone course" });
    } finally { connection.release(); }
});

router.post("/catalog/courses/:courseId/semesters", authenticateUser, authorizeRoles("admin"), async (req, res) => {
    const courseId = Number(req.params.courseId);
    const courseLevelId = nullableNumber(req.body.courseLevelId);
    const semesterName = clean(req.body.semesterName);
    const semesterNumber = nullableNumber(req.body.semesterNumber);
    if (!courseId || !semesterName) return res.status(400).json({ success:false,message:"Course and semester name are required" });
    try {
        const [r] = await db.query(`INSERT INTO course_semesters (course_id,course_level_id,semester_name,semester_number,is_active) VALUES (?,?,?,?,1)`, [courseId,courseLevelId,semesterName,semesterNumber]);
        return res.status(201).json({ success:true,message:"Semester added",semesterId:r.insertId });
    } catch(error) {
        if(error.code === "ER_DUP_ENTRY") return res.status(409).json({success:false,message:"This semester already exists for the selected level"});
        console.error("Add semester error:",error); return res.status(500).json({success:false,message:"Unable to add semester"});
    }
});

router.post("/catalog/curricula", authenticateUser, authorizeRoles("admin"), async (req,res)=>{
    const courseId=Number(req.body.courseId), courseLevelId=nullableNumber(req.body.courseLevelId);
    const curriculumName=clean(req.body.curriculumName), versionCode=clean(req.body.versionCode).toUpperCase();
    const academicYearLabel=clean(req.body.academicYearLabel), status=clean(req.body.status)||"draft", notes=clean(req.body.notes);
    if(!courseId||!curriculumName||!versionCode) return res.status(400).json({success:false,message:"Course, curriculum name and version code are required"});
    if(!["draft","active","archived"].includes(status)) return res.status(400).json({success:false,message:"Invalid curriculum status"});
    try{
        const [r]=await db.query(`INSERT INTO curriculum_versions (course_id,course_level_id,curriculum_name,version_code,academic_year_label,status,notes,created_by) VALUES (?,?,?,?,?,?,?,?)`,[courseId,courseLevelId,curriculumName,versionCode,academicYearLabel,status,notes,req.user.id]);
        return res.status(201).json({success:true,message:"Curriculum version created",curriculumId:r.insertId});
    }catch(error){
        if(error.code==="ER_DUP_ENTRY") return res.status(409).json({success:false,message:"This curriculum version already exists for the course"});
        console.error("Curriculum create error:",error); return res.status(500).json({success:false,message:"Unable to create curriculum version"});
    }
});

router.patch("/catalog/curricula/:id/status", authenticateUser, authorizeRoles("admin"), async(req,res)=>{
    const id=Number(req.params.id), status=clean(req.body.status);
    if(!id||!["draft","active","archived"].includes(status)) return res.status(400).json({success:false,message:"Valid curriculum and status are required"});
    try{const [r]=await db.query(`UPDATE curriculum_versions SET status=? WHERE id=?`,[status,id]); if(!r.affectedRows)return res.status(404).json({success:false,message:"Curriculum not found"}); return res.json({success:true,message:`Curriculum marked ${status}`});}catch(error){console.error(error);return res.status(500).json({success:false,message:"Unable to update curriculum status"});}
});

router.post("/catalog/curricula/:id/subjects", authenticateUser, authorizeRoles("admin"), async(req,res)=>{
    const curriculumId=Number(req.params.id), subjectId=Number(req.body.subjectId), semesterId=nullableNumber(req.body.semesterId);
    if(!curriculumId||!subjectId)return res.status(400).json({success:false,message:"Curriculum and subject are required"});
    try{
        const [r]=await db.query(`INSERT INTO curriculum_subjects (curriculum_id,subject_id,semester_id,credits,is_core,learning_outcomes,resource_requirements) VALUES (?,?,?,?,?,?,?)`,[curriculumId,subjectId,semesterId,nullableNumber(req.body.credits),bool(req.body.isCore,true)?1:0,clean(req.body.learningOutcomes),clean(req.body.resourceRequirements)]);
        return res.status(201).json({success:true,message:"Subject curriculum configuration saved",mappingId:r.insertId});
    }catch(error){if(error.code==="ER_DUP_ENTRY")return res.status(409).json({success:false,message:"Subject is already mapped to this curriculum"});console.error(error);return res.status(500).json({success:false,message:"Unable to configure curriculum subject"});}
});

router.patch("/catalog/curriculum-subjects/:id", authenticateUser, authorizeRoles("admin"), async(req,res)=>{
    const id=Number(req.params.id); if(!id)return res.status(400).json({success:false,message:"Invalid curriculum subject"});
    const fields={semesterId:"semester_id",credits:"credits",isCore:"is_core",learningOutcomes:"learning_outcomes",resourceRequirements:"resource_requirements"};
    const parts=[],values=[]; for(const [k,col] of Object.entries(fields)){if(req.body[k]!==undefined){parts.push(`${col}=?`);values.push(k==="semesterId"||k==="credits"?nullableNumber(req.body[k]):k==="isCore"?(bool(req.body[k])?1:0):clean(req.body[k]));}}
    if(!parts.length)return res.status(400).json({success:false,message:"No configuration supplied"}); values.push(id);
    try{const [r]=await db.query(`UPDATE curriculum_subjects SET ${parts.join(",")} WHERE id=?`,values);if(!r.affectedRows)return res.status(404).json({success:false,message:"Curriculum subject not found"});return res.json({success:true,message:"Curriculum subject updated"});}catch(error){console.error(error);return res.status(500).json({success:false,message:"Unable to update curriculum subject"});}
});

router.post("/catalog/curricula/:id/syllabus", authenticateUser, authorizeRoles("admin"), upload.single("file"), async(req,res)=>{
    const id=Number(req.params.id); if(!id||!req.file)return res.status(400).json({success:false,message:"Curriculum and syllabus file are required"});
    const ext=path.extname(req.file.originalname||"").toLowerCase();
    if(![".pdf",".doc",".docx"].includes(ext)) return res.status(400).json({success:false,message:"Syllabus must be PDF, DOC or DOCX"});
    const fileName=`${Date.now()}-${crypto.randomUUID()}-${safeFileName(req.file.originalname)}`;
    const target=path.join(syllabusDirectory,fileName);
    try{
        fs.writeFileSync(target,req.file.buffer);
        const url=`/uploads/syllabi/${fileName}`;
        const [r]=await db.query(`UPDATE curriculum_versions SET syllabus_file_url=?, syllabus_file_name=? WHERE id=?`,[url,req.file.originalname,id]);
        if(!r.affectedRows){fs.unlinkSync(target);return res.status(404).json({success:false,message:"Curriculum not found"});}
        return res.json({success:true,message:"Syllabus uploaded",url,fileName:req.file.originalname});
    }catch(error){try{fs.unlinkSync(target);}catch{} console.error(error);return res.status(500).json({success:false,message:"Unable to upload syllabus"});}
});

router.get("/catalog/import-template", authenticateUser, authorizeRoles("admin"), (req,res)=>{
    const csv=[
        "domain,department_code,department_name,course_code,course_name,structure_type,duration_years,level_name,level_order,semester_name,semester_number,subject_code,subject_name,credits,is_core,learning_outcomes,resource_requirements",
        "Engineering,CSE,Computer Science and Engineering,BTECH-CSE,B.Tech,year_semester,4,Year 1,1,Semester 1,1,CSE101,Engineering Mathematics I,4,1,Apply mathematical concepts to engineering problems,Notes;Videos;Question Bank"
    ].join("\n");
    res.setHeader("Content-Type","text/csv; charset=utf-8");
    res.setHeader("Content-Disposition","attachment; filename=learnvault-academic-catalog-template.csv");
    return res.send(csv);
});

router.post("/catalog/import", authenticateUser, authorizeRoles("admin"), upload.single("file"), async(req,res)=>{
    if(!req.file)return res.status(400).json({success:false,message:"CSV or Excel file is required"});
    const original=clean(req.file.originalname); const ext=path.extname(original).toLowerCase();
    if(![".csv",".xlsx",".xls"].includes(ext))return res.status(400).json({success:false,message:"Use CSV, XLSX or XLS"});
    let rows=[];
    try{
        if(ext===".csv") rows=parseCsv(req.file.buffer.toString("utf8"));
        else {
            let XLSX; try{XLSX=require("xlsx");}catch{ return res.status(503).json({success:false,message:"Excel import requires the xlsx package. Run npm install in backend and try again."}); }
            const workbook=XLSX.read(req.file.buffer,{type:"buffer"});
            const first=workbook.Sheets[workbook.SheetNames[0]];
            rows=XLSX.utils.sheet_to_json(first,{defval:""}).map(row=>Object.fromEntries(Object.entries(row).map(([k,v])=>[String(k).toLowerCase().replace(/\s+/g,"_").replace(/[^a-z0-9_]/g,""),clean(v)])));
        }
        const normalized=rows.map(normalizeImportRow).filter(r=>r.domainName||r.courseCode||r.subjectName);
        if(!normalized.length)return res.status(400).json({success:false,message:"The import file contains no usable rows"});
        const [log]=await db.query(`INSERT INTO catalog_imports (file_name,file_type,status,imported_by) VALUES (?,?, 'processing',?)`,[original,ext.slice(1),req.user.id]);
        const importId=log.insertId;
        const connection=await db.getConnection();
        const counts={domains:0,departments:0,courses:0,levels:0,semesters:0,subjects:0};
        try{
            await connection.beginTransaction();
            for(const [index,row] of normalized.entries()){
                if(!row.domainName||!row.courseCode||!row.courseName) throw new Error(`Row ${index+2}: domain, course_code and course_name are required`);
                const [domainRows]=await connection.query(`SELECT id FROM education_domains WHERE domain_name=? LIMIT 1`,[row.domainName]);
                let domainId=domainRows[0]?.id;
                if(!domainId){const [r]=await connection.query(`INSERT INTO education_domains (domain_name,is_active) VALUES (?,1)`,[row.domainName]);domainId=r.insertId;counts.domains++;}
                let departmentId=null;
                if(row.departmentCode||row.departmentName){
                    if(!row.departmentCode||!row.departmentName)throw new Error(`Row ${index+2}: both department_code and department_name are required`);
                    const [dr]=await connection.query(`SELECT id FROM departments WHERE department_code=? LIMIT 1`,[row.departmentCode.toUpperCase()]);
                    departmentId=dr[0]?.id;
                    if(!departmentId){const [r]=await connection.query(`INSERT INTO departments (domain_id,department_code,department_name,is_active) VALUES (?,?,?,1)`,[domainId,row.departmentCode.toUpperCase(),row.departmentName]);departmentId=r.insertId;counts.departments++;}
                }
                const [cr]=await connection.query(`SELECT id FROM courses WHERE course_code=? LIMIT 1`,[row.courseCode.toUpperCase()]);
                let courseId=cr[0]?.id;
                if(!courseId){const [r]=await connection.query(`INSERT INTO courses (domain_id,department_id,course_code,course_name,duration_years,structure_type,is_active) VALUES (?,?,?,?,?,?,1)`,[domainId,departmentId, row.courseCode.toUpperCase(),row.courseName,nullableNumber(row.durationYears),["year_semester","grade","module","exam","flexible"].includes(row.structureType)?row.structureType:"flexible"]);courseId=r.insertId;counts.courses++;}
                let levelId=null;
                if(row.levelName){const [lr]=await connection.query(`SELECT id FROM course_levels WHERE course_id=? AND level_name=? LIMIT 1`,[courseId,row.levelName]);levelId=lr[0]?.id;if(!levelId){const [r]=await connection.query(`INSERT INTO course_levels (course_id,level_name,level_order,is_active) VALUES (?,?,?,1)`,[courseId,row.levelName,Number(row.levelOrder)||1]);levelId=r.insertId;counts.levels++;}}
                let semesterId=null;
                if(row.semesterName){const [sr]=await connection.query(`SELECT id FROM course_semesters WHERE course_id=? AND course_level_id <=> ? AND semester_name=? LIMIT 1`,[courseId,levelId,row.semesterName]);semesterId=sr[0]?.id;if(!semesterId){const [r]=await connection.query(`INSERT INTO course_semesters (course_id,course_level_id,semester_name,semester_number,is_active) VALUES (?,?,?,?,1)`,[courseId,levelId,row.semesterName,nullableNumber(row.semesterNumber)]);semesterId=r.insertId;counts.semesters++;}}
                if(row.subjectCode&&row.subjectName){
                    const [sr]=await connection.query(`SELECT id FROM subjects WHERE subject_code=? LIMIT 1`,[row.subjectCode.toUpperCase()]);
                    let subjectId=sr[0]?.id;
                    if(!subjectId){const [r]=await connection.query(`INSERT INTO subjects (course_id,course_level_id,subject_code,subject_name,study_year,semester,level_name,is_active) VALUES (?,?,?,?,?,?,?,1)`,[courseId,levelId,row.subjectCode.toUpperCase(),row.subjectName,nullableNumber(row.levelOrder),nullableNumber(row.semesterNumber),row.levelName]);subjectId=r.insertId;counts.subjects++;}
                    let [cv]=await connection.query(`SELECT id FROM curriculum_versions WHERE course_id=? AND version_code='IMPORTED-2026-27' LIMIT 1`,[courseId]);
                    let curriculumId=cv[0]?.id;
                    if(!curriculumId){const [r]=await connection.query(`INSERT INTO curriculum_versions (course_id,curriculum_name,version_code,academic_year_label,status,created_by) VALUES (?,?,?,?, 'active',?)`,[courseId,`Imported Curriculum - ${row.courseName}`,"IMPORTED-2026-27","2026-27",req.user.id]);curriculumId=r.insertId;}
                    await connection.query(`INSERT IGNORE INTO curriculum_subjects (curriculum_id,subject_id,semester_id,credits,is_core,learning_outcomes,resource_requirements) VALUES (?,?,?,?,?,?,?)`,[curriculumId,subjectId,semesterId,nullableNumber(row.credits),bool(row.isCore,true)?1:0,row.learningOutcomes,row.resourceRequirements]);
                }
            }
            await connection.commit();
            await db.query(`UPDATE catalog_imports SET status='completed',imported_rows=?,created_domains=?,created_departments=?,created_courses=?,created_levels=?,created_semesters=?,created_subjects=?,completed_at=CURRENT_TIMESTAMP WHERE id=?`,[normalized.length,counts.domains,counts.departments,counts.courses,counts.levels,counts.semesters,counts.subjects,importId]);
            return res.status(201).json({success:true,message:"Academic catalog imported successfully",importId,rows:normalized.length,counts});
        }catch(error){
            await connection.rollback();
            await db.query(`UPDATE catalog_imports SET status='failed',imported_rows=?,error_report=?,completed_at=CURRENT_TIMESTAMP WHERE id=?`,[normalized.length,error.message||"Import failed",importId]);
            return res.status(400).json({success:false,message:error.message||"Academic catalog import failed"});
        }finally{connection.release();}
    }catch(error){console.error("Academic catalog import error:",error);return res.status(500).json({success:false,message:"Unable to process academic catalog import"});}
});

router.get("/catalog/imports", authenticateUser, authorizeRoles("admin"), async(req,res)=>{
    try{const [rows]=await db.query(`SELECT * FROM catalog_imports ORDER BY created_at DESC LIMIT 30`);return res.json({success:true,imports:rows});}catch(error){console.error(error);return res.status(500).json({success:false,message:"Unable to load import history"});}
});

module.exports = router;
