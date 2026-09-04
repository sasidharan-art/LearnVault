document.addEventListener("DOMContentLoaded", async () => {
    const loading = document.getElementById("studentLoading");
    const content = document.getElementById("studentDashboardContent");
    const toast = document.getElementById("toast");
    const logoutButton = document.getElementById("logoutButton");


    function showToast(message) {
        if (!toast) {
            console.log(message);
            return;
        }

        toast.textContent = message;
        toast.classList.add("show");
        clearTimeout(toast.hideTimer);
        toast.hideTimer = setTimeout(() => toast.classList.remove("show"), 2800);
    }

    function setText(id, value) {
        const element = document.getElementById(id);
        if (!element) return;
        const text = value === null || value === undefined || value === "" ? "-" : String(value);
        element.textContent = text;
    }

    async function loadStudent() {
        try {
            const response = await fetch("/api/auth/me", {
                method: "GET",
                credentials: "same-origin"
            });

            let result;
            try {
                result = await response.json();
            } catch (error) {
                throw new Error("Invalid response from the LearnVault server.");
            }

            if (response.status === 401) {
                window.location.replace("../login.html");
                return;
            }

            if (!response.ok) {
                throw new Error(result.message || "Unable to load your account.");
            }

            if (!result.user || String(result.user.role).toLowerCase() !== "student") {
                showToast("Student access only.");
                setTimeout(() => window.location.replace("../index.html"), 900);
                return;
            }

            const user = result.user;

            setText("headerStudentName", user.fullName);
            setText("welcomeStudentName", user.fullName);
            setText("cardStudentName", user.fullName);
            setText("dashboardUsername", user.username);
            setText("dashboardUserId", user.id);
            setText("dashboardStatus", user.status);
            setText("dashboardCourse", user.courseName);
            setText("dashboardLevel", user.levelName);
            setText("profileFullName", user.fullName);
            setText("profileUsername", user.username);
            setText("profileEmail", user.email);
            setText("profilePhone", user.phone);
            setText("profileDomain", user.domainName);
            setText("profileDepartment", user.departmentName);
            setText("profileCourse", user.courseName);
            setText("profileLevel", user.levelName);
            setText("profileStatus", user.status);

            setText("heroDomain", user.domainName);
            setText("heroDepartment", user.departmentName);
            setText("heroCourse", user.courseName);
            setText("heroLevel", user.levelName);

            const workspaceTitle =
                document.getElementById("learningWorkspaceTitle");

            const workspaceDescription =
                document.getElementById("learningWorkspaceDescription");


            /*
               Load the student's live learning summary.
               Failure here should never block the profile dashboard.
            */
            try {

                const learningResponse =
                    await fetch(
                        "/api/student/dashboard",
                        {
                            credentials:
                                "same-origin"
                        }
                    );


                if (learningResponse.ok) {

                    const learningResult =
                        await learningResponse.json();


                    const learningSummary =
                        learningResult.dashboard ||
                        {};


                    const resourceCard =
                        document.querySelector(
                            'a[href="resources.html"] .module-state'
                        );


                    if (resourceCard) {

                        resourceCard.textContent =
                            `${Number(
                                learningSummary.approvedResourceCount ||
                                0
                            )} approved resource${
                                Number(
                                    learningSummary.approvedResourceCount ||
                                    0
                                ) === 1
                                    ? ""
                                    : "s"
                            }`;

                    }

                }

            } catch (summaryError) {

                console.warn(
                    "Student learning summary unavailable:",
                    summaryError
                );

            }

            if (workspaceTitle && user.courseName) {
                workspaceTitle.textContent =
                    `${user.courseName} learning workspace`;
            }

            if (workspaceDescription) {
                const course =
                    user.courseName || "selected course";

                const level =
                    user.levelName
                        ? ` • ${user.levelName}`
                        : "";

                workspaceDescription.textContent =
                    `Resources, question banks and quizzes will be filtered for ${course}${level}.`;
            }

            if (loading) loading.hidden = true;
            if (content) content.hidden = false;
        } catch (error) {
            console.error("Student dashboard error:", error);
            if (loading) {
                loading.innerHTML = `<strong>${error.message}</strong><span>Please refresh or log in again.</span>`;
            }
            showToast(error.message);
        }
    }

    if (logoutButton) {
        logoutButton.addEventListener("click", async () => {
            try {
                logoutButton.disabled = true;
                logoutButton.textContent = "Logging out...";

                const response = await fetch("/api/auth/logout", {
                    method: "POST",
                    credentials: "same-origin"
                });

                const result = await response.json();
                if (!response.ok) throw new Error(result.message || "Logout failed.");

                window.location.replace("../login.html");
            } catch (error) {
                showToast(error.message);
                logoutButton.disabled = false;
                logoutButton.textContent = "Logout";
            }
        });
    }

    document.querySelectorAll(".coming-student-link").forEach((element) => {
        element.addEventListener("click", (event) => {
            event.preventDefault();
            showToast("This LearnVault module will be connected in the next phase.");
        });

        element.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                showToast("This LearnVault module will be connected in the next phase.");
            }
        });
    });

    await loadStudent();
});
