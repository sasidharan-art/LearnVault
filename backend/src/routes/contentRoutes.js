const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const db = require("../config/db");
const authenticateUser = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

const router = express.Router();

const uploadDirectory = path.join(__dirname, "../../../uploads/resources");
fs.mkdirSync(uploadDirectory, { recursive: true });

const allowedExtensions = new Set([
    ".pdf", ".ppt", ".pptx", ".doc", ".docx",
    ".png", ".jpg", ".jpeg", ".webp"
]);

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDirectory),
    filename: (req, file, cb) => {
        const extension = path.extname(file.originalname || "").toLowerCase();
        cb(null, `${Date.now()}-${crypto.randomUUID()}${extension}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 15 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const extension = path.extname(file.originalname || "").toLowerCase();
        if (!allowedExtensions.has(extension)) {
            return cb(new Error("Unsupported file type. Use PDF, PPT/PPTX, DOC/DOCX or image files."));
        }
        cb(null, true);
    }
});

function uploadSingle(req, res, next) {
    upload.single("file")(req, res, (error) => {
        if (!error) return next();
        return res.status(400).json({ success: false, message: error.message || "File upload failed" });
    });
}

function cleanupUploadedFile(file) {
    if (!file || !file.path) return;
    fs.unlink(file.path, () => {});
}

async function canUseSubject(userId, role, subjectId) {
    if (role === "admin") {
        const [rows] = await db.query(`
            SELECT s.id
            FROM subjects s
            INNER JOIN courses c ON s.course_id = c.id
            WHERE s.id = ? AND s.is_active = 1 AND c.is_active = 1
            LIMIT 1
        `, [subjectId]);
        return rows.length > 0;
    }

    const [rows] = await db.query(`
        SELECT s.id
        FROM faculty_subject_assignments fsa
        INNER JOIN subjects s ON fsa.subject_id = s.id
        INNER JOIN courses c ON s.course_id = c.id
        WHERE fsa.faculty_user_id = ?
          AND fsa.subject_id = ?
          AND fsa.is_active = 1
          AND s.is_active = 1
          AND c.is_active = 1
        LIMIT 1
    `, [userId, subjectId]);

    return rows.length > 0;
}

router.get(
    "/meta",
    authenticateUser,
    authorizeRoles("faculty", "admin"),
    async (req, res) => {
        try {
            let subjects;

            if (req.user.role === "admin") {
                [subjects] = await db.query(`
                    SELECT
                        s.id,
                        s.subject_code,
                        s.subject_name,
                        c.course_name,
                        cl.level_name,
                        ed.domain_name,
                        d.department_name
                    FROM subjects s
                    INNER JOIN courses c ON s.course_id = c.id
                    LEFT JOIN course_levels cl ON s.course_level_id = cl.id
                    LEFT JOIN education_domains ed ON c.domain_id = ed.id
                    LEFT JOIN departments d ON c.department_id = d.id
                    WHERE s.is_active = 1 AND c.is_active = 1
                    ORDER BY c.course_name, cl.level_order, s.subject_name
                `);
            } else {
                [subjects] = await db.query(`
                    SELECT
                        s.id,
                        s.subject_code,
                        s.subject_name,
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
                      AND c.is_active = 1
                    ORDER BY c.course_name, cl.level_order, s.subject_name
                `, [req.user.userId]);
            }

            const [resourceTypes] = await db.query(`
                SELECT id, type_name
                FROM resource_types
                ORDER BY type_name
            `);

            return res.json({ success: true, subjects, resourceTypes });
        } catch (error) {
            console.error("Content meta error:", error);
            return res.status(500).json({ success: false, message: "Unable to load upload options" });
        }
    }
);

router.get(
    "/resources/mine",
    authenticateUser,
    authorizeRoles("faculty", "admin"),
    async (req, res) => {
        try {
            const [resources] = await db.query(`
                SELECT
                    r.id,
                    r.title,
                    r.description,
                    r.original_file_name,
                    r.file_path,
                    r.external_url,
                    r.mime_type,
                    r.file_size,
                    r.verification_status,
                    r.created_at,
                    rt.type_name AS resource_type,
                    s.subject_code,
                    s.subject_name,
                    c.course_name,
                    cl.level_name
                FROM resources r
                INNER JOIN resource_types rt ON r.resource_type_id = rt.id
                INNER JOIN subjects s ON r.subject_id = s.id
                INNER JOIN courses c ON s.course_id = c.id
                LEFT JOIN course_levels cl ON s.course_level_id = cl.id
                WHERE r.uploaded_by = ?
                ORDER BY r.created_at DESC
            `, [req.user.userId]);

            return res.json({ success: true, count: resources.length, resources });
        } catch (error) {
            console.error("Own resources error:", error);
            return res.status(500).json({ success: false, message: "Unable to load your resources" });
        }
    }
);

router.post(
    "/resources",
    authenticateUser,
    authorizeRoles("faculty", "admin"),
    uploadSingle,
    async (req, res) => {
        const subjectId = Number(req.body.subjectId);
        const resourceTypeId = Number(req.body.resourceTypeId);
        const title = String(req.body.title || "").trim();
        const description = String(req.body.description || "").trim();
        const externalUrl = String(req.body.externalUrl || "").trim();

        if (!Number.isInteger(subjectId) || subjectId <= 0 || !Number.isInteger(resourceTypeId) || resourceTypeId <= 0 || !title) {
            cleanupUploadedFile(req.file);
            return res.status(400).json({ success: false, message: "Subject, resource type and title are required" });
        }

        if (!req.file && !externalUrl) {
            return res.status(400).json({ success: false, message: "Choose a file or provide an external learning link" });
        }

        try {
            if (!(await canUseSubject(req.user.userId, req.user.role, subjectId))) {
                cleanupUploadedFile(req.file);
                return res.status(403).json({ success: false, message: "You are not allowed to add resources to this subject" });
            }

            const [typeRows] = await db.query(`SELECT id FROM resource_types WHERE id = ? LIMIT 1`, [resourceTypeId]);
            if (typeRows.length === 0) {
                cleanupUploadedFile(req.file);
                return res.status(400).json({ success: false, message: "Invalid resource type" });
            }

            const isAdmin = req.user.role === "admin";
            const status = "approved";
            const storedName = req.file ? req.file.filename : null;
            const relativePath = req.file ? `uploads/resources/${req.file.filename}` : null;

            const [result] = await db.query(`
                INSERT INTO resources
                (
                    subject_id,
                    resource_type_id,
                    uploaded_by,
                    title,
                    description,
                    original_file_name,
                    stored_file_name,
                    file_path,
                    external_url,
                    mime_type,
                    file_size,
                    verification_status,
                    verified_by,
                    verified_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                subjectId,
                resourceTypeId,
                req.user.userId,
                title,
                description || null,
                req.file ? req.file.originalname : null,
                storedName,
                relativePath,
                externalUrl || null,
                req.file ? req.file.mimetype : null,
                req.file ? req.file.size : null,
                status,
                isAdmin ? req.user.userId : null,
                new Date()
            ]);

            return res.status(201).json({
                success: true,
                message: isAdmin ? "Resource added and published" : "Resource published to your assigned subject",
                resourceId: result.insertId,
                verificationStatus: status
            });
        } catch (error) {
            cleanupUploadedFile(req.file);
            console.error("Upload resource error:", error);
            return res.status(500).json({ success: false, message: "Unable to save resource" });
        }
    }
);

