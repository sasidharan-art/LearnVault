const express = require("express");
const path = require("path");
const fs = require("fs");

const db = require("../config/db");

const authenticateUser =
    require("../middleware/authMiddleware");

const authorizeRoles =
    require("../middleware/roleMiddleware");


const router =
    express.Router();


async function getStudentAcademicProfile(
    userId
) {

    const [rows] =
        await db.query(
            `
            SELECT
                sp.user_id,
                sp.course_id,
                sp.course_level_id,

                c.course_code,
                c.course_name,

                cl.level_name,

                d.id
                    AS department_id,

                d.department_name,

                ed.id
                    AS domain_id,

                ed.domain_name

            FROM student_profiles sp

            INNER JOIN courses c
                ON sp.course_id = c.id

            LEFT JOIN course_levels cl
                ON sp.course_level_id = cl.id

            LEFT JOIN departments d
                ON c.department_id = d.id

            LEFT JOIN education_domains ed
                ON c.domain_id = ed.id

            WHERE
                sp.user_id = ?
                AND c.is_active = 1

            LIMIT 1
            `,
            [
                userId
            ]
        );


    return rows[0] || null;

}


function subjectLevelCondition(
    profile
) {

    /*
       A subject without a specific level is course-wide.
       A level-specific subject is visible only to students
       enrolled in that same level.
    */

    if (
        profile.course_level_id
    ) {

        return {
            sql:
                `
                AND
                (
                    s.course_level_id IS NULL
                    OR s.course_level_id = ?
                )
                `,

            values: [
                profile.course_level_id
            ]
        };

    }


    return {
        sql:
            `
            AND s.course_level_id IS NULL
            `,

        values: []
    };

}


/* =====================================================
   STUDENT DASHBOARD LEARNING SUMMARY
===================================================== */

router.get(
    "/dashboard",
    authenticateUser,
    authorizeRoles("student"),
    async (req, res) => {

        try {

            const profile =
                await getStudentAcademicProfile(
                    req.user.userId
                );


            if (!profile) {

                return res
                    .status(400)
                    .json({
                        success: false,
                        message:
                            "Your student course profile is not configured"
                    });

            }


            const levelCondition =
                subjectLevelCondition(
                    profile
                );


            const [subjectRows] =
                await db.query(
                    `
                    SELECT
                        s.id

                    FROM subjects s

                    WHERE
                        s.course_id = ?
                        AND s.is_active = 1

                    ${levelCondition.sql}
                    `,
                    [
                        profile.course_id,
                        ...levelCondition.values
                    ]
                );


            const [[resourceCounts]] =
                await db.query(
                    `
                    SELECT
                        COUNT(*) AS approved_resources,

                        SUM(
                            LOWER(rt.type_name) = 'video'
                        ) AS video_resources

                    FROM resources r

                    INNER JOIN resource_types rt
                        ON r.resource_type_id = rt.id

                    INNER JOIN subjects s
                        ON r.subject_id = s.id

                    WHERE
                        r.verification_status = 'approved'
                        AND s.course_id = ?
                        AND s.is_active = 1

                    ${levelCondition.sql}
                    `,
                    [
                        profile.course_id,
                        ...levelCondition.values
                    ]
                );


            return res.json({
                success: true,

                dashboard: {

                    courseId:
                        profile.course_id,

                    courseName:
                        profile.course_name,

                    levelName:
                        profile.level_name,

                    subjectCount:
                        subjectRows.length,

                    approvedResourceCount:
                        Number(
                            resourceCounts.approved_resources ||
                            0
                        ),

                    videoResourceCount:
                        Number(
                            resourceCounts.video_resources ||
                            0
                        )

                }

            });


        } catch (error) {

            console.error(
                "Student dashboard learning summary error:",
                error
            );


            return res
                .status(500)
                .json({
                    success: false,
                    message:
                        "Unable to load student learning summary"
                });

        }

    }
);


/* =====================================================
   RESOURCE LIBRARY META
===================================================== */

