require("dotenv").config();

const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const path = require("path");

const db = require("./config/db");

const authRoutes =
    require("./routes/authRoutes");

const resourceRoutes =
    require("./routes/resourceRoutes");

const academicRoutes =
    require("./routes/academicRoutes");

const adminRoutes =
    require("./routes/adminRoutes");

const facultyRoutes =
    require("./routes/facultyRoutes");

const contentRoutes =
    require("./routes/contentRoutes");

const studentRoutes =
    require("./routes/studentRoutes");

const questionRoutes =
    require("./routes/questionRoutes");

const quizRoutes =
    require("./routes/quizRoutes");

const progressRoutes =
    require("./routes/progressRoutes");

const skillRoutes =
    require("./routes/skillRoutes");

const peerRoutes =
    require("./routes/peerRoutes");

const assignmentRoutes =
    require("./routes/assignmentRoutes");

const integrationRoutes =
    require("./routes/integrationRoutes");

const studentExperienceRoutes =
    require("./routes/studentExperienceRoutes");

const academicProgressionRoutes =
    require("./routes/academicProgressionRoutes");

const notificationRoutes =
    require("./routes/notificationRoutes");

const calendarRoutes =
    require("./routes/calendarRoutes");


const app =
    express();


const PORT =
    Number(
        process.env.PORT ||
        5000
    );


const production =
    process.env.NODE_ENV ===
    "production";


/* =====================================================
   REVERSE PROXY

   Render terminates HTTPS before forwarding traffic to
   Express. Trust one proxy hop so Express understands
   production proxy headers correctly.
===================================================== */

app.set(
    "trust proxy",
    1
);


/* =====================================================
   ALLOWED FRONTEND ORIGINS
===================================================== */

function normalizeOrigin(
    value
) {

    return String(
        value ||
        ""
    )
        .trim()
        .replace(
            /\/$/,
            ""
        );

}


const configuredOrigins =
    [
        process.env.FRONTEND_URL,

        ...String(
            process.env.CORS_ORIGINS ||
            ""
        )
            .split(",")
    ]
        .map(
            normalizeOrigin
        )
        .filter(
            Boolean
        );


const allowedOrigins =
    new Set(
        configuredOrigins
    );


if (!production) {

    [
        "http://localhost:5000",
        "http://127.0.0.1:5000",
        "http://localhost:5500",
        "http://127.0.0.1:5500"
    ]
        .forEach(
            (origin) =>
                allowedOrigins.add(
                    origin
                )
        );

}


function originAllowed(
    origin
) {

    /*
       Browser-less tools, Render health checks and same-service
       requests can arrive without an Origin header.
    */

    if (!origin) {
        return true;
    }


    const normalized =
        normalizeOrigin(
            origin
        );


    if (
        allowedOrigins.has(
            normalized
        )
    ) {
        return true;
    }


    /*
       Optional convenience for Vercel Preview URLs.
       Leave false in normal production unless you explicitly
       want every Vercel preview deployment to call this API.
    */

    if (
        String(
            process.env.ALLOW_VERCEL_PREVIEWS ||
            ""
        ).toLowerCase() ===
            "true" &&
        /^https:\/\/[a-z0-9.-]+\.vercel\.app$/i
            .test(
                normalized
            )
    ) {
        return true;
    }


    return false;

}


/* =====================================================
   MIDDLEWARE
===================================================== */

app.use(
    cors({

        origin:
            (
                origin,
                callback
            ) => {

                if (
                    originAllowed(
                        origin
                    )
                ) {

                    return callback(
                        null,
                        true
                    );

                }


                return callback(
                    new Error(
                        "Origin is not allowed by LearnVault CORS policy"
                    )
                );

            },

        credentials:
            true,

        methods: [
            "GET",
            "POST",
            "PUT",
            "PATCH",
            "DELETE",
            "OPTIONS"
        ],

        allowedHeaders: [
            "Content-Type",
            "Authorization",
            "X-Requested-With"
        ]

    })
);


app.use(
    (
        req,
        res,
        next
    ) => {

        res.setHeader(
            "X-Content-Type-Options",
            "nosniff"
        );

        res.setHeader(
            "Referrer-Policy",
            "strict-origin-when-cross-origin"
        );

        res.setHeader(
            "X-Frame-Options",
            "SAMEORIGIN"
        );

        next();

    }
);


app.use(
    express.json({
        limit:
            process.env.JSON_BODY_LIMIT ||
            "2mb"
    })
);


app.use(
    express.urlencoded({
        extended:
            true,

        limit:
            process.env.FORM_BODY_LIMIT ||
            "2mb"
    })
);


app.use(
    cookieParser()
);


/* =====================================================
   API ROUTES
===================================================== */

app.use(
    "/api/auth",
    authRoutes
);

app.use(
    "/api/resources",
    resourceRoutes
);

app.use(
    "/api/academic",
    academicRoutes
);

app.use(
    "/api/admin",
    adminRoutes
);

app.use(
    "/api/faculty",
    facultyRoutes
);

app.use(
    "/api/content",
    contentRoutes
);

app.use(
    "/api/student",
    studentRoutes
);

app.use(
    "/api/question-bank",
    questionRoutes
);

app.use(
    "/api/quizzes",
    quizRoutes
);

app.use(
    "/api/progress",
    progressRoutes
);

app.use(
    "/api/skills",
    skillRoutes
);

app.use(
    "/api/peer",
    peerRoutes
);

app.use(
    "/api/assignments",
    assignmentRoutes
);