router.patch(
    "/resources/:id",
    authenticateUser,
    authorizeRoles("faculty", "admin"),
    async (req, res) => {
        const resourceId = Number(req.params.id);
        const title = String(req.body.title || "").trim();
        const description = String(req.body.description || "").trim();
        const externalUrl = String(req.body.externalUrl || "").trim();

        if (!Number.isInteger(resourceId) || resourceId <= 0 || !title) {
            return res.status(400).json({ success: false, message: "Valid resource and title are required" });
        }

        try {
            const [rows] = await db.query(`SELECT id, uploaded_by FROM resources WHERE id = ? LIMIT 1`, [resourceId]);
            if (rows.length === 0) {
                return res.status(404).json({ success: false, message: "Resource not found" });
            }

            if (req.user.role === "faculty" && Number(rows[0].uploaded_by) !== Number(req.user.userId)) {
                return res.status(403).json({ success: false, message: "You can edit only your own resources" });
            }

            if (req.user.role === "faculty") {
                await db.query(`
                    UPDATE resources
                    SET title = ?, description = ?, external_url = ?,
                        verification_status = 'approved',
                        verified_by = NULL,
                        verified_at = NOW()
                    WHERE id = ?
                `, [title, description || null, externalUrl || null, resourceId]);
            } else {
                await db.query(`UPDATE resources SET title = ?, description = ?, external_url = ? WHERE id = ?`, [title, description || null, externalUrl || null, resourceId]);
            }

            return res.json({
                success: true,
                message: req.user.role === "faculty"
                    ? "Resource updated and published"
                    : "Resource updated"
            });
        } catch (error) {
            console.error("Edit resource error:", error);
            return res.status(500).json({ success: false, message: "Unable to update resource" });
        }
    }
);


