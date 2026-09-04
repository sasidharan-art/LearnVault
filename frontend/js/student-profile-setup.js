document.addEventListener("DOMContentLoaded", async () => {
    const h = window.LearnVaultLearning;
    if (!h) return;

    const form = document.getElementById("studentAcademicSetupForm");
    const course = document.getElementById("studentSetupCourse");
    const level = document.getElementById("studentSetupLevel");
    const selectedPath = document.getElementById("studentSelectedPath");
    const logout = document.getElementById("logoutButton");
    let courses = [];

    logout.addEventListener("click", async () => {
        try {
            await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
        } finally {
            location.replace("../login.html");
        }
    });

    function renderLevels() {
        const selected = courses.find((item) => Number(item.id) === Number(course.value));
        if (!selected) {
            level.innerHTML = '<option value="">Select Course first</option>';
            level.required = false;
            selectedPath.hidden = true;
            return;
        }

        const levels = selected.levels || [];
        if (!levels.length) {
            level.innerHTML = '<option value="">Course-wide</option>';
            level.required = false;
        } else {
            level.innerHTML = '<option value="">Select Current Level / Year</option>' + levels.map((item) => `<option value="${item.id}">${h.esc(item.levelName)}</option>`).join("");
            level.required = true;
        }

        selectedPath.hidden = false;
        selectedPath.innerHTML = `
            <span>Selected Program</span>
            <strong>${h.esc(selected.courseName)}</strong>
            <small>${h.esc(selected.domainName || "Education")}${selected.departmentName ? " • " + h.esc(selected.departmentName) : ""}</small>
        `;
    }

    async function load() {
        const meResponse = await fetch("/api/auth/me", { credentials: "same-origin" });
        const me = await meResponse.json();
        if (meResponse.status === 401) {
            location.replace("../login.html");
            return;
        }
        if (!meResponse.ok || !me.user || String(me.user.role || "").toLowerCase() !== "student") {
            throw new Error("Student access only");
        }

        const optionResponse = await fetch("/api/academic/registration-options");
        const options = await optionResponse.json();
        if (!optionResponse.ok) throw new Error(options.message || "Unable to load Courses");

        courses = options.courses || [];
        course.innerHTML = '<option value="">Select Course / Program</option>' + courses.map((item) => `
            <option value="${item.id}">${h.esc(item.courseName)}${item.courseCode ? " — " + h.esc(item.courseCode) : ""}</option>
        `).join("");

        if (me.user.courseId) {
            window.location.replace("academic-progress.html");
            return;
        }
    }

    course.addEventListener("change", renderLevels);

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const button = form.querySelector('button[type="submit"]');
        const old = button.textContent;
        try {
            button.disabled = true;
            button.textContent = "Saving Learning Path...";
            const result = await h.sendJson("/api/student-experience/profile", "PATCH", {
                courseId: Number(course.value),
                courseLevelId: level.value ? Number(level.value) : null
            });
            h.toast(result.message || "Learning path saved.");
            setTimeout(() => location.replace("dashboard.html"), 450);
        } catch (error) {
            h.toast(error.message, "error");
        } finally {
            button.disabled = false;
            button.textContent = old;
        }
    });

    try {
        await load();
    } catch (error) {
        h.toast(error.message, "error");
    }
});
