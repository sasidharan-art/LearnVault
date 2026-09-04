# LearnVault Final Project Architecture

## 1. Purpose

LearnVault is a role-based learning-management and academic-resource platform built with:

- HTML5
- CSS3
- Vanilla JavaScript
- Node.js
- Express.js
- MySQL

The system supports different education domains rather than being restricted to one course type.

## 2. Role Model

### Admin

Admin governs the platform:

- Academic domains
- Departments / streams
- Courses / programs
- Levels / years
- Subjects
- Student and Faculty accounts
- Faculty-to-subject assignment
- Full content oversight
- Reports
- Database health
- Moderation

Admin does not need to approve every normal Faculty learning action.

### Faculty

Faculty owns learning delivery inside subjects assigned by Admin:

- Resources
- Videos / external learning links
- Units / modules
- Question Bank
- Quizzes
- Assignments
- Skills
- Peer Groups
- Student submission grading
- Learning analytics

### Student

Students receive learning content filtered by:

Course / Program
→ Current Level / Year
→ Subject

Student workflow:

Resources
→ Question Practice
→ Quiz
→ Assignment
→ Result / Feedback
→ Progress
→ Weak Areas
→ Skills
→ Peer Learning
→ Practice Again

## 3. Core Database Areas

### Identity and Roles

- roles
- users
- student_profiles
- faculty_profiles
- password_reset_otps

### Academic Structure

- education_domains
- departments
- courses
- course_levels
- subjects
- faculty_subject_assignments

### Learning Content

- resource_types
- resources
- subject_units
- question_bank
- question_options

### Assessment

- quizzes
- quiz_questions
- quiz_attempts
- quiz_attempt_answers
- assignments
- assignment_submissions

### Learning Development

- skills
- student_skill_progress

### Peer Learning

- peer_groups
- peer_group_members
- peer_posts
- peer_comments

## 4. Authentication

Login accepts:

- Email
- Username
- Numeric User ID

Passwords use bcrypt.

Authentication uses a JWT stored in an HttpOnly cookie.

Password recovery uses:

Email
→ 6-digit OTP
→ OTP verification
→ short-lived reset token
→ new bcrypt password

## 5. Security Model

- HttpOnly authentication cookie
- JWT role claims
- Protected Express middleware
- Role authorization middleware
- Faculty subject access checked on server
- Student Course / Level filters checked on server
- Admin oversight APIs protected by Admin role
- Password-reset OTP expires after 10 minutes
- Maximum five incorrect OTP attempts
- One-minute OTP resend cooldown
- Reset token expires after 10 minutes
- Generic Forgot Password response avoids exposing registered emails

## 6. Search and Reports

Global Search respects role access.

Admin Reports include:

- User counts
- Published-content counts
- Quiz performance
- Assignment submission workload
- Course learning report
- Faculty contribution report
- CSV export
- Required-table system check
