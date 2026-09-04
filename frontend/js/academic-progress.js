document.addEventListener("DOMContentLoaded", async () => {
    const h = window.LearnVaultLearning;
    if (!h) return;

    h.bindLogout();

    const course = document.getElementById("academicRequestCourse");
    const level = document.getElementById("academicRequestLevel");
    const form = document.getElementById("academicChangeRequestForm");
    const history = document.getElementById("academicHistoryList");
    const requests = document.getElementById("academicRequestList");
    const search = document.getElementById("universalHeaderSearch");

    let courses = [];

    function fillLevels() {
        const selected = courses.find(
            (item) => Number(item.id) === Number(course.value)
        );

        if (!selected) {
            level.innerHTML = `<option value="">Select Course first</option>`;
            level.required = false;
            return;
        }

        const levels = selected.levels || [];

        if (!levels.length) {
            level.innerHTML = `<option value="">Course-wide</option>`;
            level.required = false;
            return;
        }

        level.innerHTML =
            `<option value="">Select Level / Year</option>` +
            levels.map((item) => `
                <option value="${item.id}">
                    ${h.esc(item.levelName)}
                </option>
            `).join("");

        level.required = true;
    }

    function renderProgress(data) {
        const profile = data.profile || {};

        document.getElementById("academicCurrentLevel").textContent =
            profile.level_name || "Course-wide";

        document.getElementById("academicCurrentCourse").textContent =
            `${profile.course_name || "Course"}${
                profile.department_name ? " • " + profile.department_name : ""
            }`;

        document.getElementById("academicNextSuggestion").textContent =
            data.nextLevel
                ? `Suggested next Level in your current Course: ${data.nextLevel.level_name}. You may also request a different Course / Stream when the academic structure changes.`
                : "No later Level is configured in the current Course. If you are moving to another Course / Stream, select it below.";

        const rows = data.history || [];

        history.innerHTML = rows.length
            ? rows.map((item) => `
                <article class="academic-history-item">
                    <span class="academic-history-icon">
                        ${item.change_type === "promotion" ? "↟" : "✓"}
                    </span>

                    <div>
                        <small>${h.esc(item.change_type.replaceAll("_", " "))}</small>

                        <strong>
                            ${h.esc(item.to_course_name)}
                            ${item.to_level_name ? " • " + h.esc(item.to_level_name) : ""}
                        </strong>

                        <p>
                            ${
                                item.from_course_name
                                    ? `From ${h.esc(item.from_course_name)}${
                                        item.from_level_name
                                            ? " • " + h.esc(item.from_level_name)
                                            : ""
                                    }`
                                    : "Initial academic profile"
                            }
                        </p>

                        ${item.note ? `<em>${h.esc(item.note)}</em>` : ""}
                    </div>

                    <time>${new Date(item.created_at).toLocaleDateString()}</time>
                </article>
            `).join("")
            : `<div class="integration-empty">Academic history will appear here.</div>`;

        const requestRows = data.requests || [];

        requests.innerHTML = requestRows.length
            ? requestRows.map((item) => `
                <article class="academic-request-item ${h.esc(item.status)}">
                    <div>
                        <small>${h.esc(item.status)}</small>

                        <strong>
                            ${h.esc(item.course_name)}
                            ${item.level_name ? " • " + h.esc(item.level_name) : ""}
                        </strong>

                        <p>${h.esc(item.reason || "Academic progression request")}</p>

                        ${
                            item.review_note
                                ? `<em>Admin: ${h.esc(item.review_note)}</em>`
                                : ""
                        }
                    </div>

                    ${
                        item.status === "pending"
                            ? `<button
                                type="button"
                                class="button button-soft academic-cancel-request"
                                data-request-id="${item.id}"
                              >Cancel</button>`
                            : ""
                    }
                </article>
            `).join("")
            : `<div class="integration-empty">No academic-change requests yet.</div>`;

        requests.querySelectorAll(".academic-cancel-request")
            .forEach((button) => {
                button.addEventListener("click", async () => {
                    try {
                        await h.sendJson(
                            `/api/academic-progress/student/requests/${button.dataset.requestId}/cancel`,
                            "PATCH",
                            {}
                        );

                        h.toast("Request cancelled.");
                        await loadProgress();
                    } catch (error) {
                        h.toast(error.message, "error");
                    }
                });
            });
    }

    async function loadCourses() {
        const response = await fetch("/api/academic/registration-options");
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "Unable to load academic options");
        }

        courses = data.courses || [];

        course.innerHTML =
            `<option value="">Select Course / Program</option>` +
            courses.map((item) => `
                <option value="${item.id}">
                    ${h.esc(item.courseName)}
                    ${item.departmentName ? " — " + h.esc(item.departmentName) : ""}
                </option>
            `).join("");
    }

    async function loadProgress() {
        const response = await fetch(
            "/api/academic-progress/student",
            { credentials: "same-origin" }
        );

        const data = await response.json();

        if (
            response.status === 409 &&
            data.code === "STUDENT_PROFILE_REQUIRED"
        ) {
            window.location.replace("setup-profile.html");
            return;
        }

        if (!response.ok) {
            throw new Error(data.message || "Unable to load academic progression");
        }

        renderProgress(data);

        course.value = String(data.profile.course_id);
        fillLevels();

        if (data.nextLevel) {
            level.value = String(data.nextLevel.id);
        }
    }

    course.addEventListener("change", fillLevels);

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const button = form.querySelector('button[type="submit"]');
        const old = button.textContent;

        try {
            button.disabled = true;
            button.textContent = "Sending Request...";

            await h.sendJson(
                "/api/academic-progress/student/requests",
                "POST",
                {
                    courseId: Number(course.value),
                    courseLevelId:
                        level.value ? Number(level.value) : null,
                    reason:
                        document.getElementById("academicRequestReason")
                            .value.trim()
                }
            );

            document.getElementById("academicRequestReason").value = "";

            h.toast("Academic progression request sent to Admin.");
            await loadProgress();
        } catch (error) {
            h.toast(error.message, "error");
        } finally {
            button.disabled = false;
            button.textContent = old;
        }
    });

    search.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && search.value.trim()) {
            window.location.href =
                `search.html?q=${encodeURIComponent(search.value.trim())}`;
        }
    });

    try {
        const user = await h.requireRole("student");
        if (!user) return;

        await loadCourses();
        await loadProgress();
    } catch (error) {
        h.toast(error.message, "error");
    }
});
