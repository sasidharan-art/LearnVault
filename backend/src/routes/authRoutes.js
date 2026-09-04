const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const db = require("../config/db");

const authenticateUser =
    require("../middleware/authMiddleware");

const {
    sendPasswordResetOtp,
    devModeEnabled
} =
    require("../services/mailService");


const router =
    express.Router();


/* =====================================================
   AUTH COOKIE OPTIONS

   Local development:
       sameSite=lax
       secure=false

   Production through the Vercel /api reverse proxy:
       sameSite=lax
       secure=true

   This keeps the JWT first-party to the Vercel frontend
   instead of relying on third-party cookies.
===================================================== */

function getAuthCookieOptions() {

    const production =
        process.env.NODE_ENV ===
        "production";


    const configuredSameSite =
        String(
            process.env.COOKIE_SAME_SITE ||
            "lax"
        )
            .trim()
            .toLowerCase();


    const sameSite =
        ["lax", "strict", "none"]
            .includes(
                configuredSameSite
            )
            ? configuredSameSite
            : "lax";


    const secure =
        process.env.COOKIE_SECURE !==
        undefined
            ? String(
                process.env.COOKIE_SECURE
            ).toLowerCase() ===
                "true"
            : production;


    return {
        httpOnly:
            true,

        secure,

        sameSite,

        path:
            "/"
    };

}


/* =====================================================
   USERNAME GENERATOR
===================================================== */

function createUsernameBase(fullName) {

    const base =
        String(fullName || "")
            .normalize("NFD")
            .replace(
                /[\u0300-\u036f]/g,
                ""
            )
            .toLowerCase()
            .replace(
                /[^a-z0-9]/g,
                ""
            )
            .slice(0, 36);


    return base || "student";

}


async function generateUniqueUsername(
    connection,
    fullName
) {

    const base =
        createUsernameBase(
            fullName
        );


    let username =
        base;

    let counter =
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
                [
                    username
                ]
            );


        if (
            rows.length === 0
        ) {

            return username;

        }


        const suffix =
            String(counter);


        username =
            `${base.slice(
                0,
                Math.max(
                    1,
                    50 - suffix.length
                )
            )}${suffix}`;


        counter += 1;

    }

}


/* =====================================================
   STUDENT REGISTRATION

   Student chooses:
   - Course / Program
   - Current Level / Year (when the course has levels)

   Semester is NOT collected during registration.
===================================================== */

