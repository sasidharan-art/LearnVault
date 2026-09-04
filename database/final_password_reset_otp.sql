USE learnvault_db;

/* ==========================================================
   LEARNVAULT FINAL PASSWORD RESET OTP TABLE

   This table contains only short-lived password reset data.
   Recreating it is safe for normal project use.
========================================================== */

DROP TABLE IF EXISTS password_reset_otps;

CREATE TABLE password_reset_otps (

    id INT AUTO_INCREMENT PRIMARY KEY,

    user_id INT NOT NULL,

    otp_hash VARCHAR(255) NOT NULL,

    expires_at DATETIME NOT NULL,

    attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,

    verified_at DATETIME NULL,

    used_at DATETIME NULL,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_lv_reset_user_created
        (user_id, created_at),

    INDEX idx_lv_reset_expiry
        (expires_at, used_at),

    FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE

) ENGINE=InnoDB;


/* VERIFY */
DESCRIBE password_reset_otps;

SELECT
    COUNT(*) AS password_reset_otp_rows
FROM password_reset_otps;
