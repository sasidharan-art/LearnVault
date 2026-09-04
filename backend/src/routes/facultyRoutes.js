const express = require("express");
const db = require("../config/db");
const authenticateUser = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

const router = express.Router();

router.get(
    "/dashboard",
    authenticateUser,
    authorizeRoles("faculty"),
    async (req, res) => {
        try {
            const [assignments] = await db.query(`
                SELECT
                    fsa.id AS assignment_id,
                    s.id AS subject_id,
                    s.subject_code,
                    s.subject_name,
                    c.course_code,
                    c.course_name,
                    cl.level_name,
                    ed.domain_name,
                    d.department_name
                FROM faculty_subject_assignments fsa
                INNER JOIN subjects s ON fsa.subject_id = s.id
                INNER JOIN courses c ON s.course_id = c.id
                LEFT JOIN course_levels cl ON s.course_level_id = cl.id
                LEFT JOIN education_domains ed ON c.domain_id = ed.id
                LEFT JOIN departments d ON c.department_id = d.id
                WHERE fsa.faculty_user_id = ?
                  AND fsa.is_active = 1
                  AND s.is_active = 1
                ORDER BY c.course_name, cl.level_order, s.subject_name
            `, [req.user.userId]);

            const [[counts]] = await db.query(`
                SELECT
                    COUNT(*) AS total_uploads,
                    SUM(verification_status = 'approved') AS published_uploads,
                    SUM(verification_status = 'rejected') AS hidden_uploads,
                    SUM(verification_status = 'pending') AS legacy_pending_uploads
                FROM resources
                WHERE uploaded_by = ?
            `, [req.user.userId]);

            return res.json({
                success: true,
                dashboard: {
                    assignmentCount: assignments.length,
                    assignments,
                    totalUploads: Number(counts.total_uploads || 0),
                    publishedUploads: Number(counts.published_uploads || 0),
                    hiddenUploads: Number(counts.hidden_uploads || 0),
                    legacyPendingUploads: Number(counts.legacy_pending_uploads || 0),
                    pendingUploads: Number(counts.legacy_pending_uploads || 0),
                    approvedUploads: Number(counts.published_uploads || 0),
                    rejectedUploads: Number(counts.hidden_uploads || 0)
                }
            });
        } catch (error) {
            console.error("Faculty dashboard error:", error);
            return res.status(500).json({ success: false, message: "Unable to load faculty dashboard" });
        }
    }
);

module.exports = router;