router.post(
    "/register",
    async (req, res) => {

        const {
            fullName,
            email,
            phone,
            courseId,
            courseLevelId,
            password,
            confirmPassword
        } = req.body;


        if (
            !fullName ||
            !email ||
            !phone ||
            !courseId ||
            !password ||
            !confirmPassword
        ) {

            return res
                .status(400)
                .json({
                    success: false,
                    message:
                        "Please fill all required fields"
                });

        }


        if (
            password !==
            confirmPassword
        ) {

            return res
                .status(400)
                .json({
                    success: false,
                    message:
                        "Passwords do not match"
                });

        }


        if (
            String(password).length < 8
        ) {

            return res
                .status(400)
                .json({
                    success: false,
                    message:
                        "Password must contain at least 8 characters"
                });

        }


        const parsedCourseId =
            Number(courseId);


        const parsedLevelId =
            courseLevelId
                ? Number(courseLevelId)
                : null;


        if (
            !Number.isInteger(
                parsedCourseId
            ) ||
            parsedCourseId <= 0
        ) {

            return res
                .status(400)
                .json({
                    success: false,
                    message:
                        "Please select a valid course / program"
                });

        }


        if (
            parsedLevelId !== null &&
            (
                !Number.isInteger(
                    parsedLevelId
                ) ||
                parsedLevelId <= 0
            )
        ) {

            return res
                .status(400)
                .json({
                    success: false,
                    message:
                        "Please select a valid current level / year"
                });

        }


        const normalizedEmail =
            String(email)
                .trim()
                .toLowerCase();

        const normalizedPhone =
            String(phone)
                .trim();

        const normalizedFullName =
            String(fullName)
                .trim();


        let connection;


        try {

            connection =
                await db.getConnection();


            const [emailRows] =
                await connection.query(
                    `
                    SELECT id
                    FROM users
                    WHERE LOWER(email) = ?
                    LIMIT 1
                    `,
                    [
                        normalizedEmail
                    ]
                );


            if (
                emailRows.length > 0
            ) {

                return res
                    .status(409)
                    .json({
                        success: false,
                        message:
                            "An account already exists with this email"
                    });

            }


            const [phoneRows] =
                await connection.query(
                    `
                    SELECT id
                    FROM users
                    WHERE phone = ?
                    LIMIT 1
                    `,
                    [
                        normalizedPhone
                    ]
                );


            if (
                phoneRows.length > 0
            ) {

                return res
                    .status(409)
                    .json({
                        success: false,
                        message:
                            "An account already exists with this phone number"
                    });

            }


            const [roleRows] =
                await connection.query(
                    `
                    SELECT id
                    FROM roles
                    WHERE role_name = 'student'
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
                            "Student role is not configured"
                    });

            }


            const [courseRows] =
                await connection.query(
                    `
                    SELECT
                        c.id,
                        c.course_name,
                        c.structure_type

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
                        parsedCourseId
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
                            "Selected course / program is not available"
                    });

            }


            const [availableLevels] =
                await connection.query(
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
                        parsedCourseId
                    ]
                );


            if (
                availableLevels.length > 0 &&
                parsedLevelId === null
            ) {

                return res
                    .status(400)
                    .json({
                        success: false,
                        message:
                            "Please select your current level / year"
                    });

            }


            if (
                parsedLevelId !== null
            ) {

                const levelBelongsToCourse =
                    availableLevels.some(
                        (level) =>
                            Number(level.id) ===
                            parsedLevelId
                    );


                if (
                    !levelBelongsToCourse
                ) {

                    return res
                        .status(400)
                        .json({
                            success: false,
                            message:
                                "Selected level does not belong to the selected course"
                        });

                }

            }


            const passwordHash =
                await bcrypt.hash(
                    String(password),
                    12
                );


            const username =
                await generateUniqueUsername(
                    connection,
                    normalizedFullName
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
                        password_hash
                    )
                    VALUES (?, ?, ?, ?, ?, ?)
                    `,
                    [
                        roleRows[0].id,
                        normalizedFullName,
                        username,
                        normalizedEmail,
                        normalizedPhone,
                        passwordHash
                    ]
                );


            const userId =
                userResult.insertId;


            await connection.query(
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
                    parsedCourseId,
                    parsedLevelId
                ]
            );


            await connection.commit();


            return res
                .status(201)
                .json({

                    success: true,

                    message:
                        "Student account created successfully",

                    user: {

                        id:
                            userId,

                        fullName:
                            normalizedFullName,

                        username,

                        email:
                            normalizedEmail,

                        role:
                            "student",

                        courseId:
                            parsedCourseId,

                        courseName:
                            courseRows[0].course_name,

                        courseLevelId:
                            parsedLevelId

                    }

                });


        } catch (error) {

            if (connection) {

                try {

                    await connection.rollback();

                } catch (
                    rollbackError
                ) {

                    console.error(
                        "Rollback error:",
                        rollbackError.message
                    );

                }

            }


            console.error(
                "Registration error:",
                error
            );


            return res
                .status(500)
                .json({
                    success: false,
                    message:
                        "Unable to create student account"
                });


        } finally {

            if (connection) {

                connection.release();

            }

        }

    }
);


/* =====================================================
   LOGIN

   Student can use:
   - Email
   - Username
   - Numeric User ID
===================================================== */

router.post(
    "/login",
    async (req, res) => {

        const {
            identifier,
            password
        } = req.body;


        if (
            !identifier ||
            !password
        ) {

            return res
                .status(400)
                .json({
                    success: false,
                    message:
                        "Email, Username or User ID and password are required"
                });

        }


        try {

            const rawIdentifier =
                String(identifier)
                    .trim();

            const normalizedIdentifier =
                rawIdentifier
                    .toLowerCase();


            const [rows] =
                await db.query(
                    `
                    SELECT
                        u.id,
                        u.full_name,
                        u.username,
                        u.email,
                        u.phone,
                        u.password_hash,
                        u.status,
                        r.role_name

                    FROM users u

                    INNER JOIN roles r
                        ON u.role_id = r.id

                    WHERE
                        LOWER(u.email) = ?
                        OR LOWER(u.username) = ?
                        OR CAST(u.id AS CHAR) = ?

                    LIMIT 1
                    `,
                    [
                        normalizedIdentifier,
                        normalizedIdentifier,
                        rawIdentifier
                    ]
                );


            if (
                rows.length === 0
            ) {

                return res
                    .status(401)
                    .json({
                        success: false,
                        message:
                            "Invalid Email, Username, User ID or password"
                    });

            }


            const user =
                rows[0];


            if (
                user.status !==
                "active"
            ) {

                return res
                    .status(403)
                    .json({
                        success: false,
                        message:
                            "Your account is not active. Please contact the administrator."
                    });

            }


            const passwordMatches =
                await bcrypt.compare(
                    String(password),
                    user.password_hash
                );


            if (
                !passwordMatches
            ) {

                return res
                    .status(401)
                    .json({
                        success: false,
                        message:
                            "Invalid Email, Username, User ID or password"
                    });

            }


            const token =
                jwt.sign(
                    {
                        userId:
                            user.id,

                        role:
                            user.role_name
                    },
                    process.env.JWT_SECRET,
                    {
                        expiresIn:
                            process.env.JWT_EXPIRES_IN ||
                            "1d"
                    }
                );


            res.cookie(
                "learnvault_token",
                token,
                {
                    ...getAuthCookieOptions(),

                    maxAge:
                        24 *
                        60 *
                        60 *
                        1000
                }
            );


            return res.json({

                success: true,

                message:
                    "Login successful",

                user: {

                    id:
                        user.id,

                    fullName:
                        user.full_name,

                    username:
                        user.username,

                    email:
                        user.email,

                    role:
                        user.role_name

                }

            });


        } catch (error) {

            console.error(
                "Login error:",
                error
            );


            return res
                .status(500)
                .json({
                    success: false,
                    message:
                        "Unable to login"
                });

        }

    }
);


/* =====================================================
   CURRENT LOGGED-IN USER
===================================================== */

router.get(
    "/me",
    authenticateUser,
    async (req, res) => {

        try {

            const [rows] =
                await db.query(
                    `
                    SELECT
                        u.id,
                        u.full_name,
                        u.username,
                        u.email,
                        u.phone,
                        u.status,

                        r.role_name,

                        sp.course_id,
                        sp.course_level_id,

                        c.course_code,
                        c.course_name,

                        cl.level_name,

                        d.id
                            AS department_id,

                        d.department_code,

                        d.department_name,

                        ed.id
                            AS domain_id,

                        ed.domain_name

                    FROM users u

                    INNER JOIN roles r
                        ON u.role_id = r.id

                    LEFT JOIN student_profiles sp
                        ON sp.user_id = u.id

                    LEFT JOIN courses c
                        ON sp.course_id = c.id

                    LEFT JOIN course_levels cl
                        ON sp.course_level_id = cl.id

                    LEFT JOIN departments d
                        ON c.department_id = d.id

                    LEFT JOIN education_domains ed
                        ON c.domain_id = ed.id

                    WHERE
                        u.id = ?

                    LIMIT 1
                    `,
                    [
                        req.user.userId
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
                            "User account not found"
                    });

            }


            const user =
                rows[0];


            return res
                .status(200)
                .json({

                    success: true,

                    user: {

                        id:
                            user.id,

                        fullName:
                            user.full_name,

                        username:
                            user.username,

                        email:
                            user.email,

                        phone:
                            user.phone,

                        role:
                            user.role_name,

                        status:
                            user.status,

                        courseId:
                            user.course_id,

                        courseLevelId:
                            user.course_level_id,

                        courseCode:
                            user.course_code,

                        courseName:
                            user.course_name,

                        levelName:
                            user.level_name,

                        departmentId:
                            user.department_id,

                        departmentCode:
                            user.department_code,

                        departmentName:
                            user.department_name,

                        domainId:
                            user.domain_id,

                        domainName:
                            user.domain_name

                    }

                });


        } catch (error) {

            console.error(
                "Get current user error:",
                error
            );


            return res
                .status(500)
                .json({
                    success: false,
                    message:
                        "Unable to load account information"
                });

        }

    }
);




/* =====================================================
   FORGOT PASSWORD
   EMAIL -> 6 DIGIT OTP -> VERIFY -> NEW PASSWORD
===================================================== */

function normalizeEmail(value) {

    return String(
        value || ""
    )
        .trim()
        .toLowerCase();

}


function validEmail(value) {

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        value
    );

}


function createSixDigitOtp() {

    return String(
        Math.floor(
            100000 +
            Math.random() * 900000
        )
    );

}


/* -----------------------------------------------------
   STEP 1: REQUEST OTP
----------------------------------------------------- */

router.post(
    "/forgot-password",
    async (req, res) => {

        const email =
            normalizeEmail(
                req.body.email
            );


        if (
            !email ||
            !validEmail(email)
        ) {

            return res
                .status(400)
                .json({
                    success: false,
                    message:
                        "Enter a valid email address"
                });

        }


        try {

            const [users] =
                await db.query(
                    `
                    SELECT
                        id,
                        full_name,
                        email,
                        status

                    FROM users

                    WHERE
                        LOWER(email) = ?

                    LIMIT 1
                    `,
                    [
                        email
                    ]
                );


            /*
               Do not expose whether an email is registered.
            */

            if (
                users.length === 0 ||
                users[0].status !== "active"
            ) {

                return res.json({
                    success: true,
                    message:
                        "If an active LearnVault account exists for this email, a reset OTP has been sent."
                });

            }


            const user =
                users[0];


            const [recentRows] =
                await db.query(
                    `
                    SELECT
                        id,
                        created_at

                    FROM password_reset_otps

                    WHERE
                        user_id = ?
                        AND used_at IS NULL
                        AND created_at >=
                            DATE_SUB(
                                NOW(),
                                INTERVAL 60 SECOND
                            )

                    ORDER BY
                        created_at DESC

                    LIMIT 1
                    `,
                    [
                        user.id
                    ]
                );


            if (
                recentRows.length > 0
            ) {

                return res
                    .status(429)
                    .json({
                        success: false,
                        message:
                            "Please wait about one minute before requesting another OTP."
                    });

            }


            await db.query(
                `
                UPDATE password_reset_otps

                SET used_at = NOW()

                WHERE
                    user_id = ?
                    AND used_at IS NULL
                `,
                [
                    user.id
                ]
            );


            const otp =
                createSixDigitOtp();


            const otpHash =
                await bcrypt.hash(
                    otp,
                    10
                );


            const [otpResult] =
                await db.query(
                    `
                    INSERT INTO password_reset_otps
                    (
                        user_id,
                        otp_hash,
                        expires_at,
                        attempts
                    )
                    VALUES
                    (
                        ?,
                        ?,
                        DATE_ADD(
                            NOW(),
                            INTERVAL 10 MINUTE
                        ),
                        0
                    )
                    `,
                    [
                        user.id,
                        otpHash
                    ]
                );


            try {

                await sendPasswordResetOtp({
                    email:
                        user.email,
                    fullName:
                        user.full_name,
                    otp
                });


            } catch (mailError) {

                await db.query(
                    `
                    UPDATE password_reset_otps

                    SET used_at = NOW()

                    WHERE id = ?
                    `,
                    [
                        otpResult.insertId
                    ]
                );


                console.error(
                    "Password reset email error:",
                    mailError.message
                );


                return res
                    .status(500)
                    .json({
                        success: false,
                        message:
                            mailError.message
                    });

            }


            const responseBody = {
                success: true,
                message:
                    "If an active LearnVault account exists for this email, a reset OTP has been sent."
            };


            if (
                devModeEnabled()
            ) {

                responseBody.devOtp =
                    otp;

                responseBody.devMode =
                    true;

            }


            return res.json(
                responseBody
            );


        } catch (error) {

            console.error(
                "Forgot password error:",
                error
            );


            return res
                .status(500)
                .json({
                    success: false,
                    message:
                        "Unable to process password reset request"
                });

        }

    }
);


/* -----------------------------------------------------
   STEP 2: VERIFY OTP
----------------------------------------------------- */

router.post(
    "/verify-reset-otp",
    async (req, res) => {

        const email =
            normalizeEmail(
                req.body.email
            );

        const otp =
            String(
                req.body.otp ||
                ""
            )
                .trim();


        if (
            !validEmail(email) ||
            !/^\d{6}$/.test(otp)
        ) {

            return res
                .status(400)
                .json({
                    success: false,
                    message:
                        "Enter the email and valid 6-digit OTP"
                });

        }


        try {

            const [rows] =
                await db.query(
                    `
                    SELECT
                        pro.id,
                        pro.user_id,
                        pro.otp_hash,
                        pro.expires_at,
                        pro.attempts,
                        pro.verified_at,

                        u.email,
                        u.status

                    FROM password_reset_otps pro

                    INNER JOIN users u
                        ON u.id = pro.user_id

                    WHERE
                        LOWER(u.email) = ?
                        AND pro.used_at IS NULL

                    ORDER BY
                        pro.created_at DESC

                    LIMIT 1
                    `,
                    [
                        email
                    ]
                );


            if (
                rows.length === 0
            ) {

                return res
                    .status(400)
                    .json({
                        success: false,
                        message:
                            "OTP is invalid or no longer available"
                    });

            }


            const record =
                rows[0];


            if (
                record.status !==
                "active"
            ) {

                return res
                    .status(403)
                    .json({
                        success: false,
                        message:
                            "This account is not active"
                    });

            }


            if (
                new Date(
                    record.expires_at
                ) <=
                new Date()
            ) {

                await db.query(
                    `
                    UPDATE password_reset_otps
                    SET used_at = NOW()
                    WHERE id = ?
                    `,
                    [
                        record.id
                    ]
                );


                return res
                    .status(400)
                    .json({
                        success: false,
                        message:
                            "OTP has expired. Request a new OTP."
                    });

            }


            if (
                Number(
                    record.attempts
                ) >= 5
            ) {

                await db.query(
                    `
                    UPDATE password_reset_otps
                    SET used_at = NOW()
                    WHERE id = ?
                    `,
                    [
                        record.id
                    ]
                );


                return res
                    .status(429)
                    .json({
                        success: false,
                        message:
                            "Too many incorrect OTP attempts. Request a new OTP."
                    });

            }


            const validOtp =
                await bcrypt.compare(
                    otp,
                    record.otp_hash
                );


            if (!validOtp) {

                await db.query(
                    `
                    UPDATE password_reset_otps

                    SET attempts =
                        attempts + 1

                    WHERE id = ?
                    `,
                    [
                        record.id
                    ]
                );


                return res
                    .status(400)
                    .json({
                        success: false,
                        message:
                            "Incorrect OTP"
                    });

            }


            await db.query(
                `
                UPDATE password_reset_otps

                SET
                    verified_at = NOW(),
                    attempts = attempts + 1

                WHERE id = ?
                `,
                [
                    record.id
                ]
            );


            const resetToken =
                jwt.sign(
                    {
                        purpose:
                            "password_reset",

                        userId:
                            record.user_id,

                        otpId:
                            record.id,

                        email:
                            String(
                                record.email
                            ).toLowerCase()
                    },
                    process.env.JWT_SECRET,
                    {
                        expiresIn:
                            "10m"
                    }
                );


            return res.json({
                success: true,
                message:
                    "OTP verified",
                resetToken
            });


        } catch (error) {

            console.error(
                "Verify reset OTP error:",
                error
            );


            return res
                .status(500)
                .json({
                    success: false,
                    message:
                        "Unable to verify OTP"
                });

        }

    }
);


/* -----------------------------------------------------
   STEP 3: RESET PASSWORD
----------------------------------------------------- */

router.post(
    "/reset-password",
    async (req, res) => {

        const resetToken =
            String(
                req.body.resetToken ||
                ""
            );

        const newPassword =
            String(
                req.body.newPassword ||
                ""
            );

        const confirmPassword =
            String(
                req.body.confirmPassword ||
                ""
            );


        if (
            !resetToken ||
            !newPassword ||
            !confirmPassword
        ) {

            return res
                .status(400)
                .json({
                    success: false,
                    message:
                        "Reset token and both password fields are required"
                });

        }


        if (
            newPassword !==
            confirmPassword
        ) {

            return res
                .status(400)
                .json({
                    success: false,
                    message:
                        "Passwords do not match"
                });

        }


        if (
            newPassword.length < 8
        ) {

            return res
                .status(400)
                .json({
                    success: false,
                    message:
                        "Password must contain at least 8 characters"
                });

        }


        let payload;


        try {

            payload =
                jwt.verify(
                    resetToken,
                    process.env.JWT_SECRET
                );


        } catch (error) {

            return res
                .status(400)
                .json({
                    success: false,
                    message:
                        "Reset session expired. Verify a new OTP."
                });

        }


        if (
            payload.purpose !==
            "password_reset" ||
            !payload.userId ||
            !payload.otpId
        ) {

            return res
                .status(400)
                .json({
                    success: false,
                    message:
                        "Invalid reset session"
                });

        }


        let connection;


        try {

            connection =
                await db.getConnection();


            const [rows] =
                await connection.query(
                    `
                    SELECT
                        pro.id,
                        pro.user_id,
                        pro.expires_at,
                        pro.verified_at,
                        pro.used_at,

                        u.password_hash,
                        u.status

                    FROM password_reset_otps pro

                    INNER JOIN users u
                        ON u.id = pro.user_id

                    WHERE
                        pro.id = ?
                        AND pro.user_id = ?

                    LIMIT 1
                    `,
                    [
                        payload.otpId,
                        payload.userId
                    ]
                );


            if (
                rows.length === 0
            ) {

                return res
                    .status(400)
                    .json({
                        success: false,
                        message:
                            "Reset session is no longer valid"
                    });

            }


            const record =
                rows[0];


            if (
                record.used_at ||
                !record.verified_at ||
                new Date(
                    record.expires_at
                ) <=
                new Date()
            ) {

                return res
                    .status(400)
                    .json({
                        success: false,
                        message:
                            "Reset session expired. Request a new OTP."
                    });

            }


            if (
                record.status !==
                "active"
            ) {

                return res
                    .status(403)
                    .json({
                        success: false,
                        message:
                            "This account is not active"
                    });

            }


            const sameAsOld =
                await bcrypt.compare(
                    newPassword,
                    record.password_hash
                );


            if (
                sameAsOld
            ) {

                return res
                    .status(400)
                    .json({
                        success: false,
                        message:
                            "New password must be different from your current password"
                    });

            }


            const passwordHash =
                await bcrypt.hash(
                    newPassword,
                    12
                );


            await connection.beginTransaction();


            await connection.query(
                `
                UPDATE users

                SET password_hash = ?

                WHERE id = ?
                `,
                [
                    passwordHash,
                    payload.userId
                ]
            );


            await connection.query(
                `
                UPDATE password_reset_otps

                SET used_at = NOW()

                WHERE id = ?
                `,
                [
                    payload.otpId
                ]
            );


            await connection.query(
                `
                UPDATE password_reset_otps

                SET used_at = NOW()

                WHERE
                    user_id = ?
                    AND used_at IS NULL
                `,
                [
                    payload.userId
                ]
            );


            await connection.commit();


            res.clearCookie(
                "learnvault_token",
                getAuthCookieOptions()
            );


            return res.json({
                success: true,
                message:
                    "Password reset successfully. You can now log in."
            });


        } catch (error) {

            if (connection) {

                try {
                    await connection.rollback();
                } catch (_) {}

            }


            console.error(
                "Reset password error:",
                error
            );


            return res
                .status(500)
                .json({
                    success: false,
                    message:
                        "Unable to reset password"
                });


        } finally {

            if (connection) {
                connection.release();
            }

        }

    }
);


/* =====================================================
   LOGOUT
===================================================== */

router.post(
    "/logout",
    (req, res) => {

        res.clearCookie(
                "learnvault_token",
                getAuthCookieOptions()
            );


        return res.json({
            success: true,
            message:
                "Logged out successfully",

            redirectTo:
                "/"
        });

    }
);


module.exports = router;
