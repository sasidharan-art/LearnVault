const express = require("express");
const bcrypt = require("bcrypt");

const db = require("../config/db");

const authenticateUser =
    require("../middleware/authMiddleware");

const authorizeRoles =
    require("../middleware/roleMiddleware");


const router =
    express.Router();


function usernameBase(fullName) {

    return (
        String(fullName || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "")
            .slice(0, 38)
        ||
        "faculty"
    );

}


async function uniqueUsername(
    connection,
    fullName
) {

    const base =
        usernameBase(fullName);

    let username =
        base;

    let number =
        2;


    while (true) {

        const [rows] =
            await connection.query(
                `
                SELECT id
                FROM users
                WHERE username = ?
                LIMIT 1
                `,
                [username]
            );


        if (rows.length === 0) {
            return username;
        }


        const suffix =
            String(number);

        username =
            `${base.slice(
                0,
                Math.max(
                    1,
                    50 - suffix.length
                )
            )}${suffix}`;

        number += 1;

    }

}


/* =====================================================
   ADMIN OVERVIEW
===================================================== */

router.get(
    "/overview",
    authenticateUser,
    authorizeRoles("admin"),
    async (req, res) => {

        try {

            const [[userCounts]] =
                await db.query(
                    `
                    SELECT
                        COUNT(*) AS total_users,

                        SUM(
                            CASE
                                WHEN r.role_name = 'student'
                                THEN 1
                                ELSE 0
                            END
                        ) AS students,

                        SUM(
                            CASE
                                WHEN r.role_name = 'faculty'
                                THEN 1
                                ELSE 0
                            END
                        ) AS faculty,

                        SUM(
                            CASE
                                WHEN r.role_name = 'admin'
                                THEN 1
                                ELSE 0
                            END
                        ) AS admins

                    FROM users u

                    INNER JOIN roles r
                        ON u.role_id = r.id
                    `
                );


            const [[academicCounts]] =
                await db.query(
                    `
                    SELECT
                        (
                            SELECT COUNT(*)
                            FROM education_domains
                            WHERE is_active = 1
                        ) AS active_domains,

                        (
                            SELECT COUNT(*)
                            FROM departments
                            WHERE is_active = 1
                        ) AS active_departments,

                        (
                            SELECT COUNT(*)
                            FROM courses
                            WHERE is_active = 1
                        ) AS active_courses,

                        (
                            SELECT COUNT(*)
                            FROM course_levels
                            WHERE is_active = 1
                        ) AS active_levels
                    `
                );


            const [[resourceCounts]] =
                await db.query(
                    `
                    SELECT
                        COUNT(*) AS total_resources,

                        SUM(
                            verification_status = 'pending'
                        ) AS pending_resources,

                        SUM(
                            verification_status = 'approved'
                        ) AS approved_resources,

                        SUM(
                            verification_status = 'rejected'
                        ) AS rejected_resources

                    FROM resources
                    `
                );


            return res.json({
                success: true,

                overview: {
                    ...userCounts,
                    ...academicCounts,
                    ...resourceCounts
                }
            });


        } catch (error) {

            console.error(
                "Admin overview error:",
                error
            );


            return res
                .status(500)
                .json({
                    success: false,
                    message:
                        "Unable to load Admin overview"
                });

        }

    }
);


/* =====================================================
   USERS
===================================================== */

