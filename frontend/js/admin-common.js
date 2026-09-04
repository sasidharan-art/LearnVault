document.addEventListener("DOMContentLoaded", () => {

    const logoutButton =
        document.getElementById("logoutButton");

    const toast =
        document.getElementById("toast");


    function showToast(message, type = "") {

        if (!toast) {
            console.log(message);
            return;
        }

        toast.textContent = message;
        toast.className = "toast show";

        if (type) {
            toast.classList.add(type);
        }

        clearTimeout(toast.hideTimer);

        toast.hideTimer =
            setTimeout(
                () => {
                    toast.className = "toast";
                },
                3000
            );

    }



    async function requireAdmin() {

        try {

            const response =
                await fetch(
                    "/api/auth/me",
                    {
                        method: "GET",
                        credentials: "same-origin"
                    }
                );


            const result =
                await response.json();


            if (
                !response.ok ||
                !result.success ||
                !result.user
            ) {

                window.location.href =
                    "../login.html";

                return null;

            }


            const role =
                String(
                    result.user.role || ""
                )
                    .trim()
                    .toLowerCase();


            if (role !== "admin") {

                showToast(
                    "Admin access is required.",
                    "error"
                );


                setTimeout(
                    () => {
                        window.location.href =
                            "../index.html";
                    },
                    500
                );


                return null;

            }


            const headerAdminName =
                document.getElementById(
                    "headerAdminName"
                );


            if (headerAdminName) {

                headerAdminName.textContent =
                    result.user.fullName ||
                    "Administrator";

            }


            return result.user;


        } catch (error) {

            console.error(
                "Admin authentication error:",
                error
            );


            window.location.href =
                "../login.html";


            return null;

        }

    }


    if (logoutButton) {

        logoutButton.addEventListener(
            "click",
            async () => {

                try {

                    await fetch(
                        "/api/auth/logout",
                        {
                            method: "POST",
                            credentials:
                                "same-origin"
                        }
                    );

                } finally {

                    window.location.href =
                        "../login.html";

                }

            }
        );

    }


    window.LearnVaultAdmin = {
        showToast,
        requireAdmin
    };

});
