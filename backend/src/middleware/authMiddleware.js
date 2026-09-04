const jwt = require("jsonwebtoken");


function authenticateUser(
    req,
    res,
    next
) {

    /* =====================================================
       GET JWT COOKIE
    ===================================================== */

    const token =
        req.cookies
            ? req.cookies.learnvault_token
            : null;


    /* =====================================================
       TOKEN MISSING
    ===================================================== */

    if (!token) {

        return res
            .status(401)
            .json({

                success: false,

                message:
                    "Authentication required"

            });

    }


    /* =====================================================
       VERIFY TOKEN
    ===================================================== */

    try {

        const decoded =
            jwt.verify(
                token,
                process.env.JWT_SECRET
            );


        /* =================================================
           SAVE USER DATA IN REQUEST
        ================================================= */

        req.user = {

            userId:
                decoded.userId,

            role:
                decoded.role

        };


        next();


    } catch (error) {

        console.error(
            "JWT verification error:",
            error.message
        );


        return res
            .status(401)
            .json({

                success: false,

                message:
                    "Invalid or expired session"

            });

    }

}


module.exports =
    authenticateUser;