document.addEventListener(
    "DOMContentLoaded",
    () => {


        /* =====================================================
           COMMON ELEMENTS
        ===================================================== */

        const statusText =
            document.getElementById(
                "serverStatus"
            );


        const statusDot =
            document.getElementById(
                "statusDot"
            );


        const toast =
            document.getElementById(
                "toast"
            );


        /* =====================================================
           MINIMIZED / MOBILE NAVIGATION
           Button appears before the logo only in narrow view.
        ===================================================== */

        const mobileNavToggle =
            document.getElementById(
                "mobileNavToggle"
            );

        const primaryNavigation =
            document.getElementById(
                "primaryNavigation"
            );

        const navOverlay =
            document.getElementById(
                "navOverlay"
            );


        function closeMobileNavigation() {

            if (primaryNavigation) {
                primaryNavigation.classList.remove(
                    "mobile-open"
                );
            }

            if (navOverlay) {
                navOverlay.classList.remove(
                    "show"
                );
            }

            if (mobileNavToggle) {
                mobileNavToggle.classList.remove(
                    "active"
                );

                mobileNavToggle.setAttribute(
                    "aria-expanded",
                    "false"
                );
            }

            document.body.classList.remove(
                "nav-open"
            );

        }


        function openMobileNavigation() {

            if (primaryNavigation) {
                primaryNavigation.classList.add(
                    "mobile-open"
                );
            }

            if (navOverlay) {
                navOverlay.classList.add(
                    "show"
                );
            }

            if (mobileNavToggle) {
                mobileNavToggle.classList.add(
                    "active"
                );

                mobileNavToggle.setAttribute(
                    "aria-expanded",
                    "true"
                );
            }

            document.body.classList.add(
                "nav-open"
            );

        }


        if (
            mobileNavToggle &&
            primaryNavigation
        ) {

            mobileNavToggle.addEventListener(
                "click",
                () => {

                    const isOpen =
                        primaryNavigation.classList.contains(
                            "mobile-open"
                        );

                    if (isOpen) {
                        closeMobileNavigation();
                    } else {
                        openMobileNavigation();
                    }

                }
            );

        }


        if (navOverlay) {

            navOverlay.addEventListener(
                "click",
                closeMobileNavigation
            );

        }


        if (primaryNavigation) {

            primaryNavigation
                .querySelectorAll("a")
                .forEach(
                    (link) => {

                        link.addEventListener(
                            "click",
                            () => {
                                closeMobileNavigation();
                            }
                        );

                    }
                );

        }



        /* =====================================================
           TOAST
        ===================================================== */

        function showToast(message) {

            if (!toast) {

                console.log(message);

                return;

            }


            toast.textContent =
                message;


            toast.classList.add(
                "show"
            );


            clearTimeout(
                toast.hideTimer
            );


            toast.hideTimer =
                setTimeout(
                    () => {

                        toast.classList.remove(
                            "show"
                        );

                    },
                    3000
                );

        }



        /* =====================================================
           SAFE JSON
        ===================================================== */

        async function readJsonResponse(
            response
        ) {

            try {

                return await response.json();

            } catch (error) {

                throw new Error(
                    "Invalid response from server."
                );

            }

        }



        /* =====================================================
           HEALTH CHECK
        ===================================================== */

        if (
            statusText &&
            statusDot
        ) {

            fetch(
                "/api/health"
            )

                .then(
                    (response) => {

                        if (
                            !response.ok
                        ) {

                            throw new Error(
                                "Server unavailable"
                            );

                        }


                        return response.json();

                    }
                )


                .then(
                    () => {

                        statusText.textContent =
                            "LearnVault server connected";


                        statusDot.classList.remove(
                            "offline"
                        );


                        statusDot.classList.add(
                            "online"
                        );

                    }
                )


                .catch(
                    () => {

                        statusText.textContent =
                            "LearnVault server unavailable";


                        statusDot.classList.remove(
                            "online"
                        );


                        statusDot.classList.add(
                            "offline"
                        );

                    }
                );

        }



        /* =====================================================
           SHOW / HIDE PASSWORD — SINGLE GLOBAL HANDLER

           Registration previously had TWO listeners:
           main.js + register.js.
           One click toggled the field twice and visually appeared
           to do nothing.

           Password visibility is now controlled ONLY here.
        ===================================================== */

        document.addEventListener(
            "click",
            (event) => {

                const button =
                    event.target.closest(
                        ".password-toggle"
                    );


                if (!button) {
                    return;
                }


                event.preventDefault();


                const targetId =
                    button.dataset.target;


                if (!targetId) {
                    return;
                }


                const input =
                    document.getElementById(
                        targetId
                    );


                if (!input) {
                    return;
                }


                const showing =
                    input.type ===
                    "password";


                input.type =
                    showing
                        ? "text"
                        : "password";


                button.textContent =
                    showing
                        ? "Hide"
                        : "Show";


                button.setAttribute(
                    "aria-pressed",
                    String(showing)
                );


                button.setAttribute(
                    "aria-label",
                    showing
                        ? "Hide password"
                        : "Show password"
                );

            }
        );



        /* =====================================================
           LOGIN
        ===================================================== */

        const loginForm =
            document.getElementById(
                "loginForm"
            );


        if (loginForm) {

            loginForm.addEventListener(
                "submit",
                async (event) => {

                    event.preventDefault();


                    const submitButton =
                        loginForm.querySelector(
                            'button[type="submit"]'
                        );


                    const formData =
                        new FormData(
                            loginForm
                        );


                    const loginData = {

                        identifier:
                            String(
                                formData.get(
                                    "identifier"
                                ) || ""
                            ).trim(),

                        password:
                            String(
                                formData.get(
                                    "password"
                                ) || ""
                            )

                    };



                    if (
                        !loginData.identifier
                    ) {

                        showToast(
                            "Please enter your email, username or User ID."
                        );

                        return;

                    }



                    if (
                        !loginData.password
                    ) {

                        showToast(
                            "Please enter your password."
                        );

                        return;

                    }



                    try {

                        if (
                            submitButton
                        ) {

                            submitButton.disabled =
                                true;


                            submitButton.textContent =
                                "Logging in...";

                        }



                        const response =
                            await fetch(
                                "/api/auth/login",
                                {

                                    method:
                                        "POST",

                                    headers: {

                                        "Content-Type":
                                            "application/json"

                                    },

                                    credentials:
                                        "same-origin",

                                    body:
                                        JSON.stringify(
                                            loginData
                                        )

                                }
                            );



                        const result =
                            await readJsonResponse(
                                response
                            );



                        if (
                            !response.ok
                        ) {

                            throw new Error(

                                result.message ||

                                "Login failed."

                            );

                        }



                        showToast(
                            result.message ||
                            "Login successful."
                        );



                        /*
                           Temporary redirect.

                           Later:

                           student →
                           student/dashboard.html

                           faculty →
                           faculty/dashboard.html

                           admin →
                           admin/dashboard.html
                        */

                        setTimeout(
                            () => {

                                const role = String(
                                    result.user && result.user.role
                                        ? result.user.role
                                        : ""
                                )
                                    .trim()
                                    .toLowerCase();

                                if (role === "student") {

                                    window.location.href =
                                        "student/dashboard.html";

                                    return;
                                }

                                if (role === "faculty") {

                                    window.location.href =
                                        "index.html";

                                    return;
                                }

                                if (role === "admin") {

                                    window.location.href =
                                        "index.html";

                                    return;
                                }

                                window.location.href =
                                    "index.html";

                            },
                            800
                        );


                    } catch (error) {

                        console.error(
                            "Login error:",
                            error
                        );


                        showToast(

                            error.message ||

                            "Unable to login."

                        );


                    } finally {

                        if (
                            submitButton
                        ) {

                            submitButton.disabled =
                                false;


                            submitButton.textContent =
                                "Log in";

                        }

                    }

                }
            );

        }



        /* =====================================================
           STUDENT REGISTRATION
        ===================================================== */

        const registerForm =
            document.getElementById(
                "registerForm"
            );


        if (registerForm) {

            registerForm.addEventListener(
                "submit",
                async (event) => {

                    event.preventDefault();



                    /* =================================================
                       BUTTON
                    ================================================= */

                    const submitButton =
                        registerForm.querySelector(
                            'button[type="submit"]'
                        );



                    /* =================================================
                       FORM DATA
                    ================================================= */

                    const formData =
                        new FormData(
                            registerForm
                        );



                    /*
                       IMPORTANT FIX:

                       Read Year and Semester
                       directly from their SELECT elements.
                    */

                    const yearSelect =
                        document.getElementById(
                            "year"
                        );


                    const semesterSelect =
                        document.getElementById(
                            "semester"
                        );



                    const studentData = {


                        fullName:

                            String(
                                formData.get(
                                    "fullName"
                                ) || ""
                            ).trim(),



                        email:

                            String(
                                formData.get(
                                    "email"
                                ) || ""
                            )
                                .trim()
                                .toLowerCase(),



                        phone:

                            String(
                                formData.get(
                                    "phone"
                                ) || ""
                            ).trim(),



                        program:

                            String(
                                formData.get(
                                    "program"
                                ) || ""
                            ).trim(),



                        year:

                            yearSelect
                                ? String(
                                    yearSelect.value
                                ).trim()
                                : "",



                        semester:

                            semesterSelect
                                ? String(
                                    semesterSelect.value
                                ).trim()
                                : "",



                        password:

                            String(
                                formData.get(
                                    "password"
                                ) || ""
                            ),



                        confirmPassword:

                            String(
                                formData.get(
                                    "confirmPassword"
                                ) || ""
                            )

                    };



                    /* =================================================
                       DEBUG

                       You can see selected values
                       in browser console.
                    ================================================= */

                    console.log(
                        "Registration data:",
                        {
                            fullName:
                                studentData.fullName,

                            year:
                                studentData.year,

                            semester:
                                studentData.semester
                        }
                    );



                    /* =================================================
                       FULL NAME
                    ================================================= */

                    if (
                        !studentData.fullName
                    ) {

                        showToast(
                            "Please enter your full name."
                        );

                        return;

                    }


                    if (
                        studentData.fullName.length <
                        2
                    ) {

                        showToast(
                            "Please enter a valid full name."
                        );

                        return;

                    }



                    /* =================================================
                       EMAIL
                    ================================================= */

                    if (
                        !studentData.email
                    ) {

                        showToast(
                            "Please enter your email address."
                        );

                        return;

                    }



                    const emailPattern =
                        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;



                    if (
                        !emailPattern.test(
                            studentData.email
                        )
                    ) {

                        showToast(
                            "Please enter a valid email address."
                        );

                        return;

                    }



                    /* =================================================
                       PHONE
                    ================================================= */

                    if (
                        !studentData.phone
                    ) {

                        showToast(
                            "Please enter your phone number."
                        );

                        return;

                    }



                    const cleanPhone =
                        studentData.phone.replace(
                            /[\s()-]/g,
                            ""
                        );



                    const phonePattern =
                        /^\+?[0-9]{10,15}$/;



                    if (
                        !phonePattern.test(
                            cleanPhone
                        )
                    ) {

                        showToast(
                            "Please enter a valid phone number."
                        );

                        return;

                    }



                    studentData.phone =
                        cleanPhone;



                    /* =================================================
                       YEAR
                    ================================================= */

                    if (
                        !studentData.year
                    ) {

                        showToast(
                            "Please select your study year."
                        );

                        return;

                    }



                    /* =================================================
                       SEMESTER
                    ================================================= */

                    if (
                        !studentData.semester
                    ) {

                        showToast(
                            "Please select your semester."
                        );

                        return;

                    }



                    /* =================================================
                       PASSWORD
                    ================================================= */

                    if (
                        !studentData.password
                    ) {

                        showToast(
                            "Please create a password."
                        );

                        return;

                    }



                    if (
                        studentData.password.length <
                        8
                    ) {

                        showToast(
                            "Password must contain at least 8 characters."
                        );

                        return;

                    }



                    /* =================================================
                       CONFIRM PASSWORD
                    ================================================= */

                    if (
                        !studentData.confirmPassword
                    ) {

                        showToast(
                            "Please confirm your password."
                        );

                        return;

                    }



                    if (
                        studentData.password !==
                        studentData.confirmPassword
                    ) {

                        showToast(
                            "Password and confirm password must match."
                        );

                        return;

                    }



                    /* =================================================
                       SEND TO BACKEND
                    ================================================= */

                    try {

                        if (
                            submitButton
                        ) {

                            submitButton.disabled =
                                true;


                            submitButton.textContent =
                                "Creating Account...";

                        }



                        const response =
                            await fetch(
                                "/api/auth/register",
                                {

                                    method:
                                        "POST",

                                    headers: {

                                        "Content-Type":
                                            "application/json"

                                    },

                                    credentials:
                                        "same-origin",

                                    body:
                                        JSON.stringify(
                                            studentData
                                        )

                                }
                            );



                        const result =
                            await readJsonResponse(
                                response
                            );



                        /* =================================================
                           BACKEND ERROR
                        ================================================= */

                        if (
                            !response.ok
                        ) {

                            throw new Error(

                                result.message ||

                                "Unable to create student account."

                            );

                        }



                        /* =================================================
                           SUCCESS
                        ================================================= */

                        showToast(

                            result.message ||

                            "Student account created successfully."

                        );



                        /*
                           Backend returns:

                           id
                           fullName
                           username
                           email
                           role
                        */

                        const successOverlay =
                            document.getElementById(
                                "accountSuccessOverlay"
                            );


                        const createdFullName =
                            document.getElementById(
                                "createdFullName"
                            );


                        const createdUsername =
                            document.getElementById(
                                "createdUsername"
                            );


                        const createdUserId =
                            document.getElementById(
                                "createdUserId"
                            );


                        const createdEmail =
                            document.getElementById(
                                "createdEmail"
                            );



                        if (
                            result.user
                        ) {

                            if (
                                createdFullName
                            ) {

                                createdFullName.textContent =
                                    result.user.fullName ||
                                    "-";

                            }


                            if (
                                createdUsername
                            ) {

                                createdUsername.textContent =
                                    result.user.username ||
                                    "-";

                            }


                            if (
                                createdUserId
                            ) {

                                createdUserId.textContent =
                                    result.user.id ||
                                    "-";

                            }


                            if (
                                createdEmail
                            ) {

                                createdEmail.textContent =
                                    result.user.email ||
                                    "-";

                            }

                        }



                        if (
                            successOverlay
                        ) {

                            successOverlay.classList.add(
                                "show"
                            );

                        }



                        /* =================================================
                           RESET FORM
                        ================================================= */

                        registerForm.reset();



                        /* =================================================
                           RESET PASSWORD VISIBILITY
                        ================================================= */

                        const registerPassword =
                            document.getElementById(
                                "registerPassword"
                            );


                        const confirmPassword =
                            document.getElementById(
                                "confirmPassword"
                            );



                        if (
                            registerPassword
                        ) {

                            registerPassword.type =
                                "password";

                        }



                        if (
                            confirmPassword
                        ) {

                            confirmPassword.type =
                                "password";

                        }



                        passwordButtons.forEach(
                            (button) => {

                                button.textContent =
                                    "Show";

                            }
                        );


                    } catch (error) {

                        console.error(
                            "Registration error:",
                            error
                        );


                        showToast(

                            error.message ||

                            "Something went wrong while creating your account."

                        );


                    } finally {

                        if (
                            submitButton
                        ) {

                            submitButton.disabled =
                                false;


                            submitButton.textContent =
                                "Create Student Account";

                        }

                    }

                }
            );

        }



        /* =====================================================
           FORGOT PASSWORD
        ===================================================== */

        const forgotForm =
            document.getElementById(
                "forgotForm"
            );


        if (forgotForm) {

            forgotForm.addEventListener(
                "submit",
                (event) => {

                    event.preventDefault();


                    const emailInput =
                        forgotForm.querySelector(
                            'input[name="email"]'
                        );


                    if (
                        !emailInput ||
                        !emailInput.value.trim()
                    ) {

                        showToast(
                            "Please enter your registered email address."
                        );

                        return;

                    }



                    const email =
                        emailInput.value
                            .trim()
                            .toLowerCase();



                    const emailPattern =
                        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;



                    if (
                        !emailPattern.test(
                            email
                        )
                    ) {

                        showToast(
                            "Please enter a valid email address."
                        );

                        return;

                    }


                    showToast(
                        "Email OTP functionality will be connected later."
                    );

                }
            );

        }


    }
);