router.get(
    "/resources/meta",
    authenticateUser,
    authorizeRoles("student"),
    async (req, res) => {

        try {

            const profile =
                await getStudentAcademicProfile(
                    req.user.userId
                );


            if (!profile) {

                return res
                    .status(400)
                    .json({
                        success: false,
                        message:
                            "Your student course profile is not configured"
                    });

            }


            const levelCondition =
                subjectLevelCondition(
                    profile
                );


            const [subjects] =
                await db.query(
                    `
                    SELECT
                        s.id,
                        s.subject_code,
                        s.subject_name,

                        cl.level_name

                    FROM subjects s

                    LEFT JOIN course_levels cl
                        ON s.course_level_id = cl.id

                    WHERE
                        s.course_id = ?
                        AND s.is_active = 1

                    ${levelCondition.sql}

                    ORDER BY
                        s.subject_name
                    `,
                    [
                        profile.course_id,
                        ...levelCondition.values
                    ]
                );


            const [resourceTypes] =
                await db.query(
                    `
                    SELECT DISTINCT
                        rt.id,
                        rt.type_name

                    FROM resources r

                    INNER JOIN resource_types rt
                        ON r.resource_type_id = rt.id

                    INNER JOIN subjects s
                        ON r.subject_id = s.id

                    WHERE
                        r.verification_status = 'approved'
                        AND s.course_id = ?
                        AND s.is_active = 1

                    ${levelCondition.sql}

                    ORDER BY
                        rt.type_name
                    `,
                    [
                        profile.course_id,
                        ...levelCondition.values
                    ]
                );


            return res.json({
                success: true,

                profile: {

                    courseId:
                        profile.course_id,

                    courseCode:
                        profile.course_code,

                    courseName:
                        profile.course_name,

                    courseLevelId:
                        profile.course_level_id,

                    levelName:
                        profile.level_name,

                    domainName:
                        profile.domain_name,

                    departmentName:
                        profile.department_name

                },

                subjects,
                resourceTypes
            });


        } catch (error) {

            console.error(
                "Student resource meta error:",
                error
            );


            return res
                .status(500)
                .json({
                    success: false,
                    message:
                        "Unable to load your Resource Library"
                });

        }

    }
);


/* =====================================================
   APPROVED COURSE-SPECIFIC RESOURCES
===================================================== */

