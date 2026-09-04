const express = require("express");

const db = require("../config/db");

const authenticateUser =
    require("../middleware/authMiddleware");

const authorizeRoles =
    require("../middleware/roleMiddleware");


const router =
    express.Router();


/* =====================================================
   PUBLIC REGISTRATION OPTIONS

   This endpoint intentionally does not require login.
   It powers the Create Account page.
===================================================== */

router.get(
    "/registration-options",
    async (req, res) => {

        try {

            const [courseRows] =
                await db.query(
                    `
                    SELECT
                        c.id,
                        c.course_code,
                        c.course_name,
                        c.structure_type,

                        ed.id
                            AS domain_id,

                        ed.domain_name,

                        d.id
                            AS department_id,

                        d.department_code,

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


            const [levelRows] =
                await db.query(
                    `
                    SELECT
                        id,
                        course_id,
                        level_name,
                        level_order

                    FROM course_levels

                    WHERE is_active = 1

                    ORDER BY
                        course_id,
                        level_order,
                        level_name
                    `
                );


            const levelsByCourse =
                new Map();


            for (const level of levelRows) {

                const key =
                    String(level.course_id);


                if (
                    !levelsByCourse.has(key)
                ) {

                    levelsByCourse.set(
                        key,
                        []
                    );

                }


                levelsByCourse
                    .get(key)
                    .push({
                        id:
                            level.id,

                        levelName:
                            level.level_name,

                        levelOrder:
                            level.level_order
                    });

            }


            const courses =
                courseRows.map(
                    (course) => ({

                        id:
                            course.id,

                        courseCode:
                            course.course_code,

                        courseName:
                            course.course_name,

                        structureType:
                            course.structure_type,

                        domainId:
                            course.domain_id,

                        domainName:
                            course.domain_name,

                        departmentId:
                            course.department_id,

                        departmentCode:
                            course.department_code,

                        departmentName:
                            course.department_name,

                        levels:
                            levelsByCourse.get(
                                String(course.id)
                            ) || []

                    })
                );


            return res
                .status(200)
                .json({

                    success: true,

                    count:
                        courses.length,

                    courses

                });


        } catch (error) {

            console.error(
                "Registration options error:",
                error
            );


            return res
                .status(500)
                .json({

                    success: false,

                    message:
                        "Unable to load academic registration options"

                });

        }

    }
);


/* =====================================================
   ADMIN: VIEW ACADEMIC STRUCTURE
===================================================== */

router.get(
    "/admin/structure",
    authenticateUser,
    authorizeRoles("admin"),
    async (req, res) => {

        try {

            const [rows] =
                await db.query(
                    `
                    SELECT
                        ed.id AS domain_id,
                        ed.domain_name,
                        ed.is_active AS domain_active,

                        d.id AS department_id,
                        d.department_code,
                        d.department_name,
                        d.is_active AS department_active,

                        c.id AS course_id,
                        c.course_code,
                        c.course_name,
                        c.structure_type,
                        c.duration_years,
                        c.is_active AS course_active,

                        cl.id AS level_id,
                        cl.level_name,
                        cl.level_order,
                        cl.is_active AS level_active

                    FROM education_domains ed

                    LEFT JOIN departments d
                        ON d.domain_id = ed.id

                    LEFT JOIN courses c
                        ON c.domain_id = ed.id
                        AND
                        (
                            c.department_id = d.id
                            OR
                            (
                                c.department_id IS NULL
                                AND d.id IS NULL
                            )
                        )

                    LEFT JOIN course_levels cl
                        ON cl.course_id = c.id

                    ORDER BY
                        ed.domain_name,
                        d.department_name,
                        c.course_name,
                        cl.level_order
                    `
                );


            return res.json({
                success: true,
                rows
            });


        } catch (error) {

            console.error(
                "Academic structure error:",
                error
            );


            return res
                .status(500)
                .json({
                    success: false,
                    message:
                        "Unable to load academic structure"
                });

        }

    }
);


/* =====================================================
   ADMIN: ADD EDUCATION DOMAIN
===================================================== */

router.post(
    "/domains",
    authenticateUser,
    authorizeRoles("admin"),
    async (req, res) => {

        const domainName =
            String(
                req.body.domainName || ""
            ).trim();


        if (!domainName) {

            return res
                .status(400)
                .json({
                    success: false,
                    message:
                        "Domain name is required"
                });

        }


        try {

            const [result] =
                await db.query(
                    `
                    INSERT INTO education_domains
                    (
                        domain_name,
                        is_active
                    )
                    VALUES (?, 1)
                    `,
                    [
                        domainName
                    ]
                );


            return res
                .status(201)
                .json({
                    success: true,
                    message:
                        "Education domain added successfully",
                    domainId:
                        result.insertId
                });


        } catch (error) {

            if (error.code === "ER_DUP_ENTRY") {

                return res
                    .status(409)
                    .json({
                        success: false,
                        message:
                            "This education domain already exists"
                    });

            }


            console.error(
                "Add domain error:",
                error
            );


            return res
                .status(500)
                .json({
                    success: false,
                    message:
                        "Unable to add education domain"
                });

        }

    }
);


/* =====================================================
   ADMIN: ADD DEPARTMENT / STREAM
===================================================== */

router.post(
    "/departments",
    authenticateUser,
    authorizeRoles("admin"),
    async (req, res) => {

        const domainId =
            Number(req.body.domainId);

        const departmentCode =
            String(
                req.body.departmentCode || ""
            )
                .trim()
                .toUpperCase();

        const departmentName =
            String(
                req.body.departmentName || ""
            ).trim();


        if (
            !Number.isInteger(domainId) ||
            domainId <= 0 ||
            !departmentCode ||
            !departmentName
        ) {

            return res
                .status(400)
                .json({
                    success: false,
                    message:
                        "Domain, department code and department name are required"
                });

        }


        try {

            const [domainRows] =
                await db.query(
                    `
                    SELECT id
                    FROM education_domains
                    WHERE id = ?
                      AND is_active = 1
                    LIMIT 1
                    `,
                    [
                        domainId
                    ]
                );


            if (
                domainRows.length === 0
            ) {

                return res
                    .status(400)
                    .json({
                        success: false,
                        message:
                            "Selected education domain is not available"
                    });

            }


            const [result] =
                await db.query(
                    `
                    INSERT INTO departments
                    (
                        domain_id,
                        department_code,
                        department_name,
                        is_active
                    )
                    VALUES (?, ?, ?, 1)
                    `,
                    [
                        domainId,
                        departmentCode,
                        departmentName
                    ]
                );


            return res
                .status(201)
                .json({
                    success: true,
                    message:
                        "Department / stream added successfully",
                    departmentId:
                        result.insertId
                });


        } catch (error) {

            if (error.code === "ER_DUP_ENTRY") {

                return res
                    .status(409)
                    .json({
                        success: false,
                        message:
                            "Department code or name already exists"
                    });

            }


            console.error(
                "Add department error:",
                error
            );


            return res
                .status(500)
                .json({
                    success: false,
                    message:
                        "Unable to add department / stream"
                });

        }

    }
);


/* =====================================================
   ADMIN: ADD COURSE / PROGRAM

   A department is optional so LearnVault can support
   things such as competitive exams or flexible programs.
===================================================== */

router.post(
    "/courses",
    authenticateUser,
    authorizeRoles("admin"),
    async (req, res) => {

        const domainId =
            Number(req.body.domainId);

        const departmentId =
            req.body.departmentId
                ? Number(
                    req.body.departmentId
                )
                : null;

        const courseCode =
            String(
                req.body.courseCode || ""
            )
                .trim()
                .toUpperCase();

        const courseName =
            String(
                req.body.courseName || ""
            ).trim();

        const durationYears =
            req.body.durationYears
                ? Number(
                    req.body.durationYears
                )
                : null;

        const allowedStructureTypes =
            new Set([
                "year_semester",
                "grade",
                "module",
                "exam",
                "flexible"
            ]);

        const structureType =
            allowedStructureTypes.has(
                String(
                    req.body.structureType ||
                    ""
                )
            )
                ? String(
                    req.body.structureType
                )
                : "flexible";


        if (
            !Number.isInteger(domainId) ||
            domainId <= 0 ||
            !courseCode ||
            !courseName
        ) {

            return res
                .status(400)
                .json({
                    success: false,
                    message:
                        "Domain, course code and course name are required"
                });

        }


        try {

            const [domainRows] =
                await db.query(
                    `
                    SELECT id
                    FROM education_domains
                    WHERE id = ?
                      AND is_active = 1
                    LIMIT 1
                    `,
                    [
                        domainId
                    ]
                );


            if (
                domainRows.length === 0
            ) {

                return res
                    .status(400)
                    .json({
                        success: false,
                        message:
                            "Selected education domain is not available"
                    });

            }


            if (departmentId) {

                const [departmentRows] =
                    await db.query(
                        `
                        SELECT id
                        FROM departments
                        WHERE id = ?
                          AND domain_id = ?
                          AND is_active = 1
                        LIMIT 1
                        `,
                        [
                            departmentId,
                            domainId
                        ]
                    );


                if (
                    departmentRows.length === 0
                ) {

                    return res
                        .status(400)
                        .json({
                            success: false,
                            message:
                                "Selected department does not belong to this education domain"
                        });

                }

            }


            const [result] =
                await db.query(
                    `
                    INSERT INTO courses
                    (
                        domain_id,
                        department_id,
                        course_code,
                        course_name,
                        duration_years,
                        structure_type,
                        is_active
                    )
                    VALUES (?, ?, ?, ?, ?, ?, 1)
                    `,
                    [
                        domainId,
                        departmentId,
                        courseCode,
                        courseName,
                        durationYears,
                        structureType
                    ]
                );


            return res
                .status(201)
                .json({
                    success: true,
                    message:
                        "Course / program added successfully",
                    courseId:
                        result.insertId
                });


        } catch (error) {

            if (error.code === "ER_DUP_ENTRY") {

                return res
                    .status(409)
                    .json({
                        success: false,
                        message:
                            "This course code already exists"
                    });

            }


            console.error(
                "Add course error:",
                error
            );


            return res
                .status(500)
                .json({
                    success: false,
                    message:
                        "Unable to add course / program"
                });

        }

    }
);


/* =====================================================
   ADMIN: ADD COURSE LEVEL / YEAR
===================================================== */

router.post(
    "/courses/:courseId/levels",
    authenticateUser,
    authorizeRoles("admin"),
    async (req, res) => {

        const courseId =
            Number(
                req.params.courseId
            );

        const levelName =
            String(
                req.body.levelName || ""
            ).trim();

        const levelOrder =
            Number(
                req.body.levelOrder || 1
            );


        if (
            !Number.isInteger(courseId) ||
            courseId <= 0 ||
            !levelName ||
            !Number.isInteger(levelOrder) ||
            levelOrder <= 0
        ) {

            return res
                .status(400)
                .json({
                    success: false,
                    message:
                        "Valid course, level name and level order are required"
                });

        }


        try {

            const [courseRows] =
                await db.query(
                    `
                    SELECT id
                    FROM courses
                    WHERE id = ?
                      AND is_active = 1
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
                    .status(404)
                    .json({
                        success: false,
                        message:
                            "Course / program not found"
                    });

            }


            const [result] =
                await db.query(
                    `
                    INSERT INTO course_levels
                    (
                        course_id,
                        level_name,
                        level_order,
                        is_active
                    )
                    VALUES (?, ?, ?, 1)
                    `,
                    [
                        courseId,
                        levelName,
                        levelOrder
                    ]
                );


            return res
                .status(201)
                .json({
                    success: true,
                    message:
                        "Course level added successfully",
                    levelId:
                        result.insertId
                });


        } catch (error) {

            if (error.code === "ER_DUP_ENTRY") {

                return res
                    .status(409)
                    .json({
                        success: false,
                        message:
                            "This level already exists for the selected course"
                    });

            }


            console.error(
                "Add course level error:",
                error
            );


            return res
                .status(500)
                .json({
                    success: false,
                    message:
                        "Unable to add course level"
                });

        }

    }
);


