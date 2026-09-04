const express = require("express");
const db = require("../config/db");
const authenticateUser = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");
const router = express.Router();

const clean = (v) => String(v ?? "").trim();
const norm = (v) => clean(v).toLowerCase().replace(/\s+/g, " ");


function normalizeQuestionType(value) {
    const type =
        clean(value)
            .toLowerCase();

    return [
        "mcq",
        "true_false",
        "short_answer"
    ].includes(type)
        ? type
        : null;
}


function normalizeDifficulty(value) {
    const difficulty =
        clean(value)
            .toLowerCase();

    return [
        "easy",
        "medium",
        "hard"
    ].includes(difficulty)
        ? difficulty
        : "medium";
}


function validateInlineQuestion(body) {
    const subjectId =
        Number(body.subjectId);

    const rawUnitId =
        body.unitId;

    const unitId =
        rawUnitId === null ||
        rawUnitId === undefined ||
        rawUnitId === ""
            ? null
            : Number(rawUnitId);

    const questionType =
        normalizeQuestionType(
            body.questionType
        );

    const questionText =
        clean(
            body.questionText
        );

    const correctAnswer =
        clean(
            body.correctAnswer
        );

    const explanation =
        clean(
            body.explanation
        );

    const difficulty =
        normalizeDifficulty(
            body.difficulty
        );

    const marks =
        Number(
            body.marks || 1
        );

    const options =
        Array.isArray(
            body.options
        )
            ? body.options
            : [];


    if (
        !Number.isInteger(subjectId) ||
        subjectId <= 0 ||
        !questionType ||
        !questionText
    ) {
        return {
            ok: false,
            message:
                "Subject, question type and question text are required"
        };
    }


    if (
        unitId !== null &&
        (
            !Number.isInteger(unitId) ||
            unitId <= 0
        )
    ) {
        return {
            ok: false,
            message:
                "Invalid unit"
        };
    }


    if (
        !Number.isFinite(marks) ||
        marks <= 0 ||
        marks > 100
    ) {
        return {
            ok: false,
            message:
                "Marks must be between 0 and 100"
        };
    }


    let normalizedOptions = [];


    if (
        questionType === "mcq"
    ) {
        normalizedOptions =
            options
                .map(
                    (
                        option,
                        index
                    ) => ({
                        label:
                            clean(
                                option.label ||
                                String.fromCharCode(
                                    65 + index
                                )
                            )
                                .toUpperCase(),

                        text:
                            clean(
                                option.text
                            ),

                        isCorrect:
                            Boolean(
                                option.isCorrect
                            ),

                        order:
                            index + 1
                    })
                )
                .filter(
                    (option) =>
                        option.text
                );


        if (
            normalizedOptions.length < 2 ||
            normalizedOptions.length > 6
        ) {
            return {
                ok: false,
                message:
                    "MCQ requires 2 to 6 options"
            };
        }


        if (
            normalizedOptions.filter(
                (option) =>
                    option.isCorrect
            ).length !== 1
        ) {
            return {
                ok: false,
                message:
                    "MCQ requires exactly one correct option"
            };
        }
    }


    if (
        questionType === "true_false" &&
        ![
            "true",
            "false"
        ].includes(
            correctAnswer.toLowerCase()
        )
    ) {
        return {
            ok: false,
            message:
                "True / False question requires true or false as the correct answer"
        };
    }


    if (
        questionType === "short_answer" &&
        !correctAnswer
    ) {
        return {
            ok: false,
            message:
                "Short Answer question requires a correct answer"
        };
    }


    return {
        ok: true,

        question: {
            subjectId,
            unitId,
            questionType,
            questionText,
            correctAnswer:
                questionType === "mcq"
                    ? null
                    : correctAnswer,
            explanation:
                explanation ||
                null,
            difficulty,
            marks,
            options:
                normalizedOptions
        }
    };
}


async function insertInlineQuestionOptions(
    connection,
    questionId,
    options
) {
    for (
        const option of options
    ) {
        await connection.query(
            `
            INSERT INTO question_options
            (
                question_id,
                option_label,
                option_text,
                is_correct,
                option_order
            )
            VALUES (?, ?, ?, ?, ?)
            `,
            [
                questionId,
                option.label,
                option.text,
                option.isCorrect
                    ? 1
                    : 0,
                option.order
            ]
        );
    }
}


async function studentProfile(userId) {
    const [rows] = await db.query(`
        SELECT sp.user_id, sp.course_id, sp.course_level_id,
               c.course_code, c.course_name, cl.level_name,
               d.department_name, ed.domain_name
        FROM student_profiles sp
        JOIN courses c ON c.id = sp.course_id
        LEFT JOIN course_levels cl ON cl.id = sp.course_level_id
        LEFT JOIN departments d ON d.id = c.department_id
        LEFT JOIN education_domains ed ON ed.id = c.domain_id
        WHERE sp.user_id = ? AND c.is_active = 1
        LIMIT 1`, [userId]);
    return rows[0] || null;
}

