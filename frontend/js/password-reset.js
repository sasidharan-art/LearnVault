document.addEventListener(
    "DOMContentLoaded",
    () => {

        const toast =
            document.getElementById(
                "toast"
            );


        function showToast(
            message,
            type = "success"
        ) {

            if (!toast) {
                return;
            }


            toast.textContent =
                message;

            toast.className =
                `toast show ${type}`;


            clearTimeout(
                toast.hideTimer
            );


            toast.hideTimer =
                setTimeout(
                    () => {
                        toast.className =
                            "toast";
                    },
                    3200
                );

        }


        async function jsonRequest(
            url,
            options
        ) {

            const response =
                await fetch(
                    url,
                    options
                );


            let result;


            try {

                result =
                    await response.json();

            } catch (_) {

                throw new Error(
                    "Invalid server response"
                );

            }


            if (!response.ok) {

                throw new Error(
                    result.message ||
                    "Request failed"
                );

            }


            return result;

        }


        function setButtonBusy(
            button,
            busyText,
            busy
        ) {

            if (!button) {
                return;
            }


            if (busy) {

                button.dataset.originalText =
                    button.textContent;

                button.disabled =
                    true;

                button.textContent =
                    busyText;

            } else {

                button.disabled =
                    false;

                button.textContent =
                    button.dataset.originalText ||
                    button.textContent;

            }

        }


        document
            .querySelectorAll(
                ".reset-password-toggle"
            )
            .forEach(
                (button) => {

                    button.addEventListener(
                        "click",
                        () => {

                            const input =
                                document.getElementById(
                                    button.dataset.target
                                );


                            if (!input) {
                                return;
                            }


                            input.type =
                                input.type ===
                                "password"
                                    ? "text"
                                    : "password";


                            button.textContent =
                                input.type ===
                                "password"
                                    ? "Show"
                                    : "Hide";

                        }
                    );

                }
            );


        /* =================================================
           FORGOT PASSWORD PAGE
        ================================================= */

        const forgotForm =
            document.getElementById(
                "forgotPasswordForm"
            );


        if (forgotForm) {

            forgotForm.addEventListener(
                "submit",
                async (event) => {

                    event.preventDefault();


                    const email =
                        document.getElementById(
                            "forgotEmail"
                        ).value.trim();


                    const button =
                        document.getElementById(
                            "forgotSubmitButton"
                        );


                    try {

                        setButtonBusy(
                            button,
                            "Sending OTP...",
                            true
                        );


                        const result =
                            await jsonRequest(
                                "/api/auth/forgot-password",
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
                                        JSON.stringify({
                                            email
                                        })
                                }
                            );


                        sessionStorage.setItem(
                            "learnvault_reset_email",
                            email
                        );


                        if (
                            result.devOtp
                        ) {

                            sessionStorage.setItem(
                                "learnvault_dev_reset_otp",
                                result.devOtp
                            );

                        } else {

                            sessionStorage.removeItem(
                                "learnvault_dev_reset_otp"
                            );

                        }


                        showToast(
                            result.devOtp
                                ? `Development OTP: ${result.devOtp}`
                                : result.message
                        );


                        setTimeout(
                            () => {

                                window.location.href =
                                    `reset-password.html?email=${encodeURIComponent(email)}`;

                            },
                            result.devOtp
                                ? 1400
                                : 700
                        );


                    } catch (error) {

                        showToast(
                            error.message,
                            "error"
                        );


                    } finally {

                        setButtonBusy(
                            button,
                            "",
                            false
                        );

                    }

                }
            );

        }


        /* =================================================
           RESET PAGE — INITIAL DATA
        ================================================= */

        const resetEmail =
            document.getElementById(
                "resetEmail"
            );

        const resetOtp =
            document.getElementById(
                "resetOtp"
            );


        if (resetEmail) {

            const params =
                new URLSearchParams(
                    window.location.search
                );


            resetEmail.value =
                params.get("email") ||
                sessionStorage.getItem(
                    "learnvault_reset_email"
                ) ||
                "";


            const devOtp =
                sessionStorage.getItem(
                    "learnvault_dev_reset_otp"
                );


            if (
                devOtp &&
                resetOtp
            ) {

                resetOtp.value =
                    devOtp;

                setTimeout(
                    () =>
                        showToast(
                            `Local development OTP: ${devOtp}`
                        ),
                    250
                );

            }

        }


        /* =================================================
           VERIFY OTP
        ================================================= */

        const verifyForm =
            document.getElementById(
                "verifyOtpForm"
            );


        if (verifyForm) {

            verifyForm.addEventListener(
                "submit",
                async (event) => {

                    event.preventDefault();


                    const button =
                        verifyForm.querySelector(
                            'button[type="submit"]'
                        );


                    try {

                        setButtonBusy(
                            button,
                            "Verifying...",
                            true
                        );


                        const result =
                            await jsonRequest(
                                "/api/auth/verify-reset-otp",
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
                                        JSON.stringify({
                                            email:
                                                resetEmail.value.trim(),

                                            otp:
                                                resetOtp.value.trim()
                                        })
                                }
                            );


                        sessionStorage.setItem(
                            "learnvault_reset_token",
                            result.resetToken
                        );


                        sessionStorage.removeItem(
                            "learnvault_dev_reset_otp"
                        );


                        document.getElementById(
                            "otpStep"
                        ).hidden =
                            true;


                        document.getElementById(
                            "newPasswordStep"
                        ).hidden =
                            false;


                        document.getElementById(
                            "otpProgressStep"
                        ).classList.add(
                            "complete"
                        );


                        document.getElementById(
                            "passwordProgressStep"
                        ).classList.add(
                            "active"
                        );


                        document.getElementById(
                            "resetNewPassword"
                        ).focus();


                        showToast(
                            "OTP verified."
                        );


                    } catch (error) {

                        showToast(
                            error.message,
                            "error"
                        );


                    } finally {

                        setButtonBusy(
                            button,
                            "",
                            false
                        );

                    }

                }
            );

        }


        /* =================================================
           RESET PASSWORD
        ================================================= */

        const passwordForm =
            document.getElementById(
                "resetPasswordForm"
            );


        if (passwordForm) {

            passwordForm.addEventListener(
                "submit",
                async (event) => {

                    event.preventDefault();


                    const newPassword =
                        document.getElementById(
                            "resetNewPassword"
                        ).value;


                    const confirmPassword =
                        document.getElementById(
                            "resetConfirmPassword"
                        ).value;


                    if (
                        newPassword !==
                        confirmPassword
                    ) {

                        showToast(
                            "Passwords do not match.",
                            "error"
                        );

                        return;

                    }


                    const resetToken =
                        sessionStorage.getItem(
                            "learnvault_reset_token"
                        );


                    if (!resetToken) {

                        showToast(
                            "Reset session expired. Verify a new OTP.",
                            "error"
                        );

                        return;

                    }


                    const button =
                        passwordForm.querySelector(
                            'button[type="submit"]'
                        );


                    try {

                        setButtonBusy(
                            button,
                            "Resetting...",
                            true
                        );


                        const result =
                            await jsonRequest(
                                "/api/auth/reset-password",
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
                                        JSON.stringify({
                                            resetToken,
                                            newPassword,
                                            confirmPassword
                                        })
                                }
                            );


                        sessionStorage.removeItem(
                            "learnvault_reset_token"
                        );

                        sessionStorage.removeItem(
                            "learnvault_reset_email"
                        );

                        sessionStorage.removeItem(
                            "learnvault_dev_reset_otp"
                        );


                        showToast(
                            result.message
                        );


                        setTimeout(
                            () => {

                                window.location.href =
                                    "login.html";

                            },
                            900
                        );


                    } catch (error) {

                        showToast(
                            error.message,
                            "error"
                        );


                    } finally {

                        setButtonBusy(
                            button,
                            "",
                            false
                        );

                    }

                }
            );

        }

    }
);
