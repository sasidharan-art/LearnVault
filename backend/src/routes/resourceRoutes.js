const express = require("express");

const db = require("../config/db");

const authenticateUser =
    require("../middleware/authMiddleware");


const router =
    express.Router();



/* =====================================================
   GET RESOURCE FILTER DATA

   Returns:
   departments
   courses
   subjects
   resource types
===================================================== */

router.get(
    "/meta",
    authenticateUser,
    async (req, res) => {

        try {

            const [departments] =
                await db.query(
                    `
                    SELECT
                        id,
                        department_code,
                        department_name

                    FROM departments

                    ORDER BY department_name
                    `
                );


            const [courses] =
                await db.query(
                    `
                    SELECT
                        c.id,
                        c.department_id,
                        c.course_code,
                        c.course_name,
                        c.duration_years,
                        d.department_name

                    FROM courses c

                    INNER JOIN departments d
                        ON c.department_id = d.id

                    ORDER BY c.course_name
                    `
                );


            const [subjects] =
                await db.query(
                    `
                    SELECT
                        s.id,
                        s.course_id,
                        s.subject_code,
                        s.subject_name,
                        s.study_year,
                        s.semester,
                        c.course_name

                    FROM subjects s

                    INNER JOIN courses c
                        ON s.course_id = c.id

                    ORDER BY
                        s.study_year,
                        s.semester,
                        s.subject_name
                    `
                );


            const [resourceTypes] =
                await db.query(
                    `
                    SELECT
                        id,
                        type_name

                    FROM resource_types

                    ORDER BY type_name
                    `
                );


            return res
                .status(200)
                .json({

                    success: true,

                    data: {

                        departments,
                        courses,
                        subjects,

                        resourceTypes:
                            resourceTypes

                    }

                });


        } catch (error) {

            console.error(
                "Resource metadata error:",
                error
            );


            return res
                .status(500)
                .json({

                    success: false,

                    message:
                        "Unable to load resource information"

                });

        }

    }
);



/* =====================================================
   GET ALL APPROVED RESOURCES

   Optional filters:

   ?subjectId=1
   ?typeId=1
   ?year=2
   ?semester=3
   ?search=dbms
===================================================== */

router.get(
    "/",
    authenticateUser,
    async (req, res) => {

        try {

            const {

                subjectId,
                typeId,
                year,
                semester,
                search

            } = req.query;



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

                    rt.id
                        AS resource_type_id,

                    rt.type_name
                        AS resource_type,

                    s.id
                        AS subject_id,

                    s.subject_code,

                    s.subject_name,

                    s.study_year,

                    s.semester,

                    c.id
                        AS course_id,

                    c.course_code,

                    c.course_name,

                    d.id
                        AS department_id,

                    d.department_code,

                    d.department_name,

                    u.id
                        AS uploader_id,

                    u.full_name
                        AS uploader_name


                FROM resources r


                INNER JOIN resource_types rt

                    ON r.resource_type_id =
                       rt.id


                INNER JOIN subjects s

                    ON r.subject_id =
                       s.id


                INNER JOIN courses c

                    ON s.course_id =
                       c.id


                INNER JOIN departments d

                    ON c.department_id =
                       d.id


                LEFT JOIN users u

                    ON r.uploaded_by =
                       u.id


                WHERE

                    r.verification_status =
                    'approved'
            `;



            const values = [];



            /* =============================================
               SUBJECT FILTER
            ============================================= */

            if (subjectId) {

                sql +=
                    `
                    AND s.id = ?
                    `;

                values.push(
                    subjectId
                );

            }



            /* =============================================
               RESOURCE TYPE FILTER
            ============================================= */

            if (typeId) {

                sql +=
                    `
                    AND rt.id = ?
                    `;

                values.push(
                    typeId
                );

            }



            /* =============================================
               YEAR FILTER
            ============================================= */

            if (year) {

                sql +=
                    `
                    AND s.study_year = ?
                    `;

                values.push(
                    year
                );

            }



            /* =============================================
               SEMESTER FILTER
            ============================================= */

            if (semester) {

                sql +=
                    `
                    AND s.semester = ?
                    `;

                values.push(
                    semester
                );

            }



            /* =============================================
               SEARCH
            ============================================= */

            if (
                search &&
                search.trim()
            ) {

                const searchValue =
                    `%${search.trim()}%`;


                sql +=
                    `
                    AND
                    (
                        r.title LIKE ?

                        OR r.description LIKE ?

                        OR s.subject_name LIKE ?

                        OR s.subject_code LIKE ?
                    )
                    `;


                values.push(
                    searchValue,
                    searchValue,
                    searchValue,
                    searchValue
                );

            }



            /* =============================================
               ORDER
            ============================================= */

            sql +=
                `
                ORDER BY
                    r.created_at DESC
                `;



            const [resources] =
                await db.query(
                    sql,
                    values
                );



            return res
                .status(200)
                .json({

                    success: true,

                    count:
                        resources.length,

                    resources:
                        resources

                });


        } catch (error) {

            console.error(
                "Get resources error:",
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
   GET ONE RESOURCE
===================================================== */

router.get(
    "/:id",
    authenticateUser,
    async (req, res) => {

        try {

            const resourceId =
                req.params.id;



            const [rows] =
                await db.query(
                    `
                    SELECT

                        r.id,

                        r.title,
                        r.description,

                        r.original_file_name,
                        r.file_path,
                        r.external_url,

                        r.mime_type,
                        r.file_size,

                        r.created_at,

                        rt.type_name
                            AS resource_type,

                        s.subject_code,

                        s.subject_name,

                        s.study_year,

                        s.semester,

                        c.course_name,

                        d.department_name,

                        u.full_name
                            AS uploader_name


                    FROM resources r


                    INNER JOIN resource_types rt

                        ON r.resource_type_id =
                           rt.id


                    INNER JOIN subjects s

                        ON r.subject_id =
                           s.id


                    INNER JOIN courses c

                        ON s.course_id =
                           c.id


                    INNER JOIN departments d

                        ON c.department_id =
                           d.id


                    LEFT JOIN users u

                        ON r.uploaded_by =
                           u.id


                    WHERE

                        r.id = ?

                        AND

                        r.verification_status =
                        'approved'


                    LIMIT 1
                    `,
                    [
                        resourceId
                    ]
                );



            if (
                rows.length === 0
            ) {

                return res
                    .status(404)
                    .json({

                        success: false,

                        message:
                            "Resource not found"

                    });

            }



            return res
                .status(200)
                .json({

                    success: true,

                    resource:
                        rows[0]

                });


        } catch (error) {

            console.error(
                "Get resource error:",
                error
            );


            return res
                .status(500)
                .json({

                    success: false,

                    message:
                        "Unable to load resource"

                });

        }

    }
);



module.exports =
    router;