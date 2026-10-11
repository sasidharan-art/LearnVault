function smtpConfigured() {

    return Boolean(
        process.env.SMTP_HOST &&
        process.env.SMTP_PORT &&
        process.env.SMTP_USER &&
        process.env.SMTP_PASS &&
        process.env.SMTP_FROM
    );

}


function devModeEnabled() {

    return (
        process.env.NODE_ENV !== "production" &&
        String(
            process.env.OTP_DEV_MODE ||
            ""
        ).toLowerCase() ===
        "true"
    );

}


async function sendPasswordResetOtp({
    email,
    fullName,
    otp
}) {

    /*
       For local development, OTP_DEV_MODE=true allows the
       frontend to display the OTP without sending email.
    */

    if (
        devModeEnabled() &&
        !smtpConfigured()
    ) {

        return {
            delivered:
                false,
            devMode:
                true
        };

    }


    if (!smtpConfigured()) {

        throw new Error(
            "SMTP is not configured. Add SMTP settings to backend/.env."
        );

    }


    let nodemailer;


    try {

        nodemailer =
            require("nodemailer");

    } catch (error) {

        throw new Error(
            "Nodemailer is not installed. Run: npm install nodemailer"
        );

    }


    const port =
        Number(
            process.env.SMTP_PORT
        );


    const baseTransportOptions = {
        host: process.env.SMTP_HOST,
        secure: String(process.env.SMTP_SECURE || "").toLowerCase() === "true",
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000
    };

    async function sendWithPort(selectedPort) {
        const transporter = nodemailer.createTransport({
            ...baseTransportOptions,
            port: selectedPort
        });
        return transporter.sendMail({

        from:
            process.env.SMTP_FROM,

        to:
            email,

        subject:
            "LearnVault password reset OTP",

        text:
            [
                `Hello ${fullName || "LearnVault user"},`,
                "",
                `Your LearnVault password reset OTP is: ${otp}`,
                "",
                "This OTP expires in 10 minutes.",
                "If you did not request a password reset, you can ignore this email.",
                "",
                "LearnVault",
                "Learn • Practice • Grow"
            ].join("\n"),

        html:
            `
            <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px;color:#111827">
                <h2 style="margin:0 0 12px;color:#4f46e5">LearnVault</h2>

                <p>Hello ${String(fullName || "LearnVault user").replace(/[<>&"]/g, "")},</p>

                <p>Use this OTP to reset your LearnVault password:</p>

                <div style="
                    font-size:30px;
                    font-weight:800;
                    letter-spacing:8px;
                    padding:16px 18px;
                    margin:18px 0;
                    border-radius:12px;
                    background:#f4f5ff;
                    color:#312e81;
                    text-align:center
                ">
                    ${otp}
                </div>

                <p>This OTP expires in <strong>10 minutes</strong>.</p>

                <p style="color:#6b7280;font-size:13px">
                    If you did not request a password reset, you can ignore this email.
                </p>

                <p style="margin-top:24px;color:#6b7280;font-size:12px">
                    Learn • Practice • Grow
                </p>
            </div>
            `

        });
    }

    try {
        await sendWithPort(port);
    } catch (error) {
        const canFallback = port === 587 && String(process.env.SMTP_FALLBACK_PORT || "2525") === "2525";
        const timeoutLike = ["ETIMEDOUT", "ECONNECTION", "ESOCKET"].includes(String(error.code || ""));
        if (!canFallback || !timeoutLike) throw error;
        console.warn("Brevo SMTP port 587 timed out; retrying on port 2525.");
        await sendWithPort(2525);
    }

    return {
        delivered: true,
        devMode: false
    };

}


async function sendFocusViolationAlert({ email, fullName, violationCount, durationMinutes, alertEmail }) {
    if (!smtpConfigured()) {
        throw new Error("SMTP is not configured. Add SMTP settings to the backend hosting environment.");
    }
    const nodemailer = require("nodemailer");
    const port = Number(process.env.SMTP_PORT);
    const transportOptions = {
        host: process.env.SMTP_HOST,
        port,
        secure: String(process.env.SMTP_SECURE || "").toLowerCase() === "true",
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000
    };
    const safeName = String(fullName || "LearnVault student").replace(/[<>&"']/g, "");
    const recipients = String(alertEmail || "").trim();
    const message = {
        from: process.env.SMTP_FROM,
        to: email,
        ...(recipients ? { cc: recipients } : {}),
        subject: "LearnVault Focus Mode: three violations recorded",
        text: [
            `Hello ${safeName},`,
            "",
            `LearnVault recorded ${violationCount} Focus Mode violations during a ${durationMinutes}-minute focus session.`,
            "The session was ended after the third violation. Internal navigation within LearnVault is allowed and should not count as a violation.",
            "",
            "If you believe this alert was triggered incorrectly, contact your faculty member or LearnVault support.",
            "",
            "LearnVault — Learn • Practice • Grow"
        ].join("\n"),
        html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;color:#172033"><h2 style="color:#5145cd">LearnVault Focus Mode</h2><p>Hello ${safeName},</p><p>LearnVault recorded <strong>${violationCount} Focus Mode violations</strong> during a ${durationMinutes}-minute focus session.</p><p>The session was ended after the third violation. Moving between pages within LearnVault is allowed and should not count as a violation.</p><p>If you believe this alert was triggered incorrectly, contact your faculty member or LearnVault support.</p><p style="color:#667085">LearnVault · Learn • Practice • Grow</p></div>`
    };
    const transporter = nodemailer.createTransport(transportOptions);
    await transporter.sendMail(message);
    return { delivered: true };
}


module.exports = {
    sendPasswordResetOtp,
    sendFocusViolationAlert,
    smtpConfigured,
    devModeEnabled
};