router.get(
    "/users",
    authenticateUser,
    authorizeRoles("admin"),
    async (req, res) => {

        try {

            const search =
                String(
                    req.query.search || ""
                ).trim();

            const role =
                String(
                    req.query.role || ""
                )
                    .trim()
                    .toLowerCase();

            const status =
                String(
                    req.query.status || ""
                )
                    .trim()
                    .toLowerCase();


            let sql = `
                SELECT
                    u.id,
                    u.full_name,
                    u.username,
                    u.email,
                    u.phone,
                    u.status,
                    u.created_at,

                    r.role_name,

                    sp.course_id,
                    sp.course_level_id,

                    c.course_name,
                    cl.level_name,

                    fp.department
                        AS faculty_department,

                    fp.designation

                FROM users u

                INNER JOIN roles r
                    ON u.role_id = r.id

                LEFT JOIN student_profiles sp
                    ON sp.user_id = u.id

                LEFT JOIN courses c
                    ON sp.course_id = c.id

                LEFT JOIN course_levels cl
                    ON sp.course_level_id = cl.id

                LEFT JOIN faculty_profiles fp
                    ON fp.user_id = u.id

                WHERE 1 = 1
            `;


            const values = [];


            if (search) {

                const term =
                    `%${search}%`;

                sql += `
                    AND
                    (
                        u.full_name LIKE ?
                        OR u.username LIKE ?
                        OR u.email LIKE ?
                        OR u.phone LIKE ?
                        OR CAST(u.id AS CHAR) LIKE ?
                    )
                `;

                values.push(
                    term,
                    term,
                    term,
                    term,
                    term
                );

            }


            if (
                ["student", "faculty", "admin"]
                    .includes(role)
            ) {

                sql += `
                    AND r.role_name = ?
                `;

                values.push(role);

            }


            if (
                ["active", "inactive"]
                    .includes(status)
            ) {

                sql += `
                    AND u.status = ?
                `;

                values.push(status);

            }


            sql += `
                ORDER BY
                    u.created_at DESC,
                    u.id DESC
            `;


            const [users] =
                await db.query(
                    sql,
                    values
                );


            return res.json({
                success: true,
                count: users.length,
                users
            });


        } catch (error) {

            console.error(
                "Admin users error:",
                error
            );


            return res
                .status(500)
                .json({
                    success: false,
                    message:
                        "Unable to load users"
                });

        }

    }
);


/* =====================================================
   ACTIVATE / DEACTIVATE USER
===================================================== */

router.patch(
    "/users/:id/status",
    authenticateUser,
    authorizeRoles("admin"),
    async (req, res) => {

        const userId =
            Number(req.params.id);

        const status =
            String(
                req.body.status || ""
            )
                .trim()
                .toLowerCase();


        if (
            !Number.isInteger(userId) ||
            userId <= 0 ||
            !["active", "inactive"]
                .includes(status)
        ) {

            return res
                .status(400)
                .json({
                    success: false,
                    message:
                        "Invalid user status request"
                });

        }


        if (
            Number(req.user.userId) ===
            userId &&
            status === "inactive"
        ) {

            return res
                .status(400)
                .json({
                    success: false,
                    message:
                        "You cannot deactivate your own Admin account"
                });

        }


        try {

            const [result] =
                await db.query(
                    `
                    UPDATE users
                    SET status = ?
                    WHERE id = ?
                    `,
                    [
                        status,
                        userId
                    ]
                );


            if (
                result.affectedRows === 0
            ) {

                return res
                    .status(404)
                    .json({
                        success: false,
                        message:
                            "User not found"
                    });

            }


            return res.json({
                success: true,
                message:
                    `User ${status === "active" ? "activated" : "deactivated"}`
            });


        } catch (error) {

            console.error(
                "Update user status error:",
                error
            );


            return res
                .status(500)
                .json({
                    success: false,
                    message:
                        "Unable to update user status"
                });

        }

    }
);


/* =====================================================
   CREATE FACULTY
===================================================== */

