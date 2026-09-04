document.addEventListener("DOMContentLoaded", () => {

    const form =
        document.getElementById("academicRegisterForm");

    if (!form) return;


    const courseSelect =
        document.getElementById("courseSelect");

    const courseLevelSelect =
        document.getElementById("courseLevelSelect");

    const apiState =
        document.getElementById("registrationApiState");

    const courseContextCard =
        document.getElementById("courseContextCard");

    const selectedCourseName =
        document.getElementById("selectedCourseName");

    const selectedDomain =
        document.getElementById("selectedDomain");

    const selectedDepartment =
        document.getElementById("selectedDepartment");

    const submitButton =
        document.getElementById("createAccountButton");

    const successOverlay =
        document.getElementById("accountSuccessOverlay");

    const toast =
        document.getElementById("toast");


    let availableCourses = [];


    function showToast(message) {

        if (!toast) {
            console.log(message);
            return;
        }

        toast.textContent = message;
        toast.classList.add("show");

        clearTimeout(toast.hideTimer);

        toast.hideTimer =
            setTimeout(
                () => toast.classList.remove("show"),
                3000
            );

    }


    function setApiState(message, isError = false) {

        if (!apiState) return;

        apiState.textContent = message || "";

        apiState.classList.toggle(
            "error",
            Boolean(isError)
        );

    }


    function resetLevelSelect(message = "Select a course first") {

        courseLevelSelect.innerHTML =
            `<option value="">${message}</option>`;

        courseLevelSelect.disabled = true;
        courseLevelSelect.required = false;

    }


    function renderCourseContext(course) {

        if (!course) {

            courseContextCard.classList.remove("show");
            return;

        }

        selectedCourseName.textContent =
            course.courseName || "-";

        selectedDomain.textContent =
            `Domain: ${course.domainName || "General"}`;

        selectedDepartment.textContent =
            `Department / Stream: ${course.departmentName || "Not applicable"}`;

        courseContextCard.classList.add("show");

    }


    function renderLevels(course) {

        resetLevelSelect();

        if (
            !course ||
            !Array.isArray(course.levels) ||
            course.levels.length === 0
        ) {

            courseLevelSelect.innerHTML =
                `<option value="">No level selection required</option>`;

            courseLevelSelect.disabled = true;
            courseLevelSelect.required = false;

            return;

        }


        courseLevelSelect.innerHTML =
            `<option value="">Select Current Level / Year</option>`;


        course.levels.forEach((level) => {

            const option =
                document.createElement("option");

            option.value =
                String(level.id);

            option.textContent =
                level.levelName;

            courseLevelSelect.appendChild(option);

        });


        courseLevelSelect.disabled = false;
        courseLevelSelect.required = true;

    }


    async function loadRegistrationOptions() {

        try {

            setApiState("Loading courses...");

            const response =
                await fetch(
                    "/api/academic/registration-options",
                    {
                        method: "GET",
                        credentials: "same-origin"
                    }
                );


            const result =
                await response.json();


            if (!response.ok) {

                throw new Error(
                    result.message ||
                    "Unable to load courses."
                );

            }


            availableCourses =
                Array.isArray(result.courses)
                    ? result.courses
                    : [];


            courseSelect.innerHTML =
                `<option value="">Select Course / Program</option>`;


            availableCourses.forEach((course) => {

                const option =
                    document.createElement("option");

                option.value =
                    String(course.id);


                const context =
                    course.departmentName ||
                    course.domainName ||
                    "";


                option.textContent =
                    context
                        ? `${course.courseName} — ${context}`
                        : course.courseName;


                courseSelect.appendChild(option);

            });


            courseSelect.disabled = false;


            if (availableCourses.length === 0) {

                courseSelect.innerHTML =
                    `<option value="">No courses are currently available</option>`;

                courseSelect.disabled = true;

                setApiState(
                    "No active courses are available. Please contact the administrator.",
                    true
                );

                return;

            }


            setApiState(
                `${availableCourses.length} course${availableCourses.length === 1 ? "" : "s"} available.`
            );


        } catch (error) {

            console.error(
                "Registration options error:",
                error
            );

            courseSelect.innerHTML =
                `<option value="">Unable to load courses</option>`;

            courseSelect.disabled = true;

            resetLevelSelect(
                "Course information unavailable"
            );

            setApiState(
                error.message,
                true
            );

        }

    }


    courseSelect.addEventListener(
        "change",
        () => {

            const course =
                availableCourses.find(
                    (item) =>
                        String(item.id) ===
                        String(courseSelect.value)
                );


            renderCourseContext(course);
            renderLevels(course);

        }
    );


    document
        .querySelectorAll(".password-toggle")
        .forEach((button) => {

            button.addEventListener(
                "click",
                () => {

                    const input =
                        document.getElementById(
                            button.dataset.target
                        );

                    if (!input) return;

                    const show =
                        input.type === "password";

                    input.type =
                        show
                            ? "text"
                            : "password";

                    button.textContent =
                        show
                            ? "Hide"
                            : "Show";

                }
            );

        });


    form.addEventListener(
        "submit",
        async (event) => {

            event.preventDefault();


            const formData =
                new FormData(form);


            const payload = {

                fullName:
                    String(
                        formData.get("fullName") || ""
                    ).trim(),

                phone:
                    String(
                        formData.get("phone") || ""
                    ).trim(),

                email:
                    String(
                        formData.get("email") || ""
                    ).trim(),

                courseId:
                    String(
                        formData.get("courseId") || ""
                    ).trim(),

                courseLevelId:
                    String(
                        formData.get("courseLevelId") || ""
                    ).trim(),

                password:
                    String(
                        formData.get("password") || ""
                    ),

                confirmPassword:
                    String(
                        formData.get("confirmPassword") || ""
                    )

            };


            if (!payload.courseId) {

                showToast(
                    "Please select your Course / Program."
                );

                return;

            }


            if (
                !courseLevelSelect.disabled &&
                courseLevelSelect.required &&
                !payload.courseLevelId
            ) {

                showToast(
                    "Please select your Current Level / Year."
                );

                return;

            }


            if (
                payload.password !==
                payload.confirmPassword
            ) {

                showToast(
                    "Passwords do not match."
                );

                return;

            }


            if (
                payload.password.length < 8
            ) {

                showToast(
                    "Password must contain at least 8 characters."
                );

                return;

            }


            try {

                submitButton.disabled = true;
                submitButton.textContent =
                    "Creating Account...";


                const response =
                    await fetch(
                        "/api/auth/register",
                        {
                            method: "POST",

                            headers: {
                                "Content-Type":
                                    "application/json"
                            },

                            credentials:
                                "same-origin",

                            body:
                                JSON.stringify(payload)
                        }
                    );


                const result =
                    await response.json();


                if (!response.ok) {

                    throw new Error(
                        result.message ||
                        "Unable to create account."
                    );

                }


                const user =
                    result.user || {};


                document.getElementById(
                    "createdFullName"
                ).textContent =
                    user.fullName || "-";


                document.getElementById(
                    "createdUsername"
                ).textContent =
                    user.username || "-";


                document.getElementById(
                    "createdUserId"
                ).textContent =
                    user.id || "-";


                document.getElementById(
                    "createdEmail"
                ).textContent =
                    user.email || "-";


                if (successOverlay) {

                    successOverlay.classList.add(
                        "show"
                    );

                    successOverlay.setAttribute(
                        "aria-hidden",
                        "false"
                    );

                }


                form.reset();

                courseContextCard.classList.remove(
                    "show"
                );

                resetLevelSelect();

                await loadRegistrationOptions();


            } catch (error) {

                console.error(
                    "Registration error:",
                    error
                );

                showToast(
                    error.message
                );


            } finally {

                submitButton.disabled = false;
                submitButton.textContent =
                    "Create Account";

            }

        }
    );


    loadRegistrationOptions();

});