app.use(
    "/api/integration",
    integrationRoutes
);

app.use(
    "/api/student-experience",
    studentExperienceRoutes
);

app.use(
    "/api/academic-progress",
    academicProgressionRoutes
);

app.use(
    "/api/notifications",
    notificationRoutes
);

app.use(
    "/api/calendar",
    calendarRoutes
);





/* =====================================================
   HEALTH CHECK
===================================================== */

app.get(
    "/api/health",
    async (
        req,
        res
    ) => {

        try {

            await db.query(
                "SELECT 1"
            );


            return res
                .status(200)
                .json({
                    success:
                        true,

                    service:
                        "LearnVault API",

                    environment:
                        process.env.NODE_ENV ||
                        "development",

                    database:
                        "connected"
                });

        } catch (error) {

            return res
                .status(503)
                .json({
                    success:
                        false,

                    service:
                        "LearnVault API",

                    database:
                        "unavailable"
                });

        }

    }
);


/* =====================================================
   DATABASE TEST

   Keep this endpoint useful during initial deployment,
   but do not expose credentials.
===================================================== */

app.get(
    "/api/db-test",
    async (
        req,
        res
    ) => {

        try {

            const [rows] =
                await db.query(
                    `
                    SELECT
                        DATABASE()
                        AS database_name
                    `
                );


            return res.json({
                success:
                    true,

                message:
                    "MySQL connected successfully",

                database:
                    rows[0]
                        .database_name
            });

        } catch (error) {

            console.error(
                "Database test error:",
                error.message
            );


            return res
                .status(500)
                .json({
                    success:
                        false,

                    message:
                        "Database connection failed"
                });

        }

    }
);


/* =====================================================
   OPTIONAL LOCAL FRONTEND

   Local development can still run exactly as before from
   http://localhost:5000.

   Render production is API-only because Vercel serves the
   frontend separately.
===================================================== */

const serveFrontend =
    !production ||
    String(
        process.env.SERVE_FRONTEND ||
        ""
    ).toLowerCase() ===
        "true";


if (serveFrontend) {

    const frontendPath =
        path.join(
            __dirname,
            "../../frontend"
        );


    app.use(
        express.static(
            frontendPath
        )
    );


    app.get(
        "/",
        (
            req,
            res
        ) => {

            return res.sendFile(
                path.join(
                    frontendPath,
                    "index.html"
                )
            );

        }
    );


    app.use(
        (
            req,
            res
        ) => {

            if (
                req.path.startsWith(
                    "/api/"
                )
            ) {

                return res
                    .status(404)
                    .json({
                        success:
                            false,

                        message:
                            "API endpoint not found"
                    });

            }


            const notFoundPage =
                path.join(
                    frontendPath,
                    "404.html"
                );


            return res
                .status(404)
                .sendFile(
                    notFoundPage,
                    (error) => {

                        if (error) {

                            res
                                .status(404)
                                .send(
                                    "Page not found"
                                );

                        }

                    }
                );

        }
    );

} else {

    app.get(
        "/",
        (
            req,
            res
        ) => {

            return res.json({
                success:
                    true,

                service:
                    "LearnVault API",

                health:
                    "/api/health"
            });

        }
    );


    app.use(
        "/api",
        (
            req,
            res
        ) => {

            return res
                .status(404)
                .json({
                    success:
                        false,

                    message:
                        "API endpoint not found"
                });

        }
    );


    app.use(
        (
            req,
            res
        ) => {

            return res
                .status(404)
                .json({
                    success:
                        false,

                    message:
                        "Route not found"
                });

        }
    );

}


/* =====================================================
   ERROR HANDLER
===================================================== */

app.use(
    (
        error,
        req,
        res,
        next
    ) => {

        if (
            String(
                error.message ||
                ""
            ).includes(
                "CORS policy"
            )
        ) {

            return res
                .status(403)
                .json({
                    success:
                        false,

                    message:
                        error.message
                });

        }


        console.error(
            "Unhandled LearnVault error:",
            error
        );


        return res
            .status(500)
            .json({
                success:
                    false,

                message:
                    "Internal server error"
            });

    }
);


/* =====================================================
   START SERVER
===================================================== */

async function startServer() {

    try {

        const connection =
            await db.getConnection();


        const [rows] =
            await connection.query(
                `
                SELECT
                    DATABASE()
                    AS database_name
                `
            );


        connection.release();


        console.log(
            "MySQL connected successfully"
        );


        console.log(
            `Database: ${rows[0].database_name}`
        );


        const server =
            app.listen(
                PORT,
                "0.0.0.0",
                () => {

                    console.log(
                        `LearnVault API listening on port ${PORT}`
                    );

                    if (
                        process.env.RENDER_EXTERNAL_URL
                    ) {

                        console.log(
                            `Public API: ${process.env.RENDER_EXTERNAL_URL}`
                        );

                    }

                }
            );


        async function shutdown(
            signal
        ) {

            console.log(
                `${signal} received. Closing LearnVault API.`
            );


            server.close(
                async () => {

                    try {
                        await db.end();
                    } catch (_) {}


                    process.exit(
                        0
                    );

                }
            );

        }


        process.on(
            "SIGTERM",
            () =>
                shutdown(
                    "SIGTERM"
                )
        );


        process.on(
            "SIGINT",
            () =>
                shutdown(
                    "SIGINT"
                )
        );

    } catch (error) {

        console.error(
            "LearnVault startup failed:"
        );


        console.error(
            error.message
        );


        process.exit(
            1
        );

    }

}


startServer();