router.post(
    "/faculty",
    authenticateUser,
    authorizeRoles("admin"),
    async (req, res) => {

        const fullName =
            String(
                req.body.fullName || ""
            ).trim();

        const email =
            String(
                req.body.email || ""
            )
                .trim()
                .toLowerCase();

        const phone =
            String(
                req.body.phone || ""
            ).trim();

        const department =
            String(
                req.body.department || ""
            ).trim();

        const designation =
            String(
                req.body.designation || ""
            ).trim();

        const password =
            String(
                req.body.password || ""
            );


        if (
            !fullName ||
            !email ||
            !phone ||
            !password
        ) {

            return res
                .status(400)
                .json({
                    success: false,
                    message:
                        "Full name, email, phone and password are required"
                });

        }


        if (
            password.length < 8
        ) {

            return res
                .status(400)
                .json({
                    success: false,
                    message:
                        "Faculty password must contain at least 8 characters"
                });

        }


        let connection;


        try {

            connection =
                await db.getConnection();


            const [duplicateRows] =
                await connection.query(
                    `
                    SELECT id
                    FROM users
                    WHERE
                        LOWER(email) = ?
                        OR phone = ?
                    LIMIT 1
                    `,
                    [
                        email,
                        phone
                    ]
                );


            if (
                duplicateRows.length > 0
            ) {

                return res
                    .status(409)
                    .json({
                        success: false,
                        message:
                            "A user already exists with this email or phone"
                    });

            }


            const [roleRows] =
                await connection.query(
                    `
                    SELECT id
                    FROM roles
                    WHERE role_name = 'faculty'
                    LIMIT 1
                    `
                );


            if (
                roleRows.length === 0
            ) {

                return res
                    .status(500)
                    .json({
                        success: false,
                        message:
                            "Faculty role is not configured"
                    });

            }


            const username =
                await uniqueUsername(
                    connection,
                    fullName
                );


            const passwordHash =
                await bcrypt.hash(
                    password,
                    12
                );


            await connection.beginTransaction();


            const [userResult] =
                await connection.query(
                    `
                    INSERT INTO users
                    (
                        role_id,
                        full_name,
                        username,
                        email,
                        phone,
                        password_hash,
                        status
                    )
                    VALUES (?, ?, ?, ?, ?, ?, 'active')
                    `,
                    [
                        roleRows[0].id,
                        fullName,
                        username,
                        email,
                        phone,
                        passwordHash
                    ]
                );


            const userId =
                userResult.insertId;


            await connection.query(
                `
                INSERT INTO faculty_profiles
                (
                    user_id,
                    department,
                    designation
                )
                VALUES (?, ?, ?)
                `,
                [
                    userId,
                    department || null,
                    designation || null
                ]
            );


            await connection.commit();


            return res
                .status(201)
                .json({
                    success: true,

                    message:
                        "Faculty account created successfully",

                    faculty: {
                        id:
                            userId,

                        fullName,
                        username,
                        email
                    }
                });


        } catch (error) {

            if (connection) {

                try {
                    await connection.rollback();
                } catch (rollbackError) {
                    console.error(
                        "Faculty rollback error:",
                        rollbackError.message
                    );
                }

            }


            console.error(
                "Create faculty error:",
                error
            );


            return res
                .status(500)
                .json({
                    success: false,
                    message:
                        "Unable to create faculty account"
                });


        } finally {

            if (connection) {
                connection.release();
            }

        }

    }
);


/* =====================================================
   ADMIN RESOURCE LIST
===================================================== */

