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


    const transporter =
        nodemailer.createTransport({

            host:
                process.env.SMTP_HOST,

            port,

            secure:
                String(
                    process.env.SMTP_SECURE ||
                    ""
                ).toLowerCase() ===
                "true",

            auth: {
                user:
                    process.env.SMTP_USER,
                pass:
                    process.env.SMTP_PASS
            }

        });


    await transporter.sendMail({

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


    return {
        delivered:
            true,
        devMode:
            false
    };

}


module.exports = {
    sendPasswordResetOtp,
    smtpConfigured,
    devModeEnabled
};