function levelClause(profile, alias = "s") {
    return profile.course_level_id
        ? { sql: `AND (${alias}.course_level_id IS NULL OR ${alias}.course_level_id = ?)`, values: [profile.course_level_id] }
        : { sql: `AND ${alias}.course_level_id IS NULL`, values: [] };
}

async function canUseSubject(userId, role, subjectId) {
    if (role === "admin") {
        const [r] = await db.query(`SELECT s.id FROM subjects s JOIN courses c ON c.id=s.course_id WHERE s.id=? AND s.is_active=1 AND c.is_active=1 LIMIT 1`, [subjectId]);
        return r.length > 0;
    }
    const [r] = await db.query(`
        SELECT s.id FROM faculty_subject_assignments fsa
        JOIN subjects s ON s.id=fsa.subject_id
        JOIN courses c ON c.id=s.course_id
        WHERE fsa.faculty_user_id=? AND fsa.subject_id=? AND fsa.is_active=1 AND s.is_active=1 AND c.is_active=1 LIMIT 1`,
        [userId, subjectId]);
    return r.length > 0;
}

async function validUnit(subjectId, unitId) {
    if (unitId === null) return true;
    const [r] = await db.query(`SELECT id FROM subject_units WHERE id=? AND subject_id=? AND is_active=1 LIMIT 1`, [unitId, subjectId]);
    return r.length > 0;
}

async function builderSubjects(userId, role) {
    if (role === "admin") {
        const [r] = await db.query(`
            SELECT s.id,s.subject_code,s.subject_name,c.course_name,cl.level_name
            FROM subjects s JOIN courses c ON c.id=s.course_id
            LEFT JOIN course_levels cl ON cl.id=s.course_level_id
            WHERE s.is_active=1 AND c.is_active=1
            ORDER BY c.course_name,cl.level_order,s.subject_name`);
        return r;
    }
    const [r] = await db.query(`
        SELECT s.id,s.subject_code,s.subject_name,c.course_name,cl.level_name
        FROM faculty_subject_assignments fsa
        JOIN subjects s ON s.id=fsa.subject_id
        JOIN courses c ON c.id=s.course_id
        LEFT JOIN course_levels cl ON cl.id=s.course_level_id
        WHERE fsa.faculty_user_id=? AND fsa.is_active=1 AND s.is_active=1 AND c.is_active=1
        ORDER BY c.course_name,cl.level_order,s.subject_name`, [userId]);
    return r;
}

router.get("/builder/meta", authenticateUser, authorizeRoles("faculty", "admin"), async (req,res)=>{
    try {
        const subjects = await builderSubjects(req.user.userId, req.user.role);
        const ids = subjects.map(s=>s.id); let units=[];
        if (ids.length) {
            const ph = ids.map(()=>"?").join(",");
            [units] = await db.query(`SELECT id,subject_id,unit_name,unit_order FROM subject_units WHERE subject_id IN (${ph}) AND is_active=1 ORDER BY subject_id,unit_order,unit_name`, ids);
        }
        res.json({success:true,subjects,units});
    } catch(e) { console.error(e); res.status(500).json({success:false,message:"Unable to load Quiz Builder"}); }
});

router.get(
    "/builder/questions",
    authenticateUser,
    authorizeRoles(
        "faculty",
        "admin"
    ),
    async (req, res) => {

        const subjectId =
            Number(
                req.query.subjectId
            );

        const unitId =
            Number(
                req.query.unitId
            );


        if (
            !Number.isInteger(subjectId) ||
            subjectId <= 0
        ) {
            return res
                .status(400)
                .json({
                    success: false,
                    message:
                        "Select a subject"
                });
        }


        try {

            if (
                !(
                    await canUseSubject(
                        req.user.userId,
                        req.user.role,
                        subjectId
                    )
                )
            ) {
                return res
                    .status(403)
                    .json({
                        success: false,
                        message:
                            "Subject access denied"
                    });
            }


            let sql =
                `
                SELECT
                    q.id,
                    q.question_type,
                    q.question_text,
                    q.difficulty,
                    q.marks,
                    q.unit_id,
                    q.verification_status,
                    q.created_by,

                    su.unit_name

                FROM question_bank q

                LEFT JOIN subject_units su
                    ON su.id = q.unit_id

                WHERE
                    q.subject_id = ?
                    AND q.is_active = 1
                `;


            const values = [
                subjectId
            ];


            sql +=
                `
                AND q.verification_status = 'approved'
                `;


            if (
                Number.isInteger(unitId) &&
                unitId > 0
            ) {
                sql +=
                    `
                    AND q.unit_id = ?
                    `;

                values.push(
                    unitId
                );
            }


            sql +=
                `
                ORDER BY
                    CASE
                        WHEN q.verification_status = 'pending'
                        THEN 1
                        ELSE 2
                    END,
                    su.unit_order,
                    q.created_at DESC
                `;


            const [questions] =
                await db.query(
                    sql,
                    values
                );


            return res.json({
                success: true,
                count:
                    questions.length,
                questions
            });


        } catch (error) {

            console.error(
                "Quiz builder questions error:",
                error
            );


            return res
                .status(500)
                .json({
                    success: false,
                    message:
                        "Unable to load Quiz Builder questions"
                });

        }

    }
);