router.get(
    "/resources",
    authenticateUser,
    authorizeRoles("admin"),
    async (req, res) => {

        try {

            const status =
                String(
                    req.query.status || ""
                )
                    .trim()
                    .toLowerCase();

            const search =
                String(
                    req.query.search || ""
                ).trim();


            let sql = `
                SELECT
                    r.id,
                    r.title,
                    r.description,
                    r.original_file_name,
                    r.file_path,
                    r.external_url,
                    r.mime_type,
                    r.file_size,
                    r.verification_status,
                    r.created_at,
                    r.verified_at,

                    rt.type_name
                        AS resource_type,

                    s.subject_code,
                    s.subject_name,

                    c.course_name,

                    d.department_name,

                    uploader.full_name
                        AS uploader_name,

                    verifier.full_name
                        AS verifier_name

                FROM resources r

                INNER JOIN resource_types rt
                    ON r.resource_type_id = rt.id

                INNER JOIN subjects s
                    ON r.subject_id = s.id

                INNER JOIN courses c
                    ON s.course_id = c.id

                LEFT JOIN departments d
                    ON c.department_id = d.id

                LEFT JOIN users uploader
                    ON r.uploaded_by = uploader.id

                LEFT JOIN users verifier
                    ON r.verified_by = verifier.id

                WHERE 1 = 1
            `;


            const values = [];


            if (
                ["pending", "approved", "rejected"]
                    .includes(status)
            ) {

                sql += `
                    AND r.verification_status = ?
                `;

                values.push(status);

            }


            if (search) {

                const term =
                    `%${search}%`;

                sql += `
                    AND
                    (
                        r.title LIKE ?
                        OR r.description LIKE ?
                        OR s.subject_name LIKE ?
                        OR s.subject_code LIKE ?
                        OR c.course_name LIKE ?
                        OR uploader.full_name LIKE ?
                    )
                `;

                values.push(
                    term,
                    term,
                    term,
                    term,
                    term,
                    term
                );

            }


            sql += `
                ORDER BY
                    CASE r.verification_status
                        WHEN 'pending' THEN 1
                        WHEN 'approved' THEN 2
                        ELSE 3
                    END,
                    r.created_at DESC
            `;


            const [resources] =
                await db.query(
                    sql,
                    values
                );


            return res.json({
                success: true,
                count: resources.length,
                resources
            });


        } catch (error) {

            console.error(
                "Admin resources error:",
                error
            );


            return res
                .status(500)
                .json({
                    success: false,
                    message:
                        "Unable to load resources"
                });

        }

    }
);


/* =====================================================
   APPROVE / REJECT RESOURCE
===================================================== */

router.patch(
    "/resources/:id/verification",
    authenticateUser,
    authorizeRoles("admin"),
    async (req, res) => {

        const resourceId =
            Number(req.params.id);

        const status =
            String(
                req.body.status || ""
            )
                .trim()
                .toLowerCase();


        if (
            !Number.isInteger(resourceId) ||
            resourceId <= 0 ||
            !["approved", "rejected"]
                .includes(status)
        ) {

            return res
                .status(400)
                .json({
                    success: false,
                    message:
                        "Invalid verification request"
                });

        }


        try {

            const [result] =
                await db.query(
                    `
                    UPDATE resources

                    SET
                        verification_status = ?,
                        verified_by = ?,
                        verified_at = NOW()

                    WHERE id = ?
                    `,
                    [
                        status,
                        req.user.userId,
                        resourceId
                    ]
                );


            if (
                result.affectedRows === 0
            ) {

                return res
                    .status(404)
                    .json({
                        success: false,
                        message:
                            "Resource not found"
                    });

            }


            return res.json({
                success: true,
                message:
                    `Resource ${status}`
            });


        } catch (error) {

            console.error(
                "Resource verification error:",
                error
            );


            return res
                .status(500)
                .json({
                    success: false,
                    message:
                        "Unable to update resource verification"
                });

        }

    }
);


/* =====================================================
   ADMIN: SUBJECT MANAGEMENT META
===================================================== */
router.get(
    "/academic-subjects/meta",
    authenticateUser,
    authorizeRoles("admin"),
    async (req, res) => {
        try {
            const [courses] = await db.query(`
                SELECT
                    c.id,
                    c.course_code,
                    c.course_name,
                    c.is_active,
                    ed.domain_name,
                    d.department_name
                FROM courses c
                LEFT JOIN education_domains ed ON c.domain_id = ed.id
                LEFT JOIN departments d ON c.department_id = d.id
                ORDER BY c.course_name
            `);

            const [levels] = await db.query(`
                SELECT id, course_id, level_name, level_order, is_active
                FROM course_levels
                ORDER BY course_id, level_order, level_name
            `);

            const [subjects] = await db.query(`
                SELECT
                    s.id,
                    s.course_id,
                    s.course_level_id,
                    s.subject_code,
                    s.subject_name,
                    s.is_active,
                    c.course_code,
                    c.course_name,
                    cl.level_name,
                    ed.domain_name,
                    d.department_name
                FROM subjects s
                INNER JOIN courses c ON s.course_id = c.id
                LEFT JOIN course_levels cl ON s.course_level_id = cl.id
                LEFT JOIN education_domains ed ON c.domain_id = ed.id
                LEFT JOIN departments d ON c.department_id = d.id
                ORDER BY c.course_name, COALESCE(cl.level_order, 999), s.subject_name
            `);

            return res.json({ success: true, courses, levels, subjects });
        } catch (error) {
            console.error("Subject meta error:", error);
            return res.status(500).json({ success: false, message: "Unable to load subjects" });
        }
    }
);


