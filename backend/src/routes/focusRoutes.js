const express = require('express');
const db = require('../config/db');
const authenticateUser = require('../middleware/authMiddleware');
const { sendFocusViolationAlert } = require('../services/mailService');

const router = express.Router();

router.post('/violation-alert', authenticateUser, async (req, res) => {
  const count = Number(req.body && req.body.violationCount);
  const duration = Number(req.body && req.body.durationMinutes);

  if (String(req.user.role || '').toLowerCase() !== 'student') {
    return res.status(403).json({ success: false, message: 'Focus Mode alerts are available for student sessions only.' });
  }
  if (count !== 3 || !Number.isFinite(duration) || duration < 1 || duration > 240) {
    return res.status(400).json({ success: false, message: 'A valid third-violation Focus Mode alert is required.' });
  }

  try {
    const [users] = await db.query(
      'SELECT full_name, email FROM users WHERE id = ? AND status = \'active\' LIMIT 1',
      [req.user.userId]
    );
    if (!users.length || !users[0].email) {
      return res.status(404).json({ success: false, message: 'A valid email address was not found for this account.' });
    }

    const result = await sendFocusViolationAlert({
      email: users[0].email,
      fullName: users[0].full_name,
      violationCount: count,
      durationMinutes: duration,
      alertEmail: process.env.FOCUS_ALERT_EMAIL || ''
    });

    if (!result.delivered) {
      return res.status(503).json({ success: false, message: 'Email service is not configured.' });
    }
    return res.json({ success: true, message: 'Focus Mode violation alert email sent.' });
  } catch (error) {
    console.error('Focus Mode violation email failed:', error.message);
    return res.status(503).json({ success: false, message: 'Unable to send the Focus Mode alert email. Check SMTP configuration.' });
  }
});

module.exports = router;