/* =====================================================
   FACULTY / ADMIN: CREATE QUESTION DIRECTLY IN QUIZ BUILDER

   Faculty-created questions publish immediately for the
   Faculty's assigned subject. Admin retains oversight.
===================================================== */

router.post(
    "/builder/questions",
    authenticateUser,
    authorizeRoles(
        "faculty",
        "admin"
    ),
    async (req, res) => {

        const parsed =
            validateInlineQuestion(
                req.body
            );


        if (!parsed.ok) {
            return res
                .status(400)
                .json({
                    success: false,
                    message:
                        parsed.message
                });
        }


        const question =
            parsed.question;

        let connection;


        try {

            if (
                !(
                    await canUseSubject(
                        req.user.userId,
                        req.user.role,
                        question.subjectId
                    )
                )
            ) {
                return res
                    .status(403)
                    .json({
                        success: false,
                        message:
                            "You cannot add questions to this subject"
                    });
            }


            if (
                !(
                    await validUnit(
                        question.subjectId,
                        question.unitId
                    )
                )
            ) {
                return res
                    .status(400)
                    .json({
                        success: false,
                        message:
                            "Selected unit does not belong to this subject"
                    });
            }


            connection =
                await db.getConnection();


            await connection.beginTransaction();


            const isAdmin =
                req.user.role ===
                "admin";

            const verificationStatus =
                "approved";


            const [result] =
                await connection.query(
                    `
                    INSERT INTO question_bank
                    (
                        subject_id,
                        unit_id,
                        created_by,
                        question_type,
                        question_text,
                        correct_answer,
                        explanation,
                        difficulty,
                        marks,
                        verification_status,
                        verified_by,
                        verified_at,
                        is_active
                    )
                    VALUES
                    (
                        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1
                    )
                    `,
                    [
                        question.subjectId,
                        question.unitId,
                        req.user.userId,
                        question.questionType,
                        question.questionText,
                        question.correctAnswer,
                        question.explanation,
                        question.difficulty,
                        question.marks,
                        verificationStatus,
                        isAdmin
                            ? req.user.userId
                            : null,
                        new Date()
                    ]
                );


            if (
                question.questionType ===
                "mcq"
            ) {
                await insertInlineQuestionOptions(
                    connection,
                    result.insertId,
                    question.options
                );
            }


            await connection.commit();


            return res
                .status(201)
                .json({
                    success: true,

                    message:
                        isAdmin
                            ? "Question created and published"
                            : "Question created and published for this assigned subject.",

                    question: {
                        id:
                            result.insertId,
                        questionType:
                            question.questionType,
                        questionText:
                            question.questionText,
                        difficulty:
                            question.difficulty,
                        marks:
                            question.marks,
                        unitId:
                            question.unitId,
                        verificationStatus
                    }
                });


        } catch (error) {

            if (connection) {
                try {
                    await connection.rollback();
                } catch (_) {}
            }


            console.error(
                "Inline quiz question error:",
                error
            );


            return res
                .status(500)
                .json({
                    success: false,
                    message:
                        "Unable to add quiz question"
                });


        } finally {

            if (connection) {
                connection.release();
            }

        }

    }
);