/* =====================================================
   ADMIN: FLAT ACADEMIC CATALOG

   Used by the Admin dashboard and Academic Management UI.
===================================================== */

router.get(
    "/admin/catalog",
    authenticateUser,
    authorizeRoles("admin"),
    async (req, res) => {

        try {

            const [domains] =
                await db.query(
                    `
                    SELECT
                        id,
                        domain_name,
                        is_active,
                        created_at

                    FROM education_domains

                    ORDER BY
                        domain_name
                    `
                );


            const [departments] =
                await db.query(
                    `
                    SELECT
                        d.id,
                        d.domain_id,
                        d.department_code,
                        d.department_name,
                        d.is_active,
                        d.created_at,

                        ed.domain_name

                    FROM departments d

                    LEFT JOIN education_domains ed
                        ON d.domain_id = ed.id

                    ORDER BY
                        COALESCE(ed.domain_name, ''),
                        d.department_name
                    `
                );


            const [courses] =
                await db.query(
                    `
                    SELECT
                        c.id,
                        c.domain_id,
                        c.department_id,
                        c.course_code,
                        c.course_name,
                        c.duration_years,
                        c.structure_type,
                        c.is_active,
                        c.created_at,

                        ed.domain_name,

                        d.department_code,
                        d.department_name

                    FROM courses c

                    LEFT JOIN education_domains ed
                        ON c.domain_id = ed.id

                    LEFT JOIN departments d
                        ON c.department_id = d.id

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
                        cl.id,
                        cl.course_id,
                        cl.level_name,
                        cl.level_order,
                        cl.is_active,
                        cl.created_at,

                        c.course_code,
                        c.course_name

                    FROM course_levels cl

                    INNER JOIN courses c
                        ON cl.course_id = c.id

                    ORDER BY
                        c.course_name,
                        cl.level_order,
                        cl.level_name
                    `
                );


            return res
                .status(200)
                .json({

                    success: true,

                    catalog: {
                        domains,
                        departments,
                        courses,
                        levels
                    }

                });


        } catch (error) {

            console.error(
                "Admin academic catalog error:",
                error
            );


            return res
                .status(500)
                .json({

                    success: false,

                    message:
                        "Unable to load academic catalog"

                });

        }

    }
);