/* =====================================================
   ADMIN: ADD SUBJECT
===================================================== */
router.post(
    "/subjects",
    authenticateUser,
    authorizeRoles("admin"),
    async (req, res) => {
        const courseId = Number(req.body.courseId);
        const courseLevelId = req.body.courseLevelId ? Number(req.body.courseLevelId) : null;
        const subjectCode = String(req.body.subjectCode || "").trim().toUpperCase();
        const subjectName = String(req.body.subjectName || "").trim();

        if (!Number.isInteger(courseId) || courseId <= 0 || !subjectCode || !subjectName) {
            return res.status(400).json({ success: false, message: "Course, subject code and subject name are required" });
        }

        try {
            const [courseRows] = await db.query(
                `SELECT id FROM courses WHERE id = ? AND is_active = 1 LIMIT 1`,
                [courseId]
            );

            if (courseRows.length === 0) {
                return res.status(400).json({ success: false, message: "Selected course is not active" });
            }

            if (courseLevelId !== null) {
                const [levelRows] = await db.query(
                    `SELECT id FROM course_levels WHERE id = ? AND course_id = ? AND is_active = 1 LIMIT 1`,
                    [courseLevelId, courseId]
                );

                if (levelRows.length === 0) {
                    return res.status(400).json({ success: false, message: "Selected level does not belong to the selected course" });
                }
            }

            const [result] = await db.query(
                `INSERT INTO subjects
                 (course_id, course_level_id, subject_code, subject_name, study_year, semester, level_name, is_active)
                 VALUES (?, ?, ?, ?, NULL, NULL, NULL, 1)`,
                [courseId, courseLevelId, subjectCode, subjectName]
            );

            return res.status(201).json({ success: true, message: "Subject added successfully", subjectId: result.insertId });
        } catch (error) {
            if (error.code === "ER_DUP_ENTRY") {
                return res.status(409).json({ success: false, message: "This subject code already exists for the selected course" });
            }
            console.error("Add subject error:", error);
            return res.status(500).json({ success: false, message: "Unable to add subject" });
        }
    }
);


/* =====================================================
   ADMIN: ACTIVATE / DEACTIVATE SUBJECT
===================================================== */
router.patch(
    "/subjects/:id/status",
    authenticateUser,
    authorizeRoles("admin"),
    async (req, res) => {
        const subjectId = Number(req.params.id);
        const isActive = req.body.isActive === true || req.body.isActive === 1 || req.body.isActive === "1";

        if (!Number.isInteger(subjectId) || subjectId <= 0) {
            return res.status(400).json({ success: false, message: "Invalid subject" });
        }

        try {
            const [result] = await db.query(`UPDATE subjects SET is_active = ? WHERE id = ?`, [isActive ? 1 : 0, subjectId]);
            if (result.affectedRows === 0) {
                return res.status(404).json({ success: false, message: "Subject not found" });
            }
            return res.json({ success: true, message: isActive ? "Subject activated" : "Subject deactivated" });
        } catch (error) {
            console.error("Subject status error:", error);
            return res.status(500).json({ success: false, message: "Unable to update subject status" });
        }
    }
);


