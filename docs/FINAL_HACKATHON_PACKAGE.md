# LearnVault — Final Hackathon Package

This package is based on the latest LearnVault live-classroom/risk-monitor build.

## Included
- Native faculty Live Classroom: schedule, start/end, camera, microphone, screen sharing, participants, attendance, chat, Q&A, polls/quizzes, materials and moderation.
- Student live classroom/watch-live experience.
- Admin live-class oversight and notifications.
- Live analytics and learning-event instrumentation.
- Academic Intelligence / Early Risk Monitor with live-participation signals.
- Responsive student, faculty and admin interfaces.
- MySQL/Aiven migration files normalized for the existing `defaultdb` database.

## Existing deployment
- Frontend: Vercel
- Backend: Render
- Database: existing Aiven MySQL service

## Database warning
The current project package contains the feature migrations but does not contain the original core LearnVault schema that creates `users`, `roles`, `courses`, `subjects`, `course_levels`, and `student_profiles`. Do not run the feature migrations against an empty database. Restore/import the original core schema first, then use the migration sequence in `database/FINAL_AIVEN_INSTALL_WINDOWS.cmd`.
