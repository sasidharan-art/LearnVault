document.addEventListener("DOMContentLoaded", async () => {

    const admin =
        window.LearnVaultAdmin;

    if (!admin) return;


    const user =
        await admin.requireAdmin();

    if (!user) return;


    const form =
        document.getElementById(
            "studentAcademicForm"
        );

    if (!form) return;


    const studentSelect =
        document.getElementById(
            "studentAcademicStudentSelect"
        );

    const courseSelect =
        document.getElementById(
            "studentAcademicCourseSelect"
        );

    const levelSelect =
        document.getElementById(
            "studentAcademicLevelSelect"
        );

    const currentBox =
        document.getElementById(
            "studentAcademicCurrent"
        );


    let students = [];
    let courses = [];
    let levels = [];


    function esc(value) {

        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");

    }


    function selectedStudent() {

        return students.find(
            (student) =>
                String(student.id) ===
                String(studentSelect.value)
        );

    }


    function courseLevels() {

        return levels.filter(
            (level) =>
                String(level.course_id) ===
                String(courseSelect.value)
        );

    }


    function renderCurrent() {

        const student =
            selectedStudent();


        if (!student) {

            currentBox.innerHTML =
                `<span>Select a student to view the current academic profile.</span>`;

            return;

        }


        const configured =
            Boolean(student.course_id);


        currentBox.innerHTML =
            `
            <div>
                <span>Student</span>
                <strong>${esc(student.full_name)}</strong>
                <small>#${esc(student.id)} • ${esc(student.email)}</small>
            </div>

            <div>
                <span>Current Course</span>
                <strong>
                    ${configured ? esc(student.course_name) : "Not configured"}
                </strong>
            </div>

            <div>
                <span>Current Level / Year</span>
                <strong>
                    ${configured ? esc(student.level_name || "Course-wide") : "Not configured"}
                </strong>
            </div>

            <span class="student-profile-state ${configured ? "configured" : "missing"}">
                ${configured ? "Configured" : "Needs Academic Assignment"}
            </span>
            `;

    }


    function renderLevels(
        preferredLevelId = null
    ) {

        const list =
            courseLevels();


        if (!courseSelect.value) {

            levelSelect.innerHTML =
                `<option value="">Select a course first</option>`;

            levelSelect.disabled =
                true;

            levelSelect.required =
                false;

            return;

        }


        if (list.length === 0) {

            levelSelect.innerHTML =
                `<option value="">No level selection required</option>`;

            levelSelect.disabled =
                true;

            levelSelect.required =
                false;

            return;

        }


        levelSelect.innerHTML =
            `
            <option value="">Select Current Level / Year</option>
            ${
                list.map(
                    (level) => `
                        <option value="${esc(level.id)}">
                            ${esc(level.level_name)}
                        </option>
                    `
                ).join("")
            }
            `;


        levelSelect.disabled =
            false;

        levelSelect.required =
            true;


        if (preferredLevelId) {

            levelSelect.value =
                String(preferredLevelId);

        }

    }


    function loadStudentIntoForm() {

        const student =
            selectedStudent();


        if (!student) {

            courseSelect.value = "";

            renderLevels();

            renderCurrent();

            return;

        }


        courseSelect.value =
            student.course_id
                ? String(student.course_id)
                : "";


        renderLevels(
            student.course_level_id
        );


        renderCurrent();

    }


    async function loadOptions() {

        const response =
            await fetch(
                "/api/admin/student-academic/options",
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
                "Unable to load student academic options"
            );

        }


        students =
            Array.isArray(result.students)
                ? result.students
                : [];


        courses =
            Array.isArray(result.courses)
                ? result.courses
                : [];


        levels =
            Array.isArray(result.levels)
                ? result.levels
                : [];


        studentSelect.innerHTML =
            `
            <option value="">Select Student</option>

            ${
                students.map(
                    (student) => `
                        <option value="${esc(student.id)}">
                            ${esc(student.full_name)}
                            — #${esc(student.id)}
                            ${student.course_id ? "" : " — Needs Course"}
                        </option>
                    `
                ).join("")
            }
            `;


        courseSelect.innerHTML =
            `
            <option value="">Select Course / Program</option>

            ${
                courses.map(
                    (course) => {

                        const context =
                            course.department_name ||
                            course.domain_name ||
                            "General";


                        return `
                            <option value="${esc(course.id)}">
                                ${esc(course.course_name)}
                                — ${esc(context)}
                            </option>
                        `;

                    }
                ).join("")
            }
            `;


        renderLevels();

        renderCurrent();

    }


    studentSelect.addEventListener(
        "change",
        loadStudentIntoForm
    );


    courseSelect.addEventListener(
        "change",
        () => renderLevels()
    );


    form.addEventListener(
        "submit",
        async (event) => {

            event.preventDefault();


            const studentId =
                Number(studentSelect.value);

            const courseId =
                Number(courseSelect.value);

            const courseLevelId =
                levelSelect.disabled
                    ? null
                    : (
                        levelSelect.value
                            ? Number(levelSelect.value)
                            : null
                    );


            if (!studentId || !courseId) {

                admin.showToast(
                    "Select a Student and Course / Program.",
                    "error"
                );

                return;

            }


            if (
                levelSelect.required &&
                !courseLevelId
            ) {

                admin.showToast(
                    "Select the student's Current Level / Year.",
                    "error"
                );

                return;

            }


            const button =
                form.querySelector(
                    'button[type="submit"]'
                );

            const oldText =
                button.textContent;


            try {

                button.disabled =
                    true;

                button.textContent =
                    "Saving...";


                const response =
                    await fetch(
                        `/api/admin/students/${encodeURIComponent(studentId)}/academic-profile`,
                        {
                            method:
                                "PATCH",

                            headers: {
                                "Content-Type":
                                    "application/json"
                            },

                            credentials:
                                "same-origin",

                            body:
                                JSON.stringify({
                                    courseId,
                                    courseLevelId
                                })
                        }
                    );


                const result =
                    await response.json();


                if (!response.ok) {

                    throw new Error(
                        result.message ||
                        "Unable to update student academic profile"
                    );

                }


                admin.showToast(
                    "Student academic profile saved."
                );


                await loadOptions();


                studentSelect.value =
                    String(studentId);


                loadStudentIntoForm();


            } catch (error) {

                admin.showToast(
                    error.message,
                    "error"
                );


            } finally {

                button.disabled =
                    false;

                button.textContent =
                    oldText;

            }

        }
    );


    try {

        await loadOptions();

    } catch (error) {

        console.error(
            "Student academic options error:",
            error
        );


        admin.showToast(
            error.message,
            "error"
        );

    }

});