/* =====================================================
   ADMIN: FACULTY SUBJECT ASSIGNMENT META
===================================================== */
router.get(
    "/faculty-assignments/meta",
    authenticateUser,
    authorizeRoles("admin"),
    async (req, res) => {
        try {
            const [faculty] = await db.query(`
                SELECT u.id, u.full_name, u.username, u.email, u.status,
                       fp.department, fp.designation
                FROM users u
                INNER JOIN roles r ON u.role_id = r.id
                LEFT JOIN faculty_profiles fp ON fp.user_id = u.id
                WHERE r.role_name = 'faculty'
                ORDER BY u.full_name
            `);

            const [subjects] = await db.query(`
                SELECT
                    s.id,
                    s.subject_code,
                    s.subject_name,
                    c.course_name,
                    cl.level_name,
                    ed.domain_name,
                    d.department_name
                FROM subjects s
                INNER JOIN courses c ON s.course_id = c.id
                LEFT JOIN course_levels cl ON s.course_level_id = cl.id
                LEFT JOIN education_domains ed ON c.domain_id = ed.id
                LEFT JOIN departments d ON c.department_id = d.id
                WHERE s.is_active = 1 AND c.is_active = 1
                ORDER BY c.course_name, cl.level_order, s.subject_name
            `);

            const [assignments] = await db.query(`
                SELECT
                    fsa.id,
                    fsa.faculty_user_id,
                    fsa.subject_id,
                    fsa.created_at,
                    u.full_name AS faculty_name,
                    s.subject_code,
                    s.subject_name,
                    c.course_name,
                    cl.level_name
                FROM faculty_subject_assignments fsa
                INNER JOIN users u ON fsa.faculty_user_id = u.id
                INNER JOIN subjects s ON fsa.subject_id = s.id
                INNER JOIN courses c ON s.course_id = c.id
                LEFT JOIN course_levels cl ON s.course_level_id = cl.id
                WHERE fsa.is_active = 1
                ORDER BY u.full_name, c.course_name, s.subject_name
            `);

            return res.json({ success: true, faculty, subjects, assignments });
        } catch (error) {
            console.error("Faculty assignment meta error:", error);
            return res.status(500).json({ success: false, message: "Unable to load faculty assignments" });
        }
    }
);


/* =====================================================
   ADMIN: ASSIGN FACULTY TO SUBJECT
===================================================== */
router.post(
    "/faculty-assignments",
    authenticateUser,
    authorizeRoles("admin"),
    async (req, res) => {
        const facultyUserId = Number(req.body.facultyUserId);
        const subjectId = Number(req.body.subjectId);

        if (!Number.isInteger(facultyUserId) || facultyUserId <= 0 || !Number.isInteger(subjectId) || subjectId <= 0) {
            return res.status(400).json({ success: false, message: "Faculty and subject are required" });
        }

        try {
            const [facultyRows] = await db.query(`
                SELECT u.id
                FROM users u
                INNER JOIN roles r ON u.role_id = r.id
                WHERE u.id = ? AND r.role_name = 'faculty' AND u.status = 'active'
                LIMIT 1
            `, [facultyUserId]);

            if (facultyRows.length === 0) {
                return res.status(400).json({ success: false, message: "Selected faculty account is not active" });
            }

            const [subjectRows] = await db.query(`SELECT id FROM subjects WHERE id = ? AND is_active = 1 LIMIT 1`, [subjectId]);
            if (subjectRows.length === 0) {
                return res.status(400).json({ success: false, message: "Selected subject is not active" });
            }

            await db.query(`
                INSERT INTO faculty_subject_assignments
                (faculty_user_id, subject_id, assigned_by, is_active)
                VALUES (?, ?, ?, 1)
                ON DUPLICATE KEY UPDATE
                    assigned_by = VALUES(assigned_by),
                    is_active = 1,
                    updated_at = CURRENT_TIMESTAMP
            `, [facultyUserId, subjectId, req.user.userId]);

            return res.status(201).json({ success: true, message: "Faculty assigned to subject" });
        } catch (error) {
            console.error("Assign faculty error:", error);
            return res.status(500).json({ success: false, message: "Unable to assign faculty" });
        }
    }
);