router.get(
    "/resources",
    authenticateUser,
    authorizeRoles("student"),
    async (req, res) => {

        try {

            const profile =
                await getStudentAcademicProfile(
                    req.user.userId
                );


            if (!profile) {

                return res
                    .status(400)
                    .json({
                        success: false,
                        message:
                            "Your student course profile is not configured"
                    });

            }


            const subjectId =
                Number(
                    req.query.subjectId
                );

            const typeId =
                Number(
                    req.query.typeId
                );

            const search =
                String(
                    req.query.search ||
                    ""
                ).trim();


            const levelCondition =
                subjectLevelCondition(
                    profile
                );


            let sql =
                `
                SELECT
                    r.id,
                    r.title,
                    r.description,
                    r.original_file_name,
                    r.external_url,
                    r.mime_type,
                    r.file_size,
                    r.created_at,

                    rt.id
                        AS resource_type_id,

                    rt.type_name
                        AS resource_type,

                    s.id
                        AS subject_id,

                    s.subject_code,
                    s.subject_name,

                    cl.level_name,

                    c.course_code,
                    c.course_name,

                    uploader.full_name
                        AS uploader_name

                FROM resources r

                INNER JOIN resource_types rt
                    ON r.resource_type_id = rt.id

                INNER JOIN subjects s
                    ON r.subject_id = s.id

                INNER JOIN courses c
                    ON s.course_id = c.id

                LEFT JOIN course_levels cl
                    ON s.course_level_id = cl.id

                LEFT JOIN users uploader
                    ON r.uploaded_by = uploader.id

                WHERE
                    r.verification_status = 'approved'
                    AND s.is_active = 1
                    AND c.is_active = 1
                    AND s.course_id = ?

                ${levelCondition.sql}
                `;


            const values = [
                profile.course_id,
                ...levelCondition.values
            ];


            if (
                Number.isInteger(subjectId) &&
                subjectId > 0
            ) {

                sql +=
                    `
                    AND s.id = ?
                    `;

                values.push(
                    subjectId
                );

            }


            if (
                Number.isInteger(typeId) &&
                typeId > 0
            ) {

                sql +=
                    `
                    AND rt.id = ?
                    `;

                values.push(
                    typeId
                );

            }


            if (search) {

                const term =
                    `%${search}%`;


                sql +=
                    `
                    AND
                    (
                        r.title LIKE ?
                        OR r.description LIKE ?
                        OR s.subject_name LIKE ?
                        OR s.subject_code LIKE ?
                        OR rt.type_name LIKE ?
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


            sql +=
                `
                ORDER BY
                    r.created_at DESC
                `;


            const [rows] =
                await db.query(
                    sql,
                    values
                );


            const resources =
                rows.map(
                    (row) => ({

                        id:
                            row.id,

                        title:
                            row.title,

                        description:
                            row.description,

                        resourceTypeId:
                            row.resource_type_id,

                        resourceType:
                            row.resource_type,

                        subjectId:
                            row.subject_id,

                        subjectCode:
                            row.subject_code,

                        subjectName:
                            row.subject_name,

                        levelName:
                            row.level_name,

                        courseCode:
                            row.course_code,

                        courseName:
                            row.course_name,

                        uploaderName:
                            row.uploader_name,

                        originalFileName:
                            row.original_file_name,

                        externalUrl:
                            row.external_url,

                        mimeType:
                            row.mime_type,

                        fileSize:
                            row.file_size,

                        hasFile:
                            Boolean(
                                row.original_file_name
                            ),

                        createdAt:
                            row.created_at

                    })
                );


            return res.json({
                success: true,

                count:
                    resources.length,

                resources
            });


        } catch (error) {

            console.error(
                "Student resources error:",
                error
            );


            return res
                .status(500)
                .json({
                    success: false,
                    message:
                        "Unable to load approved resources"
                });

        }

    }
);


/* =====================================================
   AUTHENTICATED RESOURCE FILE OPEN / DOWNLOAD
===================================================== */

router.get(
    "/resources/:id/file",
    authenticateUser,
    authorizeRoles("student"),
    async (req, res) => {

        const resourceId =
            Number(
                req.params.id
            );


        if (
            !Number.isInteger(resourceId) ||
            resourceId <= 0
        ) {

            return res
                .status(400)
                .json({
                    success: false,
                    message:
                        "Invalid resource"
                });

        }


        try {

            const profile =
                await getStudentAcademicProfile(
                    req.user.userId
                );


            if (!profile) {

                return res
                    .status(400)
                    .json({
                        success: false,
                        message:
                            "Your student course profile is not configured"
                    });

            }


            const levelCondition =
                subjectLevelCondition(
                    profile
                );


            const [rows] =
                await db.query(
                    `
                    SELECT
                        r.id,
                        r.file_path,
                        r.original_file_name,
                        r.mime_type

                    FROM resources r

                    INNER JOIN subjects s
                        ON r.subject_id = s.id

                    INNER JOIN courses c
                        ON s.course_id = c.id

                    WHERE
                        r.id = ?
                        AND r.verification_status = 'approved'
                        AND s.is_active = 1
                        AND c.is_active = 1
                        AND s.course_id = ?

                    ${levelCondition.sql}

                    LIMIT 1
                    `,
                    [
                        resourceId,
                        profile.course_id,
                        ...levelCondition.values
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
                            "Resource not found for your course"
                    });

            }


            const resource =
                rows[0];


            if (
                !resource.file_path
            ) {

                return res
                    .status(404)
                    .json({
                        success: false,
                        message:
                            "This resource does not contain an uploaded file"
                    });

            }


            const projectRoot =
                path.resolve(
                    __dirname,
                    "../../../"
                );


            const uploadsRoot =
                path.resolve(
                    projectRoot,
                    "uploads",
                    "resources"
                );


            const filePath =
                path.resolve(
                    projectRoot,
                    resource.file_path
                );


            if (
                !filePath.startsWith(
                    uploadsRoot +
                    path.sep
                )
            ) {

                return res
                    .status(400)
                    .json({
                        success: false,
                        message:
                            "Invalid stored resource path"
                    });

            }


            if (
                !fs.existsSync(
                    filePath
                )
            ) {

                return res
                    .status(404)
                    .json({
                        success: false,
                        message:
                            "Stored resource file is missing"
                    });

            }


            if (
                resource.mime_type
            ) {

                res.type(
                    resource.mime_type
                );

            }


            return res.sendFile(
                filePath,
                {
                    headers: {
                        "Content-Disposition":
                            `inline; filename="${String(
                                resource.original_file_name ||
                                "learnvault-resource"
                            ).replace(/"/g, "")}"`
                    }
                }
            );


        } catch (error) {

            console.error(
                "Student resource file error:",
                error
            );


            return res
                .status(500)
                .json({
                    success: false,
                    message:
                        "Unable to open resource file"
                });

        }

    }
);


module.exports =
    router;
