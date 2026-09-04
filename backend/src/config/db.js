const mysql = require("mysql2/promise");


function boolEnv(
    name,
    fallback = false
) {

    if (
        process.env[name] ===
        undefined
    ) {

        return fallback;

    }


    return [
        "1",
        "true",
        "yes",
        "on"
    ].includes(
        String(
            process.env[name]
        )
            .trim()
            .toLowerCase()
    );

}


function numberEnv(
    name,
    fallback
) {

    const value =
        Number(
            process.env[name]
        );


    return Number.isFinite(value)
        ? value
        : fallback;

}


const production =
    process.env.NODE_ENV ===
    "production";


const requiredInProduction = [
    "DB_HOST",
    "DB_USER",
    "DB_NAME"
];


if (production) {

    const missing =
        requiredInProduction
            .filter(
                (key) =>
                    !String(
                        process.env[key] ||
                        ""
                    ).trim()
            );


    if (missing.length) {

        throw new Error(
            `Missing required database environment variables: ${missing.join(", ")}`
        );

    }

}


const config = {

    host:
        process.env.DB_HOST ||
        "127.0.0.1",

    port:
        numberEnv(
            "DB_PORT",
            3306
        ),

    user:
        process.env.DB_USER ||
        "root",

    password:
        process.env.DB_PASSWORD ||
        "",

    database:
        process.env.DB_NAME ||
        "learnvault_db",

    waitForConnections:
        true,

    connectionLimit:
        numberEnv(
            "DB_CONNECTION_LIMIT",
            production
                ? 5
                : 10
        ),

    queueLimit:
        0,

    enableKeepAlive:
        true,

    keepAliveInitialDelay:
        0,

    charset:
        "utf8mb4"

};


if (
    boolEnv(
        "DB_SSL",
        false
    )
) {

    config.ssl = {

        rejectUnauthorized:
            boolEnv(
                "DB_SSL_REJECT_UNAUTHORIZED",
                true
            )

    };


    const caBase64 =
        String(
            process.env.DB_SSL_CA_BASE64 ||
            ""
        ).trim();


    if (caBase64) {

        config.ssl.ca =
            Buffer.from(
                caBase64,
                "base64"
            )
                .toString(
                    "utf8"
                );

    }

}


const pool =
    mysql.createPool(
        config
    );


module.exports =
    pool;