/* =====================================================
   ADMIN: REMOVE FACULTY SUBJECT ASSIGNMENT
===================================================== */
router.delete(
    "/faculty-assignments/:id",
    authenticateUser,
    authorizeRoles("admin"),
    async (req, res) => {
        const assignmentId = Number(req.params.id);
        if (!Number.isInteger(assignmentId) || assignmentId <= 0) {
            return res.status(400).json({ success: false, message: "Invalid assignment" });
        }

        try {
            const [result] = await db.query(`DELETE FROM faculty_subject_assignments WHERE id = ?`, [assignmentId]);
            if (result.affectedRows === 0) {
                return res.status(404).json({ success: false, message: "Assignment not found" });
            }
            return res.json({ success: true, message: "Faculty assignment removed" });
        } catch (error) {
            console.error("Remove assignment error:", error);
            return res.status(500).json({ success: false, message: "Unable to remove faculty assignment" });
        }
    }
);


/* =====================================================
   ADMIN: STUDENT ACADEMIC ASSIGNMENT OPTIONS
===================================================== */

router.get(
    "/student-academic/options",
    authenticateUser,
    authorizeRoles("admin"),
    async (req, res) => {

        try {

            const [students] =
                await db.query(
                    `
                    SELECT
                        u.id,
                        u.full_name,
                        u.username,
                        u.email,
                        u.status,

                        sp.course_id,
                        sp.course_level_id,

                        c.course_name,
                        c.course_code,

                        cl.level_name

                    FROM users u

                    INNER JOIN roles r
                        ON u.role_id = r.id

                    LEFT JOIN student_profiles sp
                        ON sp.user_id = u.id

                    LEFT JOIN courses c
                        ON sp.course_id = c.id

                    LEFT JOIN course_levels cl
                        ON sp.course_level_id = cl.id

                    WHERE
                        r.role_name = 'student'

                    ORDER BY
                        u.full_name,
                        u.id
                    `
                );


            const [courses] =
                await db.query(
                    `
                    SELECT
                        c.id,
                        c.course_code,
                        c.course_name,
                        c.domain_id,
                        c.department_id,

                        ed.domain_name,

                        d.department_name

                    FROM courses c

                    LEFT JOIN education_domains ed
                        ON c.domain_id = ed.id

                    LEFT JOIN departments d
                        ON c.department_id = d.id

                    WHERE
                        c.is_active = 1

                        AND
                        (
                            ed.id IS NULL
                            OR ed.is_active = 1
                        )

                        AND
                        (
                            d.id IS NULL
                            OR d.is_active = 1
                        )

                    ORDER BY
                        COALESCE(ed.domain_name, ''),
                        COALESCE(d.department_name, ''),
                        c.course_name
                    `
                );


            const [levels] =
                await db.query(
                    `
                    SELECT
                        id,
                        course_id,
                        level_name,
                        level_order

                    FROM course_levels

                    WHERE
                        is_active = 1

                    ORDER BY
                        course_id,
                        level_order,
                        level_name
                    `
                );


            return res.json({
                success: true,
                students,
                courses,
                levels
            });


        } catch (error) {

            console.error(
                "Student academic options error:",
                error
            );


            return res
                .status(500)
                .json({
                    success: false,
                    message:
                        "Unable to load student academic assignment options"
                });

        }

    }
);


/* =====================================================
   ADMIN: ASSIGN / CHANGE STUDENT COURSE + LEVEL
===================================================== */

