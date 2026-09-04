document.addEventListener("DOMContentLoaded", async () => {

    const admin =
        window.LearnVaultAdmin;

    if (!admin) return;


    const user =
        await admin.requireAdmin();

    if (!user) return;


    function setText(id, value) {

        const element =
            document.getElementById(id);

        if (element) {
            element.textContent =
                Number(value || 0);
        }

    }


    try {

        const response =
            await fetch(
                "/api/admin/overview",
                {
                    credentials:
                        "same-origin"
                }
            );


        const result =
            await response.json();


        if (!response.ok) {

            throw new Error(
                result.message ||
                "Unable to load Admin overview"
            );

        }


        const overview =
            result.overview || {};


        setText(
            "overviewUsers",
            overview.total_users
        );

        setText(
            "overviewStudents",
            overview.students
        );

        setText(
            "overviewFaculty",
            overview.faculty
        );

        setText(
            "overviewCourses",
            overview.active_courses
        );

        setText(
            "overviewPending",
            overview.pending_resources
        );

        setText(
            "overviewApproved",
            overview.approved_resources
        );


    } catch (error) {

        console.error(
            "Admin overview error:",
            error
        );


        admin.showToast(
            error.message,
            "error"
        );

    }

});
