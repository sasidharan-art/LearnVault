# LearnVault Final API Reference

## Authentication

- POST `/api/auth/register`
- POST `/api/auth/login`
- GET `/api/auth/me`
- POST `/api/auth/logout`
- POST `/api/auth/forgot-password`
- POST `/api/auth/verify-reset-otp`
- POST `/api/auth/reset-password`

## Academic

- GET `/api/academic/registration-options`
- Admin academic structure endpoints under `/api/academic/...`

## Resources

- `/api/content/...`
- `/api/resources/...`

## Faculty

- `/api/faculty/...`

## Student

- `/api/student/...`

## Question Bank

- `/api/question-bank/...`

## Quizzes

- `/api/quizzes/...`

## Assignments

- `/api/assignments/...`

## Progress

- `/api/progress/...`

## Skills

- `/api/skills/...`

## Peer Learning

- `/api/peer/...`

## Search / Profile / Reports

- GET `/api/integration/search`
- GET `/api/integration/activity`
- GET `/api/integration/profile`
- PATCH `/api/integration/profile`
- PATCH `/api/integration/profile/password`
- GET `/api/integration/admin/reports`
- GET `/api/integration/admin/reports.csv`
- GET `/api/integration/admin/system-check`

## Utility

- GET `/api/health`
- GET `/api/db-test`