/* =====================================================
   ADMIN: ACTIVATE / DEACTIVATE ACADEMIC ITEM

   We deactivate records instead of deleting them so
   student/course relationships remain safe.
===================================================== */

router.patch(
    "/admin/:entity/:id/status",
    authenticateUser,
    authorizeRoles("admin"),
    async (req, res) => {

        const entity =
            String(
                req.params.entity || ""
            )
                .trim()
                .toLowerCase();


        const id =
            Number(
                req.params.id
            );


        const isActive =
            req.body.isActive === true ||
            req.body.isActive === 1 ||
            req.body.isActive === "1";


        const tableMap = {

            domains:
                "education_domains",

            departments:
                "departments",

            courses:
                "courses",

            levels:
                "course_levels"

        };


        const tableName =
            tableMap[entity];


        if (
            !tableName ||
            !Number.isInteger(id) ||
            id <= 0
        ) {

            return res
                .status(400)
                .json({
                    success: false,
                    message:
                        "Invalid academic item"
                });

        }


        try {

            const [result] =
                await db.query(
                    `
                    UPDATE ${tableName}

                    SET is_active = ?

                    WHERE id = ?
                    `,
                    [
                        isActive ? 1 : 0,
                        id
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
                            "Academic item not found"
                    });

            }


            return res
                .status(200)
                .json({
                    success: true,
                    message:
                        isActive
                            ? "Academic item activated"
                            : "Academic item deactivated"
                });


        } catch (error) {

            console.error(
                "Academic status update error:",
                error
            );


            return res
                .status(500)
                .json({
                    success: false,
                    message:
                        "Unable to update academic item"
                });

        }

    }
);


module.exports = router;