/* FACULTY / ADMIN RESOURCE PUBLICATION CONTROL */
router.patch(
    "/resources/:id/publication",
    authenticateUser,
    authorizeRoles("faculty", "admin"),
    async (req, res) => {
        const resourceId = Number(req.params.id);
        const isPublished =
            req.body.isPublished === true ||
            req.body.isPublished === 1 ||
            req.body.isPublished === "1";

        if (!Number.isInteger(resourceId) || resourceId <= 0) {
            return res.status(400).json({ success:false, message:"Invalid resource" });
        }

        try {
            const [rows] = await db.query(
                `SELECT id, uploaded_by FROM resources WHERE id=? LIMIT 1`,
                [resourceId]
            );

            if (!rows.length) {
                return res.status(404).json({ success:false, message:"Resource not found" });
            }

            if (
                req.user.role === "faculty" &&
                Number(rows[0].uploaded_by) !== Number(req.user.userId)
            ) {
                return res.status(403).json({
                    success:false,
                    message:"You can control only your own resources"
                });
            }

            await db.query(
                `UPDATE resources
                 SET verification_status=?,
                     verified_by=?,
                     verified_at=NOW()
                 WHERE id=?`,
                [
                    isPublished ? "approved" : "rejected",
                    req.user.role === "admin" ? req.user.userId : null,
                    resourceId
                ]
            );

            return res.json({
                success:true,
                message:isPublished ? "Resource published" : "Resource unpublished"
            });
        } catch (error) {
            console.error("Resource publication error:", error);
            return res.status(500).json({
                success:false,
                message:"Unable to update resource publication"
            });
        }
    }
);


router.delete(
    "/resources/:id",
    authenticateUser,
    authorizeRoles("faculty", "admin"),
    async (req, res) => {
        const resourceId = Number(req.params.id);
        if (!Number.isInteger(resourceId) || resourceId <= 0) {
            return res.status(400).json({ success: false, message: "Invalid resource" });
        }

        try {
            const [rows] = await db.query(`SELECT id, uploaded_by, stored_file_name FROM resources WHERE id = ? LIMIT 1`, [resourceId]);
            if (rows.length === 0) {
                return res.status(404).json({ success: false, message: "Resource not found" });
            }

            if (req.user.role === "faculty" && Number(rows[0].uploaded_by) !== Number(req.user.userId)) {
                return res.status(403).json({ success: false, message: "You can delete only your own resources" });
            }

            await db.query(`DELETE FROM resources WHERE id = ?`, [resourceId]);

            if (rows[0].stored_file_name) {
                const filePath = path.join(uploadDirectory, path.basename(rows[0].stored_file_name));
                fs.unlink(filePath, () => {});
            }

            return res.json({ success: true, message: "Resource deleted" });
        } catch (error) {
            console.error("Delete resource error:", error);
            return res.status(500).json({ success: false, message: "Unable to delete resource" });
        }
    }
);

module.exports = router;