router.patch(
    "/students/:userId/academic-profile",
    authenticateUser,
    authorizeRoles("admin"),
    async (req, res) => {

        const userId =
            Number(req.params.userId);

        const courseId =
            Number(req.body.courseId);

        const rawLevelId =
            req.body.courseLevelId;

        const courseLevelId =
            rawLevelId === null ||
            rawLevelId === undefined ||
            rawLevelId === ""
                ? null
                : Number(rawLevelId);


        if (
            !Number.isInteger(userId) ||
            userId <= 0 ||
            !Number.isInteger(courseId) ||
            courseId <= 0
        ) {

            return res
                .status(400)
                .json({
                    success: false,
                    message:
                        "Valid student and course are required"
                });

        }


        if (
            courseLevelId !== null &&
            (
                !Number.isInteger(courseLevelId) ||
                courseLevelId <= 0
            )
        ) {

            return res
                .status(400)
                .json({
                    success: false,
                    message:
                        "Invalid Current Level / Year"
                });

        }


        try {

            const [studentRows] =
                await db.query(
                    `
                    SELECT
                        u.id

                    FROM users u

                    INNER JOIN roles r
                        ON u.role_id = r.id

                    WHERE
                        u.id = ?
                        AND r.role_name = 'student'

                    LIMIT 1
                    `,
                    [
                        userId
                    ]
                );


            if (
                studentRows.length === 0
            ) {

                return res
                    .status(404)
                    .json({
                        success: false,
                        message:
                            "Student account not found"
                    });

            }


            const [courseRows] =
                await db.query(
                    `
                    SELECT
                        c.id,
                        c.course_name

                    FROM courses c

                    LEFT JOIN education_domains ed
                        ON c.domain_id = ed.id

                    LEFT JOIN departments d
                        ON c.department_id = d.id

                    WHERE
                        c.id = ?
                        AND c.is_active = 1

                        AND
                        (
                            ed.id IS NULL
                            OR ed.is_active = 1
                        )

                        AND
                        (
                            d.id IS NULL
                            OR d.is_active = 1
                        )

                    LIMIT 1
                    `,
                    [
                        courseId
                    ]
                );


            if (
                courseRows.length === 0
            ) {

                return res
                    .status(400)
                    .json({
                        success: false,
                        message:
                            "Selected Course / Program is not available"
                    });

            }


            const [courseLevels] =
                await db.query(
                    `
                    SELECT
                        id,
                        level_name

                    FROM course_levels

                    WHERE
                        course_id = ?
                        AND is_active = 1

                    ORDER BY
                        level_order,
                        level_name
                    `,
                    [
                        courseId
                    ]
                );


            if (
                courseLevels.length > 0 &&
                courseLevelId === null
            ) {

                return res
                    .status(400)
                    .json({
                        success: false,
                        message:
                            "Please select the student's Current Level / Year"
                    });

            }


            if (
                courseLevelId !== null
            ) {

                const validLevel =
                    courseLevels.some(
                        (level) =>
                            Number(level.id) ===
                            courseLevelId
                    );


                if (!validLevel) {

                    return res
                        .status(400)
                        .json({
                            success: false,
                            message:
                                "Selected level does not belong to the selected course"
                        });

                }

            }


            const [profileRows] =
                await db.query(
                    `
                    SELECT id
                    FROM student_profiles
                    WHERE user_id = ?
                    LIMIT 1
                    `,
                    [
                        userId
                    ]
                );


            if (
                profileRows.length === 0
            ) {

                await db.query(
                    `
                    INSERT INTO student_profiles
                    (
                        user_id,
                        course_id,
                        course_level_id
                    )
                    VALUES (?, ?, ?)
                    `,
                    [
                        userId,
                        courseId,
                        courseLevelId
                    ]
                );

            } else {

                await db.query(
                    `
                    UPDATE student_profiles

                    SET
                        course_id = ?,
                        course_level_id = ?

                    WHERE
                        user_id = ?
                    `,
                    [
                        courseId,
                        courseLevelId,
                        userId
                    ]
                );

            }


            return res.json({
                success: true,

                message:
                    "Student academic profile updated successfully",

                academicProfile: {
                    userId,
                    courseId,
                    courseName:
                        courseRows[0].course_name,
                    courseLevelId
                }
            });


        } catch (error) {

            console.error(
                "Update student academic profile error:",
                error
            );


            return res
                .status(500)
                .json({
                    success: false,
                    message:
                        "Unable to update student academic profile"
                });

        }

    }
);


module.exports = router;
