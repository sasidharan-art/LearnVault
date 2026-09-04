document.addEventListener("DOMContentLoaded", async () => {

    const h =
        window.LearnVaultLearning;


    if (!h) {
        return;
    }


    const role =
        document.body.dataset.commercialRole;


    h.bindLogout();


    const loading =
        document.getElementById(
            "commercialDashboardLoading"
        );

    const content =
        document.getElementById(
            "commercialDashboardContent"
        );

    const search =
        document.getElementById(
            "commercialDashboardSearch"
        );


    function text(
        id,
        value
    ) {

        const element =
            document.getElementById(
                id
            );


        if (element) {
            element.textContent =
                value;
        }

    }


    function width(
        id,
        value
    ) {

        const element =
            document.getElementById(
                id
            );


        if (element) {

            element.style.width =
                `${h.clamp(value)}%`;

        }

    }


    function percent(
        value
    ) {

        return `${Math.round(Number(value || 0))}%`;

    }


    function shortDate(
        value
    ) {

        if (!value) {
            return "No deadline";
        }


        const date =
            new Date(value);


        if (
            Number.isNaN(
                date.getTime()
            )
        ) {
            return "No deadline";
        }


        return date.toLocaleDateString(
            undefined,
            {
                day:
                    "numeric",
                month:
                    "short"
            }
        );

    }


    function formatActivityTime(
        value
    ) {

        if (!value) {
            return "-";
        }


        const date =
            new Date(value);


        if (
            Number.isNaN(
                date.getTime()
            )
        ) {
            return "-";
        }


        return date.toLocaleString(
            undefined,
            {
                day:
                    "numeric",
                month:
                    "short",
                hour:
                    "numeric",
                minute:
                    "2-digit"
            }
        );

    }


    function renderActivity(
        items
    ) {

        const container =
            document.getElementById(
                "commercialRecentActivity"
            );


        if (!container) {
            return;
        }


        if (
            !items ||
            !items.length
        ) {

            container.innerHTML =
                `
                <div class="integration-empty">
                    No recent activity yet.
                </div>
                `;

            return;

        }


        const iconMap = {
            resource:
                "▣",
            quiz:
                "✓",
            assignment:
                "▤",
            grade:
                "★",
            peer:
                "◉",
            submission:
                "↧",
            quiz_attempt:
                "↗",
            user:
                "◇"
        };


        container.innerHTML =
            items
                .slice(
                    0,
                    6
                )
                .map(
                    (item) => `
                        <a
                            class="commercial-activity-item"
                            href="${h.esc(item.url || "#")}"
                        >
                            <span class="commercial-activity-icon">
                                ${iconMap[item.type] || "•"}
                            </span>

                            <div>
                                <strong>
                                    ${h.esc(item.title)}
                                </strong>

                                <small>
                                    ${h.esc(item.detail || "")}
                                </small>
                            </div>

                            <time>
                                ${h.esc(formatActivityTime(item.createdAt))}
                            </time>
                        </a>
                    `
                )
                .join("");

    }


    async function activityData() {

        const response =
            await fetch(
                "/api/integration/activity",
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
                "Unable to load recent activity"
            );

        }


        return (
            result.activity ||
            []
        );

    }


    function firstName(
        fullName
    ) {

        return String(
            fullName ||
            ""
        )
            .trim()
            .split(/\s+/)[0] ||
            role;

    }


    async function studentDashboard(
        user
    ) {

        const [
            progressResponse,
            assignmentResponse,
            activity
        ] =
            await Promise.all([
                fetch(
                    "/api/progress/student",
                    {
                        credentials:
                            "same-origin"
                    }
                ),

                fetch(
                    "/api/assignments/student",
                    {
                        credentials:
                            "same-origin"
                    }
                ),

                activityData()
            ]);


        const progress =
            await progressResponse.json();

        const assignmentData =
            await assignmentResponse.json();


        if (!progressResponse.ok) {

            throw new Error(
                progress.message ||
                "Unable to load Student progress"
            );

        }


        if (!assignmentResponse.ok) {

            throw new Error(
                assignmentData.message ||
                "Unable to load Assignments"
            );

        }


        text(
            "commercialWelcomeName",
            firstName(
                user.fullName
            )
        );


        const overview =
            progress.overview ||
            {};


        text(
            "studentMasteryHero",
            percent(
                overview.overallMastery
            )
        );

        width(
            "studentMasteryBar",
            overview.overallMastery
        );

        text(
            "studentAverageQuiz",
            percent(
                overview.averageScore
            )
        );

        text(
            "studentAccuracy",
            percent(
                overview.answerAccuracy
            )
        );

        text(
            "studentCoverage",
            percent(
                overview.completionRate
            )
        );


        const profile =
            progress.profile ||
            {};


        text(
            "studentCourseName",
            profile.courseName ||
            "Your Course"
        );

        text(
            "studentCourseMeta",
            `${profile.courseCode || ""}${
                profile.courseCode &&
                profile.levelName
                    ? " • "
                    : ""
            }${profile.levelName || "Course-wide"}`
        );

        text(
            "studentDomainName",
            profile.domainName ||
            "-"
        );

        text(
            "studentDepartmentName",
            profile.departmentName ||
            "-"
        );

        text(
            "studentLevelName",
            profile.levelName ||
            "Course-wide"
        );

        text(
            "commercialStudentPath",
            `${profile.courseName || "Your Course"}${
                profile.levelName
                    ? " • " + profile.levelName
                    : ""
            } — your Resources, practice, Assignments and progress are organised here.`
        );


        const weak =
            document.getElementById(
                "studentWeakAreas"
            );


        const weakAreas =
            progress.weakAreas ||
            [];


        weak.innerHTML =
            weakAreas.length
                ? weakAreas
                    .slice(
                        0,
                        4
                    )
                    .map(
                        (area) => `
                            <a
                                href="progress.html"
                                class="commercial-focus-item"
                            >
                                <div>
                                    <span>
                                        ${h.esc(area.context || "Focus area")}
                                    </span>

                                    <strong>
                                        ${h.esc(area.title)}
                                    </strong>

                                    <small>
                                        ${h.esc(area.reason || "")}
                                    </small>
                                </div>

                                <b>
                                    ${percent(area.score)}
                                </b>
                            </a>
                        `
                    )
                    .join("")
                : `
                    <div class="commercial-positive-state">
                        <span>✓</span>
                        <div>
                            <strong>No weak area detected yet</strong>
                            <small>Complete more Quizzes to build a stronger analysis.</small>
                        </div>
                    </div>
                `;


        const assignmentBox =
            document.getElementById(
                "studentUpcomingAssignments"
            );


        const assignments =
            (assignmentData.assignments || [])
                .filter(
                    (assignment) =>
                        assignment.submission_status !==
                        "graded"
                )
                .slice(
                    0,
                    5
                );


        assignmentBox.innerHTML =
            assignments.length
                ? assignments.map(
                    (assignment) => `
                        <a
                            href="assignments.html"
                            class="commercial-list-item"
                        >
                            <span class="commercial-list-symbol">
                                ▤
                            </span>

                            <div>
                                <strong>
                                    ${h.esc(assignment.title)}
                                </strong>

                                <small>
                                    ${h.esc(assignment.subject_code)}
                                    — ${h.esc(assignment.subject_name)}
                                </small>
                            </div>

                            <div class="commercial-list-status">
                                <span class="${
                                    assignment.is_overdue
                                        ? "danger"
                                        : ""
                                }">
                                    ${
                                        assignment.is_overdue
                                            ? "Overdue"
                                            : shortDate(assignment.due_at)
                                    }
                                </span>

                                <small>
                                    ${
                                        assignment.submission_status
                                            ? h.esc(assignment.submission_status)
                                            : "Not submitted"
                                    }
                                </small>
                            </div>
                        </a>
                    `
                ).join("")
                : `
                    <div class="commercial-positive-state">
                        <span>✓</span>
                        <div>
                            <strong>You are caught up</strong>
                            <small>No ungraded Assignment currently needs attention.</small>
                        </div>
                    </div>
                `;


        renderActivity(
            activity
        );


        const recommendationContainer =
            document.getElementById(
                "studentDashboardRecommendations"
            );


        if (recommendationContainer) {

            try {

                const recommendationResponse =
                    await fetch(
                        "/api/student-experience/recommendations",
                        { credentials: "same-origin" }
                    );

                const recommendationData =
                    await recommendationResponse.json();

                if (
                    recommendationResponse.status === 409 &&
                    recommendationData.code === "STUDENT_PROFILE_REQUIRED"
                ) {
                    window.location.replace("setup-profile.html");
                    return;
                }

                if (recommendationResponse.ok) {
                    const recommendations = recommendationData.recommendations || [];
                    recommendationContainer.innerHTML = recommendations.length
                        ? recommendations.slice(0,4).map((item) => `
                            <a href="${h.esc(item.url)}" class="dashboard-recommendation-chip">
                                <span>${item.type === "assignment" ? "▤" : item.type === "quiz" ? "✓" : item.type === "skill" ? "◎" : item.type === "peer" ? "◉" : "▣"}</span>
                                <div><strong>${h.esc(item.title)}</strong><small>${h.esc(item.detail || "")}</small></div>
                            </a>
                        `).join("")
                        : '<div class="commercial-positive-state"><span>✓</span><div><strong>You are caught up</strong><small>Explore your learning space to keep progressing.</small></div></div>';
                }
            } catch (error) {
                recommendationContainer.innerHTML = '<div class="integration-empty">Recommendations will appear after more learning activity.</div>';
            }
        }

    }


    async function facultyDashboard(
        user
    ) {

        const [
            progressResponse,
            assignmentResponse,
            activity
        ] =
            await Promise.all([
                fetch(
                    "/api/progress/faculty",
                    {
                        credentials:
                            "same-origin"
                    }
                ),

                fetch(
                    "/api/assignments/faculty",
                    {
                        credentials:
                            "same-origin"
                    }
                ),

                activityData()
            ]);


        const progress =
            await progressResponse.json();

        const assignmentData =
            await assignmentResponse.json();


        if (!progressResponse.ok) {

            throw new Error(
                progress.message ||
                "Unable to load Faculty analytics"
            );

        }


        if (!assignmentResponse.ok) {

            throw new Error(
                assignmentData.message ||
                "Unable to load Faculty Assignments"
            );

        }


        text(
            "commercialWelcomeName",
            firstName(
                user.fullName
            )
        );


        const overview =
            progress.overview ||
            {};


        text(
            "facultyLearnersHero",
            `${Number(overview.activeLearners || 0)} learner${
                Number(overview.activeLearners || 0) === 1
                    ? ""
                    : "s"
            }`
        );

        text(
            "facultySubjectCount",
            Number(
                overview.assignedSubjects ||
                0
            )
        );

        text(
            "facultyAttemptCount",
            Number(
                overview.submittedAttempts ||
                0
            )
        );

        text(
            "facultyAverageScore",
            percent(
                overview.averageScore
            )
        );


        const assignments =
            assignmentData.assignments ||
            [];


        const awaiting =
            assignments.reduce(
                (
                    sum,
                    assignment
                ) =>
                    sum +
                    Number(
                        assignment.awaiting_grade_count ||
                        0
                    ),
                0
            );


        text(
            "facultyAwaitingGrade",
            awaiting
        );


        const grading =
            document.getElementById(
                "facultyGradingList"
            );


        const gradingRows =
            assignments
                .filter(
                    (assignment) =>
                        Number(
                            assignment.awaiting_grade_count ||
                            0
                        ) > 0
                )
                .slice(
                    0,
                    5
                );


        grading.innerHTML =
            gradingRows.length
                ? gradingRows.map(
                    (assignment) => `
                        <a
                            href="assignments.html"
                            class="commercial-list-item"
                        >
                            <span class="commercial-list-symbol">
                                ▤
                            </span>

                            <div>
                                <strong>
                                    ${h.esc(assignment.title)}
                                </strong>

                                <small>
                                    ${h.esc(assignment.subject_code)}
                                    — ${h.esc(assignment.subject_name)}
                                </small>
                            </div>

                            <div class="commercial-list-status">
                                <span class="warning">
                                    ${Number(assignment.awaiting_grade_count || 0)} waiting
                                </span>

                                <small>
                                    ${Number(assignment.submission_count || 0)} submissions
                                </small>
                            </div>
                        </a>
                    `
                ).join("")
                : `
                    <div class="commercial-positive-state">
                        <span>✓</span>
                        <div>
                            <strong>Grading is up to date</strong>
                            <small>No Assignment submission is waiting for marks.</small>
                        </div>
                    </div>
                `;


        const weak =
            document.getElementById(
                "facultyWeakAreas"
            );


        const weakAreas =
            progress.weakAreas ||
            [];


        weak.innerHTML =
            weakAreas.length
                ? weakAreas
                    .slice(
                        0,
                        5
                    )
                    .map(
                        (area) => `
                            <a
                                href="progress.html"
                                class="commercial-focus-item"
                            >
                                <div>
                                    <span>
                                        ${h.esc(area.subjectCode || "Subject")}
                                    </span>

                                    <strong>
                                        ${h.esc(area.subjectName)}
                                    </strong>

                                    <small>
                                        ${Number(area.activeLearners || 0)} active learners
                                    </small>
                                </div>

                                <b>
                                    ${percent(area.masteryScore)}
                                </b>
                            </a>
                        `
                    )
                    .join("")
                : `
                    <div class="commercial-positive-state">
                        <span>✓</span>
                        <div>
                            <strong>No major weak Subject detected</strong>
                            <small>Analytics will update as Students complete Quizzes.</small>
                        </div>
                    </div>
                `;


        const subjectBox =
            document.getElementById(
                "facultyAssignedSubjects"
            );


        const subjects =
            progress.subjects ||
            [];


        subjectBox.innerHTML =
            subjects.length
                ? subjects
                    .slice(
                        0,
                        6
                    )
                    .map(
                        (subject) => `
                            <a
                                href="progress.html"
                                class="commercial-subject-item"
                            >
                                <span>
                                    ${h.esc(subject.subjectCode)}
                                </span>

                                <div>
                                    <strong>
                                        ${h.esc(subject.subjectName)}
                                    </strong>

                                    <small>
                                        ${h.esc(subject.courseName || "")}
                                    </small>
                                </div>

                                <b>
                                    ${percent(subject.masteryScore)}
                                </b>
                            </a>
                        `
                    )
                    .join("")
                : `
                    <div class="integration-empty">
                        No active Subjects assigned.
                    </div>
                `;


        renderActivity(
            activity
        );

    }


    async function adminDashboard(
        user
    ) {

        const [
            reportResponse,
            healthResponse,
            activity
        ] =
            await Promise.all([
                fetch(
                    "/api/integration/admin/reports",
                    {
                        credentials:
                            "same-origin"
                    }
                ),

                fetch(
                    "/api/integration/admin/system-check",
                    {
                        credentials:
                            "same-origin"
                    }
                ),

                activityData()
            ]);


        const report =
            await reportResponse.json();

        const health =
            await healthResponse.json();


        if (!reportResponse.ok) {

            throw new Error(
                report.message ||
                "Unable to load Admin reports"
            );

        }


        if (!healthResponse.ok) {

            throw new Error(
                health.message ||
                "Unable to check database"
            );

        }


        text(
            "commercialWelcomeName",
            firstName(
                user.fullName
            )
        );


        const overview =
            report.overview ||
            {};


        text(
            "adminStudentCount",
            Number(
                overview.students ||
                0
            )
        );

        text(
            "adminFacultyCount",
            Number(
                overview.faculty ||
                0
            )
        );

        text(
            "adminActiveUsers",
            Number(
                overview.activeUsers ||
                0
            )
        );

        text(
            "adminTableCount",
            `${Number(health.existingRequiredTables || 0)}/${Number(health.expectedTables || 28)}`
        );

        text(
            "adminSystemHealth",
            health.healthy
                ? "Database Ready"
                : "Needs Attention"
        );

        width(
            "adminHealthBar",
            health.expectedTables
                ? (
                    Number(
                        health.existingRequiredTables ||
                        0
                    ) /
                    Number(
                        health.expectedTables
                    )
                ) *
                100
                : 0
        );


        text(
            "adminResourcesCount",
            Number(
                overview.resources ||
                0
            )
        );

        text(
            "adminQuestionsCount",
            Number(
                overview.questions ||
                0
            )
        );

        text(
            "adminQuizzesCount",
            Number(
                overview.quizzes ||
                0
            )
        );

        text(
            "adminAssignmentsCount",
            Number(
                overview.assignments ||
                0
            )
        );

        text(
            "adminSkillsCount",
            Number(
                overview.skills ||
                0
            )
        );

        text(
            "adminPeerCount",
            Number(
                overview.peerGroups ||
                0
            )
        );

        text(
            "adminQuizAttempts",
            Number(
                overview.quizAttempts ||
                0
            )
        );

        text(
            "adminPendingGrading",
            Number(
                overview.pendingGrading ||
                0
            )
        );


        renderActivity(
            activity
        );

    }


    search?.addEventListener(
        "keydown",
        (event) => {

            if (
                event.key ===
                "Enter" &&
                search.value.trim()
            ) {

                window.location.href =
                    `search.html?q=${encodeURIComponent(search.value.trim())}`;

            }

        }
    );


    try {

        const user =
            await h.requireRole(
                role
            );


        if (!user) {
            return;
        }


        if (
            role ===
            "student"
        ) {

            await studentDashboard(
                user
            );

        } else if (
            role ===
            "faculty"
        ) {

            await facultyDashboard(
                user
            );

        } else {

            await adminDashboard(
                user
            );

        }


        loading.hidden =
            true;

        content.hidden =
            false;


    } catch (error) {

        if (
            role === "student" &&
            String(error.message || "").toLowerCase().includes("course profile is not configured")
        ) {
            window.location.replace("setup-profile.html");
            return;
        }

        loading.innerHTML =
            `
            <strong>
                ${h.esc(error.message)}
            </strong>

            <span>
                Refresh the page or verify the backend is running.
            </span>
            `;


        h.toast(
            error.message,
            "error"
        );

    }

});
