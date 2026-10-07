document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("academicRegisterForm");
    if (!form) return;

    const domainSelect = document.getElementById("domainSelect");
    const departmentSelect = document.getElementById("departmentSelect");
    const courseSelect = document.getElementById("courseSelect");
    const apiState = document.getElementById("registrationApiState");
    const courseContextCard = document.getElementById("courseContextCard");
    const selectedCourseName = document.getElementById("selectedCourseName");
    const selectedDomain = document.getElementById("selectedDomain");
    const selectedDepartment = document.getElementById("selectedDepartment");
    const submitButton = document.getElementById("createAccountButton");
    const toast = document.getElementById("toast");

    let catalog = { domains: [], departments: [], courses: [] };

    function showToast(message) {
        if (!toast) return console.log(message);
        toast.textContent = message;
        toast.classList.add("show");
        clearTimeout(toast.hideTimer);
        toast.hideTimer = setTimeout(() => toast.classList.remove("show"), 3000);
    }

    function setApiState(message, isError = false) {
        if (!apiState) return;
        apiState.textContent = message || "";
        apiState.classList.toggle("error", Boolean(isError));
    }

    function resetSelect(select, message) {
        select.innerHTML = `<option value="">${message}</option>`;
        select.disabled = true;
    }

    function esc(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function renderCourseContext(course) {
        if (!course) {
            courseContextCard?.classList.remove("show");
            return;
        }
        selectedCourseName.textContent = course.courseName || "-";
        selectedDomain.textContent = `Domain: ${course.domainName || "General"}`;
        selectedDepartment.textContent = `Department / Stream: ${course.departmentName || "Not applicable"}`;
        courseContextCard?.classList.add("show");
    }

    function renderDomains() {
        domainSelect.innerHTML = `<option value="">Select Education Domain</option>`;
        catalog.domains.filter(d => Number(d.is_active) === 1).forEach(d => {
            const option = document.createElement("option");
            option.value = String(d.id);
            option.textContent = d.domain_name;
            domainSelect.appendChild(option);
        });
        domainSelect.disabled = false;
    }

    function renderDepartments() {
        const domainId = Number(domainSelect.value || 0);
        resetSelect(departmentSelect, domainId ? "Select Department / Stream" : "Select a domain first");
        resetSelect(courseSelect, "Select a department first");
        renderCourseContext(null);
        if (!domainId) return;

        const departments = catalog.departments.filter(d =>
            Number(d.domain_id) === domainId && Number(d.is_active) === 1
        );

        if (!departments.length) {
            const option = document.createElement("option");
            option.value = "0";
            option.textContent = "Not applicable for this domain";
            departmentSelect.appendChild(option);
            departmentSelect.disabled = false;
            renderCourses();
            return;
        }

        departments.forEach(d => {
            const option = document.createElement("option");
            option.value = String(d.id);
            option.textContent = d.department_name;
            departmentSelect.appendChild(option);
        });
        departmentSelect.disabled = false;
    }

    function renderCourses() {
        const domainId = Number(domainSelect.value || 0);
        const departmentId = departmentSelect.value ? Number(departmentSelect.value) : null;
        resetSelect(courseSelect, domainId ? "Select Course / Program" : "Select a domain first");
        renderCourseContext(null);
        if (!domainId) return;

        const courses = catalog.courses.filter(c =>
            Number(c.domain_id || 0) === domainId &&
            Number(c.is_active) === 1 &&
            (departmentId === null || Number(c.department_id || 0) === departmentId)
        );

        courses.forEach(course => {
            const option = document.createElement("option");
            option.value = String(course.id);
            option.textContent = course.course_code
                ? `${course.course_name} (${course.course_code})`
                : course.course_name;
            courseSelect.appendChild(option);
        });

        courseSelect.disabled = courses.length === 0;
        if (!courses.length) {
            courseSelect.innerHTML = `<option value="">No active courses available for this selection</option>`;
        }
    }

    async function loadRegistrationOptions() {
        try {
            setApiState("Loading academic catalog...");
            const response = await fetch("/api/academic/registration-options", { credentials: "same-origin" });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || "Unable to load academic catalog.");

            catalog = {
                domains: Array.isArray(result.domains) ? result.domains : [],
                departments: Array.isArray(result.departments) ? result.departments : [],
                courses: Array.isArray(result.courses) ? result.courses : []
            };

            if (!catalog.domains.length || !catalog.courses.length) {
                throw new Error("The academic catalog is not configured yet. Please contact the administrator.");
            }

            renderDomains();
            resetSelect(departmentSelect, "Select a domain first");
            resetSelect(courseSelect, "Select a department first");
            setApiState(`${catalog.domains.length} education domains and ${catalog.courses.length} courses available.`);
        } catch (error) {
            console.error("Registration options error:", error);
            resetSelect(domainSelect, "Unable to load education domains");
            resetSelect(departmentSelect, "Academic catalog unavailable");
            resetSelect(courseSelect, "Academic catalog unavailable");
            setApiState(error.message, true);
        }
    }

    domainSelect.addEventListener("change", renderDepartments);
    departmentSelect.addEventListener("change", renderCourses);
    courseSelect.addEventListener("change", () => {
        const course = catalog.courses.find(c => String(c.id) === String(courseSelect.value));
        renderCourseContext(course);
    });

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const formData = new FormData(form);
        const payload = {
            fullName: String(formData.get("fullName") || "").trim(),
            phone: String(formData.get("phone") || "").trim(),
            email: String(formData.get("email") || "").trim(),
            domainId: String(formData.get("domainId") || "").trim(),
            departmentId: String(formData.get("departmentId") || "").trim(),
            courseId: String(formData.get("courseId") || "").trim(),
            password: String(formData.get("password") || ""),
            confirmPassword: String(formData.get("confirmPassword") || "")
        };

        if (!payload.domainId) return showToast("Please select your Education Domain.");
        if (!payload.courseId) return showToast("Please select your Course / Program.");
        if (payload.password !== payload.confirmPassword) return showToast("Passwords do not match.");
        if (payload.password.length < 8) return showToast("Password must contain at least 8 characters.");

        try {
            submitButton.disabled = true;
            submitButton.textContent = "Creating Account...";
            const response = await fetch("/api/auth/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "same-origin",
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || "Unable to create account.");

            const user = result.user || {};
            document.getElementById("createdFullName").textContent = user.fullName || "-";
            document.getElementById("createdUsername").textContent = user.username || "-";
            document.getElementById("createdUserId").textContent = user.id || "-";
            document.getElementById("createdEmail").textContent = user.email || "-";
            document.getElementById("accountSuccessOverlay")?.setAttribute("aria-hidden", "false");
            document.getElementById("accountSuccessOverlay")?.classList.add("show");
        } catch (error) {
            showToast(error.message);
            submitButton.disabled = false;
            submitButton.textContent = "Create Account";
        }
    });

    document.querySelectorAll(".password-toggle").forEach(button => {
        button.addEventListener("click", () => {
            const target = document.getElementById(button.dataset.target);
            if (!target) return;
            const showing = target.type === "text";
            target.type = showing ? "password" : "text";
            button.textContent = showing ? "Show" : "Hide";
        });
    });

    loadRegistrationOptions();
});