router.post("/", authenticateUser, authorizeRoles("faculty","admin"), async (req,res)=>{
    const subjectId=Number(req.body.subjectId), rawUnit=req.body.unitId;
    const unitId=(rawUnit===null||rawUnit===undefined||rawUnit==="")?null:Number(rawUnit);
    const title=clean(req.body.title), description=clean(req.body.description);
    const time=Number(req.body.timeLimitMinutes||15), pass=Number(req.body.passPercentage||50), max=Number(req.body.maxAttempts||1);
    const questionIds=[...new Set((Array.isArray(req.body.questionIds)?req.body.questionIds:[]).map(Number).filter(n=>Number.isInteger(n)&&n>0))];
    if(!Number.isInteger(subjectId)||subjectId<=0||!title) return res.status(400).json({success:false,message:"Subject and title are required"});
    if(!Number.isInteger(time)||time<1||time>240) return res.status(400).json({success:false,message:"Time limit must be 1-240 minutes"});
    if(!Number.isFinite(pass)||pass<0||pass>100) return res.status(400).json({success:false,message:"Pass percentage must be 0-100"});
    if(!Number.isInteger(max)||max<1||max>20) return res.status(400).json({success:false,message:"Max attempts must be 1-20"});
    if(!questionIds.length) return res.status(400).json({success:false,message:"Select or add at least one quiz question"});
    let conn;
    try {
        if(!(await canUseSubject(req.user.userId,req.user.role,subjectId))) return res.status(403).json({success:false,message:"Subject access denied"});
        if(!(await validUnit(subjectId,unitId))) return res.status(400).json({success:false,message:"Invalid unit for this subject"});
        const ph =
            questionIds
                .map(
                    () => "?"
                )
                .join(",");


        let sql =
            `
            SELECT
                id,
                verification_status,
                created_by

            FROM question_bank

            WHERE
                id IN (${ph})
                AND subject_id = ?
                AND is_active = 1
            `;


        const vals = [
            ...questionIds,
            subjectId
        ];


        if (
            unitId !== null
        ) {
            sql +=
                `
                AND unit_id = ?
                `;

            vals.push(
                unitId
            );
        }


        const [candidateQuestions] =
            await db.query(
                sql,
                vals
            );


        const valid =
            candidateQuestions.filter(
                (question) =>
                    question.verification_status ===
                    "approved"
            );


        if (
            valid.length !==
            questionIds.length
        ) {
            return res
                .status(400)
                .json({
                    success: false,
                    message:
                        "Selected questions must be published and belong to this subject/unit."
                });
        }
        conn=await db.getConnection();
        await conn.beginTransaction();

        const isAdmin=req.user.role==="admin";
        const status="approved";
        const published=1;

        const [r]=await conn.query(
            `INSERT INTO quizzes(
                subject_id,unit_id,created_by,title,description,
                time_limit_minutes,pass_percentage,max_attempts,
                verification_status,is_published,verified_by,verified_at
            ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,
            [
                subjectId,unitId,req.user.userId,title,description||null,
                time,pass,max,status,published,
                isAdmin?req.user.userId:null,
                new Date()
            ]
        );

        for(let i=0;i<questionIds.length;i++) {
            await conn.query(
                `INSERT INTO quiz_questions(quiz_id,question_id,question_order)
                 VALUES(?,?,?)`,
                [r.insertId,questionIds[i],i+1]
            );
        }

        await conn.commit();

        res.status(201).json({
            success:true,
            quizId:r.insertId,
            message:"Quiz published to matching students"
        });
    } catch(e){if(conn){try{await conn.rollback();}catch(_){}}console.error(e);res.status(500).json({success:false,message:"Unable to create quiz"});}
    finally{if(conn)conn.release();}
});

router.get("/mine", authenticateUser, authorizeRoles("faculty","admin"), async (req,res)=>{
    try{
        const [quizzes]=await db.query(`
            SELECT q.id,q.title,q.description,q.time_limit_minutes,q.pass_percentage,q.max_attempts,q.verification_status,q.is_published,q.created_at,
                   s.subject_code,s.subject_name,su.unit_name,
                   (SELECT COUNT(*) FROM quiz_questions x WHERE x.quiz_id=q.id) question_count,
                   (SELECT COALESCE(SUM(COALESCE(x.marks_override,qb.marks)),0) FROM quiz_questions x JOIN question_bank qb ON qb.id=x.question_id WHERE x.quiz_id=q.id) total_marks
            FROM quizzes q JOIN subjects s ON s.id=q.subject_id LEFT JOIN subject_units su ON su.id=q.unit_id
            WHERE q.created_by=? ORDER BY q.created_at DESC`,[req.user.userId]);
        res.json({success:true,count:quizzes.length,quizzes});
    }catch(e){console.error(e);res.status(500).json({success:false,message:"Unable to load your quizzes"});}
});


/* FACULTY / ADMIN QUIZ PUBLICATION CONTROL */
router.patch(
    "/:id/publication",
    authenticateUser,
    authorizeRoles("faculty", "admin"),
    async (req, res) => {
        const quizId = Number(req.params.id);
        const isPublished =
            req.body.isPublished === true ||
            req.body.isPublished === 1 ||
            req.body.isPublished === "1";

        if (!Number.isInteger(quizId) || quizId <= 0) {
            return res.status(400).json({success:false,message:"Invalid quiz"});
        }

        try {
            const [rows] = await db.query(
                `SELECT id, created_by FROM quizzes WHERE id=? LIMIT 1`,
                [quizId]
            );

            if (!rows.length) {
                return res.status(404).json({success:false,message:"Quiz not found"});
            }

            if (
                req.user.role === "faculty" &&
                Number(rows[0].created_by) !== Number(req.user.userId)
            ) {
                return res.status(403).json({
                    success:false,
                    message:"You can control only your own quizzes"
                });
            }

            await db.query(
                `UPDATE quizzes
                 SET verification_status=?,
                     is_published=?,
                     verified_by=?,
                     verified_at=NOW()
                 WHERE id=?`,
                [
                    isPublished ? "approved" : "rejected",
                    isPublished ? 1 : 0,
                    req.user.role === "admin" ? req.user.userId : null,
                    quizId
                ]
            );

            return res.json({
                success:true,
                message:isPublished ? "Quiz published" : "Quiz unpublished"
            });
        } catch (error) {
            console.error("Quiz publication error:", error);
            return res.status(500).json({
                success:false,
                message:"Unable to update quiz publication"
            });
        }
    }
);


router.delete("/:id", authenticateUser, authorizeRoles("faculty","admin"), async (req,res)=>{
    const id=Number(req.params.id); if(!Number.isInteger(id)||id<=0) return res.status(400).json({success:false,message:"Invalid quiz"});
    try{
        const [r]=await db.query(`SELECT created_by FROM quizzes WHERE id=? LIMIT 1`,[id]); if(!r.length)return res.status(404).json({success:false,message:"Quiz not found"});
        if(req.user.role==="faculty"&&Number(r[0].created_by)!==Number(req.user.userId)) return res.status(403).json({success:false,message:"You can delete only your own quizzes"});
        const [[c]]=await db.query(`SELECT COUNT(*) count FROM quiz_attempts WHERE quiz_id=?`,[id]); if(Number(c.count)>0)return res.status(409).json({success:false,message:"Quiz has attempts and cannot be deleted"});
        await db.query(`DELETE FROM quizzes WHERE id=?`,[id]); res.json({success:true,message:"Quiz deleted"});
    }catch(e){console.error(e);res.status(500).json({success:false,message:"Unable to delete quiz"});}
});

router.get("/admin", authenticateUser, authorizeRoles("admin"), async (req,res)=>{
    try{
        const status=clean(req.query.status).toLowerCase(), search=clean(req.query.search); let where="1=1",vals=[];
        if(["pending","approved","rejected"].includes(status)){where+=` AND q.verification_status=?`;vals.push(status);}
        if(search){const t=`%${search}%`;where+=` AND (q.title LIKE ? OR s.subject_name LIKE ? OR s.subject_code LIKE ? OR u.full_name LIKE ?)`;vals.push(t,t,t,t);}
        const [quizzes]=await db.query(`
            SELECT q.id,q.title,q.description,q.time_limit_minutes,q.pass_percentage,q.max_attempts,q.verification_status,q.is_published,q.created_at,
                   s.subject_code,s.subject_name,su.unit_name,u.full_name creator_name,
                   (SELECT COUNT(*) FROM quiz_questions x WHERE x.quiz_id=q.id) question_count,
                   (
                       SELECT COUNT(*)
                       FROM quiz_questions x
                       JOIN question_bank qb2 ON qb2.id=x.question_id
                       WHERE x.quiz_id=q.id
                         AND qb2.verification_status='pending'
                   ) pending_question_count,
                   (SELECT COUNT(*) FROM quiz_attempts a WHERE a.quiz_id=q.id) attempt_count
            FROM quizzes q JOIN subjects s ON s.id=q.subject_id LEFT JOIN subject_units su ON su.id=q.unit_id JOIN users u ON u.id=q.created_by
            WHERE ${where} ORDER BY CASE q.verification_status WHEN 'pending' THEN 1 WHEN 'approved' THEN 2 ELSE 3 END,q.created_at DESC`,vals);
        res.json({success:true,count:quizzes.length,quizzes});
    }catch(e){console.error(e);res.status(500).json({success:false,message:"Unable to load quizzes"});}
});

router.patch(
    "/admin/:id/verification",
    authenticateUser,
    authorizeRoles(
        "admin"
    ),
    async (req, res) => {

        const id =
            Number(
                req.params.id
            );

        const status =
            clean(
                req.body.status
            )
                .toLowerCase();


        if (
            !Number.isInteger(id) ||
            id <= 0 ||
            ![
                "approved",
                "rejected"
            ].includes(
                status
            )
        ) {
            return res
                .status(400)
                .json({
                    success: false,
                    message:
                        "Invalid request"
                });
        }


        let connection;


        try {

            const [quizRows] =
                await db.query(
                    `
                    SELECT
                        id,
                        created_by

                    FROM quizzes

                    WHERE id = ?

                    LIMIT 1
                    `,
                    [
                        id
                    ]
                );


            if (
                quizRows.length === 0
            ) {
                return res
                    .status(404)
                    .json({
                        success: false,
                        message:
                            "Quiz not found"
                    });
            }


            connection =
                await db.getConnection();


            await connection.beginTransaction();


            let approvedQuestionCount = 0;


            if (
                status ===
                "approved"
            ) {
                const [questionResult] =
                    await connection.query(
                        `
                        UPDATE question_bank qb

                        INNER JOIN quiz_questions qq
                            ON qq.question_id = qb.id

                        SET
                            qb.verification_status = 'approved',
                            qb.verified_by = ?,
                            qb.verified_at = NOW()

                        WHERE
                            qq.quiz_id = ?
                            AND qb.verification_status = 'pending'
                            AND qb.created_by = ?
                        `,
                        [
                            req.user.userId,
                            id,
                            quizRows[0].created_by
                        ]
                    );


                approvedQuestionCount =
                    Number(
                        questionResult.affectedRows ||
                        0
                    );
            }


            await connection.query(
                `
                UPDATE quizzes

                SET
                    verification_status = ?,
                    verified_by = ?,
                    verified_at = NOW(),
                    is_published = ?

                WHERE id = ?
                `,
                [
                    status,
                    req.user.userId,
                    status === "approved"
                        ? 1
                        : 0,
                    id
                ]
            );


            await connection.commit();


            if (
                status ===
                "approved"
            ) {
                return res.json({
                    success: true,

                    approvedQuestionCount,

                    message:
                        approvedQuestionCount > 0
                            ? `Quiz approved and published. ${approvedQuestionCount} new quiz question${approvedQuestionCount === 1 ? "" : "s"} approved with it.`
                            : "Quiz approved and published"
                });
            }


            return res.json({
                success: true,
                message:
                    "Quiz rejected"
            });


        } catch (error) {

            if (connection) {
                try {
                    await connection.rollback();
                } catch (_) {}
            }


            console.error(
                "Quiz verification error:",
                error
            );


            return res
                .status(500)
                .json({
                    success: false,
                    message:
                        "Unable to update quiz"
                });


        } finally {

            if (connection) {
                connection.release();
            }

        }

    }
);

router.patch("/admin/:id/publish", authenticateUser, authorizeRoles("admin"), async (req,res)=>{
    const id=Number(req.params.id),published=req.body.isPublished===true||req.body.isPublished===1||req.body.isPublished==="1";
    try{const [q]=await db.query(`SELECT verification_status FROM quizzes WHERE id=? LIMIT 1`,[id]);if(!q.length)return res.status(404).json({success:false,message:"Quiz not found"});if(published&&q[0].verification_status!=="approved")return res.status(400).json({success:false,message:"Only approved quizzes can be published"});await db.query(`UPDATE quizzes SET is_published=? WHERE id=?`,[published?1:0,id]);res.json({success:true,message:published?"Quiz published":"Quiz unpublished"});}catch(e){console.error(e);res.status(500).json({success:false,message:"Unable to change publication"});}
});

router.get("/student", authenticateUser, authorizeRoles("student"), async (req,res)=>{
    try{
        const p=await studentProfile(req.user.userId); if(!p)return res.status(400).json({success:false,message:"Your student course profile is not configured"}); const lvl=levelClause(p,"s");
        const [quizzes]=await db.query(`
            SELECT q.id,q.title,q.description,q.time_limit_minutes,q.pass_percentage,q.max_attempts,s.subject_code,s.subject_name,su.unit_name,
                   (SELECT COUNT(*) FROM quiz_questions x WHERE x.quiz_id=q.id) question_count,
                   (SELECT COUNT(*) FROM quiz_attempts a WHERE a.quiz_id=q.id AND a.student_user_id=?) attempts_used,
                   (SELECT MAX(a.percentage) FROM quiz_attempts a WHERE a.quiz_id=q.id AND a.student_user_id=? AND a.status='submitted') best_percentage
            FROM quizzes q JOIN subjects s ON s.id=q.subject_id JOIN courses c ON c.id=s.course_id LEFT JOIN subject_units su ON su.id=q.unit_id
            WHERE q.verification_status='approved' AND q.is_published=1 AND s.is_active=1 AND c.is_active=1 AND s.course_id=? ${lvl.sql}
            ORDER BY q.created_at DESC`,[req.user.userId,req.user.userId,p.course_id,...lvl.values]);
        res.json({success:true,profile:{courseName:p.course_name,levelName:p.level_name,domainName:p.domain_name,departmentName:p.department_name},count:quizzes.length,quizzes});
    }catch(e){console.error(e);res.status(500).json({success:false,message:"Unable to load quizzes"});}
});

async function accessibleQuiz(studentId,quizId){const p=await studentProfile(studentId);if(!p)return {profile:null,quiz:null};const lvl=levelClause(p,"s");const [r]=await db.query(`SELECT q.id,q.title,q.description,q.time_limit_minutes,q.pass_percentage,q.max_attempts,s.subject_code,s.subject_name,su.unit_name FROM quizzes q JOIN subjects s ON s.id=q.subject_id JOIN courses c ON c.id=s.course_id LEFT JOIN subject_units su ON su.id=q.unit_id WHERE q.id=? AND q.verification_status='approved' AND q.is_published=1 AND s.is_active=1 AND c.is_active=1 AND s.course_id=? ${lvl.sql} LIMIT 1`,[quizId,p.course_id,...lvl.values]);return {profile:p,quiz:r[0]||null};}

async function attemptPayload(attemptId,studentId){
    const [a]=await db.query(`SELECT qa.id attempt_id,qa.quiz_id,qa.attempt_number,qa.status,qa.started_at,q.title,q.description,q.time_limit_minutes,q.pass_percentage,q.max_attempts,s.subject_code,s.subject_name,su.unit_name FROM quiz_attempts qa JOIN quizzes q ON q.id=qa.quiz_id JOIN subjects s ON s.id=q.subject_id LEFT JOIN subject_units su ON su.id=q.unit_id WHERE qa.id=? AND qa.student_user_id=? LIMIT 1`,[attemptId,studentId]); if(!a.length)return null; const at=a[0];
    const [qs]=await db.query(`SELECT qb.id,qb.question_type,qb.question_text,qb.difficulty,COALESCE(qq.marks_override,qb.marks) marks,qq.question_order FROM quiz_questions qq JOIN question_bank qb ON qb.id=qq.question_id WHERE qq.quiz_id=? ORDER BY qq.question_order`,[at.quiz_id]);
    const mcq=qs.filter(q=>q.question_type==="mcq").map(q=>q.id); let opts=[]; if(mcq.length){const ph=mcq.map(()=>"?").join(",");[opts]=await db.query(`SELECT id,question_id,option_label,option_text,option_order FROM question_options WHERE question_id IN (${ph}) ORDER BY question_id,option_order`,mcq);} const om=new Map(); for(const o of opts){const k=String(o.question_id);if(!om.has(k))om.set(k,[]);om.get(k).push({id:o.id,label:o.option_label,text:o.option_text});}
    const expiresAt=new Date(new Date(at.started_at).getTime()+Number(at.time_limit_minutes)*60000).toISOString();
    return {attempt:{id:at.attempt_id,quizId:at.quiz_id,attemptNumber:at.attempt_number,status:at.status,startedAt:at.started_at,expiresAt},quiz:{id:at.quiz_id,title:at.title,description:at.description,timeLimitMinutes:at.time_limit_minutes,passPercentage:at.pass_percentage,maxAttempts:at.max_attempts,subjectCode:at.subject_code,subjectName:at.subject_name,unitName:at.unit_name},questions:qs.map(q=>({id:q.id,questionType:q.question_type,questionText:q.question_text,difficulty:q.difficulty,marks:q.marks,options:om.get(String(q.id))||[]}))};
}

router.post("/student/:id/start", authenticateUser, authorizeRoles("student"), async (req,res)=>{
    const id=Number(req.params.id); try{const {profile,quiz}=await accessibleQuiz(req.user.userId,id);if(!profile)return res.status(400).json({success:false,message:"Your student course profile is not configured"});if(!quiz)return res.status(404).json({success:false,message:"Quiz is not available"});const [ex]=await db.query(`SELECT id FROM quiz_attempts WHERE quiz_id=? AND student_user_id=? AND status='in_progress' ORDER BY id DESC LIMIT 1`,[id,req.user.userId]);if(ex.length){const p=await attemptPayload(ex[0].id,req.user.userId);return res.json({success:true,resumed:true,...p});}const [[c]]=await db.query(`SELECT COUNT(*) count FROM quiz_attempts WHERE quiz_id=? AND student_user_id=?`,[id,req.user.userId]);const n=Number(c.count)+1;if(n>Number(quiz.max_attempts))return res.status(409).json({success:false,message:"Maximum attempts reached"});const [r]=await db.query(`INSERT INTO quiz_attempts(quiz_id,student_user_id,attempt_number,status) VALUES(?,?,?,'in_progress')`,[id,req.user.userId,n]);const p=await attemptPayload(r.insertId,req.user.userId);res.status(201).json({success:true,resumed:false,...p});}catch(e){console.error(e);res.status(500).json({success:false,message:"Unable to start quiz"});}
});

router.get("/student/attempts/:id", authenticateUser, authorizeRoles("student"), async (req,res)=>{try{const p=await attemptPayload(Number(req.params.id),req.user.userId);if(!p)return res.status(404).json({success:false,message:"Attempt not found"});if(p.attempt.status!=="in_progress")return res.status(409).json({success:false,message:"Attempt already submitted"});res.json({success:true,...p});}catch(e){console.error(e);res.status(500).json({success:false,message:"Unable to load attempt"});}});

router.post("/student/attempts/:id/submit", authenticateUser, authorizeRoles("student"), async (req,res)=>{
    const attemptId=Number(req.params.id), answers=Array.isArray(req.body.answers)?req.body.answers:[]; let conn;
    try{
        const [ar]=await db.query(`SELECT qa.id,qa.quiz_id,qa.status,q.pass_percentage FROM quiz_attempts qa JOIN quizzes q ON q.id=qa.quiz_id WHERE qa.id=? AND qa.student_user_id=? LIMIT 1`,[attemptId,req.user.userId]);if(!ar.length)return res.status(404).json({success:false,message:"Attempt not found"});const a=ar[0];if(a.status!=="in_progress")return res.status(409).json({success:false,message:"Attempt already submitted"});
        const [qs]=await db.query(`SELECT qb.id,qb.question_type,qb.correct_answer,COALESCE(qq.marks_override,qb.marks) marks FROM quiz_questions qq JOIN question_bank qb ON qb.id=qq.question_id WHERE qq.quiz_id=? ORDER BY qq.question_order`,[a.quiz_id]);const map=new Map(answers.map(x=>[String(Number(x.questionId)),x]));conn=await db.getConnection();await conn.beginTransaction();let score=0,total=0;
        for(const q of qs){const marks=Number(q.marks||0);total+=marks;const x=map.get(String(q.id))||{};let opt=null,text=null,ok=false;if(q.question_type==="mcq"){opt=Number(x.selectedOptionId);if(!Number.isInteger(opt)||opt<=0)opt=null;if(opt!==null){const [o]=await conn.query(`SELECT is_correct FROM question_options WHERE id=? AND question_id=? LIMIT 1`,[opt,q.id]);ok=o.length&&Number(o[0].is_correct)===1;}}else{text=clean(x.answerText);ok=Boolean(text)&&norm(text)===norm(q.correct_answer);}const award=ok?marks:0;score+=award;await conn.query(`INSERT INTO quiz_attempt_answers(attempt_id,question_id,selected_option_id,answer_text,is_correct,marks_awarded) VALUES(?,?,?,?,?,?) ON DUPLICATE KEY UPDATE selected_option_id=VALUES(selected_option_id),answer_text=VALUES(answer_text),is_correct=VALUES(is_correct),marks_awarded=VALUES(marks_awarded)`,[attemptId,q.id,opt,text,ok?1:0,award]);}
        const pct=total?Number(((score/total)*100).toFixed(2)):0;await conn.query(`UPDATE quiz_attempts SET status='submitted',submitted_at=NOW(),score=?,total_marks=?,percentage=? WHERE id=?`,[score,total,pct,attemptId]);await conn.commit();res.json({success:true,message:"Quiz submitted",result:{attemptId,score,totalMarks:total,percentage:pct,passPercentage:Number(a.pass_percentage),passed:pct>=Number(a.pass_percentage)}});
    }catch(e){if(conn){try{await conn.rollback();}catch(_){}}console.error(e);res.status(500).json({success:false,message:"Unable to submit quiz"});}finally{if(conn)conn.release();}
});

router.get("/student/attempts/:id/result", authenticateUser, authorizeRoles("student"), async (req,res)=>{
    const id=Number(req.params.id);try{const [a]=await db.query(`SELECT qa.id,qa.quiz_id,qa.attempt_number,qa.status,qa.score,qa.total_marks,qa.percentage,qa.started_at,qa.submitted_at,q.title,q.description,q.pass_percentage,q.time_limit_minutes,s.subject_code,s.subject_name,su.unit_name FROM quiz_attempts qa JOIN quizzes q ON q.id=qa.quiz_id JOIN subjects s ON s.id=q.subject_id LEFT JOIN subject_units su ON su.id=q.unit_id WHERE qa.id=? AND qa.student_user_id=? LIMIT 1`,[id,req.user.userId]);if(!a.length)return res.status(404).json({success:false,message:"Result not found"});const at=a[0];if(at.status!=="submitted")return res.status(409).json({success:false,message:"Submit quiz first"});const [rows]=await db.query(`SELECT qb.id question_id,qb.question_type,qb.question_text,qb.correct_answer,qb.explanation,COALESCE(qq.marks_override,qb.marks) marks,qaa.selected_option_id,qaa.answer_text,qaa.is_correct,qaa.marks_awarded,qo.option_label selected_label,qo.option_text selected_text FROM quiz_attempt_answers qaa JOIN question_bank qb ON qb.id=qaa.question_id JOIN quiz_questions qq ON qq.quiz_id=? AND qq.question_id=qb.id LEFT JOIN question_options qo ON qo.id=qaa.selected_option_id WHERE qaa.attempt_id=? ORDER BY qq.question_order`,[at.quiz_id,id]);const details=[];for(const r of rows){let correct=r.correct_answer||"";if(r.question_type==="mcq"){const [c]=await db.query(`SELECT option_label,option_text FROM question_options WHERE question_id=? AND is_correct=1 ORDER BY option_order LIMIT 1`,[r.question_id]);correct=c.length?`${c[0].option_label} — ${c[0].option_text}`:"-";}details.push({questionId:r.question_id,questionType:r.question_type,questionText:r.question_text,marks:Number(r.marks),marksAwarded:Number(r.marks_awarded),isCorrect:Boolean(r.is_correct),studentAnswer:r.question_type==="mcq"?(r.selected_option_id?`${r.selected_label} — ${r.selected_text}`:"Not answered"):(r.answer_text||"Not answered"),correctAnswer:correct,explanation:r.explanation});}res.json({success:true,result:{attemptId:at.id,attemptNumber:at.attempt_number,title:at.title,description:at.description,subjectCode:at.subject_code,subjectName:at.subject_name,unitName:at.unit_name,timeLimitMinutes:at.time_limit_minutes,score:Number(at.score),totalMarks:Number(at.total_marks),percentage:Number(at.percentage),passPercentage:Number(at.pass_percentage),passed:Number(at.percentage)>=Number(at.pass_percentage),answers:details}});}catch(e){console.error(e);res.status(500).json({success:false,message:"Unable to load result"});}
});

router.get("/student/history", authenticateUser, authorizeRoles("student"), async (req,res)=>{try{const [attempts]=await db.query(`SELECT qa.id attempt_id,qa.attempt_number,qa.status,qa.score,qa.total_marks,qa.percentage,qa.started_at,qa.submitted_at,q.id quiz_id,q.title,q.pass_percentage,s.subject_code,s.subject_name FROM quiz_attempts qa JOIN quizzes q ON q.id=qa.quiz_id JOIN subjects s ON s.id=q.subject_id WHERE qa.student_user_id=? ORDER BY qa.started_at DESC`,[req.user.userId]);res.json({success:true,count:attempts.length,attempts});}catch(e){console.error(e);res.status(500).json({success:false,message:"Unable to load history"});}});

module.exports = router;
