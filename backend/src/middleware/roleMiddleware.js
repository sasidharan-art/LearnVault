function authorizeRoles(...allowedRoles) {

    return (req, res, next) => {

        if (
            !req.user ||
            !req.user.role
        ) {

            return res
                .status(401)
                .json({
                    success: false,
                    message: "Authentication required"
                });

        }


        const userRole =
            String(req.user.role)
                .trim()
                .toLowerCase();


        const normalizedAllowedRoles =
            allowedRoles.map(
                (role) =>
                    String(role)
                        .trim()
                        .toLowerCase()
            );


        if (
            !normalizedAllowedRoles.includes(
                userRole
            )
        ) {

            return res
                .status(403)
                .json({
                    success: false,
                    message:
                        "You do not have permission to perform this action"
                });

        }


        next();

    };

}


module.exports = authorizeRoles;
