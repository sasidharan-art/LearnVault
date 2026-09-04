document.addEventListener("DOMContentLoaded", async () => {
    const h = window.LearnVaultLearning;
    if (!h) return;

    h.bindLogout();

    let state = {
        students: [],
        requests: [],
        history: [],
        courses: []
    };

    const search = document.getElementById("universalHeaderSearch");

    function courseText(course) {
        return `${course.courseName}${
            course.departmentName ? " — " + course.departmentName : ""
        }`;
    }

    function fillCourseSelect(select) {
        select.innerHTML =
            `<option value="">Select Course</option>` +
            state.courses.map((course) => `
                <option value="${course.id}">
                    ${h.esc(courseText(course))}
                </option>
            `).join("");
    }

    function fillLevelSelect(courseSelect, levelSelect) {
        const selected = state.courses.find(
            (course) => Number(course.id) === Number(courseSelect.value)
        );

        if (!selected) {
            levelSelect.innerHTML = `<option value="">Select Course first</option>`;
            levelSelect.required = false;
            return;
        }

        const levels = selected.levels || [];

        if (!levels.length) {
            levelSelect.innerHTML = `<option value="">Course-wide</option>`;
            levelSelect.required = false;
            return;
        }

        levelSelect.innerHTML =
            `<option value="">Select Level / Year</option>` +
            levels.map((item) => `
                <option value="${item.id}">
                    ${h.esc(item.levelName)}
                </option>
            `).join("");

        levelSelect.required = true;
    }

    function render() {
        const students = state.students || [];
        const requests = state.requests || [];
        const history = state.history || [];

        document.getElementById("advancementStudentCount").textContent =
            students.length;

        document.getElementById("advancementConfiguredCount").textContent =
            students.filter((student) => student.course_id).length;

        const pending = requests.filter((request) => request.status === "pending");

        document.getElementById("advancementPendingCount").textContent =
            pending.length;

        document.getElementById("adminPendingProgressionCount").textContent =
            pending.length;

        document.getElementById("advancementHistoryCount").textContent =
            history.length;

        const requestList =
            document.getElementById("adminProgressionRequests");

        requestList.innerHTML = requests.length
            ? requests.map((item) => `
                <article class="admin-progression-request ${h.esc(item.status)}">
                    <div class="admin-progression-request-main">
                        <div class="admin-progression-request-meta">
                            <span>${h.esc(item.status)}</span>
                            <small>${new Date(item.created_at).toLocaleDateString()}</small>
                        </div>

                        <strong>${h.esc(item.student_name)}</strong>

                        <p>
                            ${
                                item.from_course_name
                                    ? `${h.esc(item.from_course_name)}${
                                        item.from_level_name
                                            ? " • " + h.esc(item.from_level_name)
                                            : ""
                                    }`
                                    : "No current academic profile"
                            }
                            →
                            ${h.esc(item.requested_course_name)}
                            ${
                                item.requested_level_name
                                    ? " • " + h.esc(item.requested_level_name)
                                    : ""
                            }
                        </p>

                        <small>${h.esc(item.reason || "No reason supplied")}</small>

                        ${
                            item.review_note
                                ? `<em>Review: ${h.esc(item.review_note)}</em>`
                                : ""
                        }
                    </div>

                    ${
                        item.status === "pending"
                            ? `
                                <div class="admin-progression-actions">
                                    <button
                                        type="button"
                                        class="button button-primary progression-review-button"
                                        data-request-id="${item.id}"
                                        data-status="approved"
                                    >Approve</button>

                                    <button
                                        type="button"
                                        class="button button-soft progression-review-button"
                                        data-request-id="${item.id}"
                                        data-status="rejected"
                                    >Reject</button>
                                </div>
                            `
                            : ""
                    }
                </article>
            `).join("")
            : `
                <div class="commercial-positive-state large">
                    <span>✓</span>
                    <div>
                        <strong>No academic requests</strong>
                        <small>Student progression requests will appear here.</small>
                    </div>
                </div>
            `;

        requestList.querySelectorAll(".progression-review-button")
            .forEach((button) => {
                button.addEventListener("click", async () => {
                    const approve = button.dataset.status === "approved";

                    const note =
                        window.prompt(
                            approve
                                ? "Optional Admin note for approval:"
                                : "Reason for rejection:"
                        ) || "";

                    try {
                        await h.sendJson(
                            `/api/academic-progress/admin/requests/${button.dataset.requestId}`,
                            "PATCH",
                            {
                                status: button.dataset.status,
                                reviewNote: note
                            }
                        );

                        h.toast(
                            approve ? "Progression approved." : "Request rejected."
                        );

                        await load();
                    } catch (error) {
                        h.toast(error.message, "error");
                    }
                });
            });

        const historyList =
            document.getElementById("adminAcademicHistory");

        historyList.innerHTML = history.length
            ? history.map((item) => `
                <article class="academic-history-item">
                    <span class="academic-history-icon">
                        ${item.change_type === "promotion" ? "↟" : "✓"}
                    </span>

                    <div>
                        <small>${h.esc(item.change_type.replaceAll("_", " "))}</small>
                        <strong>${h.esc(item.student_name)}</strong>

                        <p>
                            ${
                                item.from_course_name
                                    ? `${h.esc(item.from_course_name)}${
                                        item.from_level_name
                                            ? " • " + h.esc(item.from_level_name)
                                            : ""
                                    } → `
                                    : ""
                            }
                            ${h.esc(item.to_course_name)}
                            ${
                                item.to_level_name
                                    ? " • " + h.esc(item.to_level_name)
                                    : ""
                            }
                        </p>

                        ${item.note ? `<em>${h.esc(item.note)}</em>` : ""}
                    </div>

                    <time>${new Date(item.created_at).toLocaleDateString()}</time>
                </article>
            `).join("")
            : `<div class="integration-empty">No academic changes recorded yet.</div>`;

        const studentSelect =
            document.getElementById("adminPromotionStudent");

        studentSelect.innerHTML =
            `<option value="">Select Student</option>` +
            students.map((student) => `
                <option value="${student.id}">
                    ${h.esc(student.full_name)}
                    ${
                        student.course_name
                            ? ` — ${h.esc(student.course_name)}${
                                student.level_name
                                    ? " / " + h.esc(student.level_name)
                                    : ""
                            }`
                            : " — Not configured"
                    }
                </option>
            `).join("");
    }

    async function loadCourses() {
        const response = await fetch("/api/academic/registration-options");
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "Unable to load Courses");
        }

        state.courses = data.courses || [];

        [
            "adminPromotionCourse",
            "bulkFromCourse",
            "bulkToCourse"
        ].forEach((id) => {
            fillCourseSelect(document.getElementById(id));
        });
    }

    async function load() {
        const response = await fetch(
            "/api/academic-progress/admin",
            { credentials: "same-origin" }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "Unable to load Student Advancement");
        }

        state.students = data.students || [];
        state.requests = data.requests || [];
        state.history = data.history || [];

        render();
    }

    const promotionCourse = document.getElementById("adminPromotionCourse");
    const promotionLevel = document.getElementById("adminPromotionLevel");
    const bulkFromCourse = document.getElementById("bulkFromCourse");
    const bulkFromLevel = document.getElementById("bulkFromLevel");
    const bulkToCourse = document.getElementById("bulkToCourse");
    const bulkToLevel = document.getElementById("bulkToLevel");

    promotionCourse.addEventListener("change", () =>
        fillLevelSelect(promotionCourse, promotionLevel)
    );

    bulkFromCourse.addEventListener("change", () =>
        fillLevelSelect(bulkFromCourse, bulkFromLevel)
    );

    bulkToCourse.addEventListener("change", () =>
        fillLevelSelect(bulkToCourse, bulkToLevel)
    );

    document.getElementById("adminIndividualPromotionForm")
        .addEventListener("submit", async (event) => {
            event.preventDefault();

            if (
                !window.confirm(
                    "Update this Student's academic Course / Level?"
                )
            ) {
                return;
            }

            try {
                await h.sendJson(
                    "/api/academic-progress/admin/change",
                    "POST",
                    {
                        studentUserId:
                            Number(
                                document.getElementById("adminPromotionStudent").value
                            ),
                        courseId: Number(promotionCourse.value),
                        courseLevelId:
                            promotionLevel.value
                                ? Number(promotionLevel.value)
                                : null,
                        note:
                            document.getElementById("adminPromotionNote")
                                .value.trim()
                    }
                );

                h.toast("Student academic profile updated.");
                await load();
            } catch (error) {
                h.toast(error.message, "error");
            }
        });

    document.getElementById("adminBulkPromotionForm")
        .addEventListener("submit", async (event) => {
            event.preventDefault();

            if (
                !window.confirm(
                    "Promote ALL active Students matching the selected source Course / Level?"
                )
            ) {
                return;
            }

            try {
                const result = await h.sendJson(
                    "/api/academic-progress/admin/bulk-promote",
                    "POST",
                    {
                        fromCourseId: Number(bulkFromCourse.value),
                        fromLevelId:
                            bulkFromLevel.value
                                ? Number(bulkFromLevel.value)
                                : null,
                        toCourseId: Number(bulkToCourse.value),
                        toLevelId:
                            bulkToLevel.value
                                ? Number(bulkToLevel.value)
                                : null,
                        note:
                            document.getElementById("bulkPromotionNote")
                                .value.trim()
                    }
                );

                h.toast(result.message);
                await load();
            } catch (error) {
                h.toast(error.message, "error");
            }
        });

    search.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && search.value.trim()) {
            window.location.href =
                `search.html?q=${encodeURIComponent(search.value.trim())}`;
        }
    });

    try {
        const user = await h.requireRole("admin");
        if (!user) return;

        await loadCourses();
        await load();
    } catch (error) {
        h.toast(error.message, "error");
    }
});
