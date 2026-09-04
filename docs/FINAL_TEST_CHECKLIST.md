# LearnVault Final End-to-End Test Checklist

Use one Admin, one Faculty and one Student test account.

## A. Backend

1. Start MySQL.
2. Start backend with `npm run dev`.
3. Open `/api/health`.
4. Open `/api/db-test`.
5. Admin Reports must show all required tables available.

## B. Authentication

### Student Registration

- Open Create Account.
- Active Courses load from MySQL.
- Levels change with selected Course.
- Semester is not requested.
- Submit Student registration.
- Generated Username and numeric User ID appear.

### Login

Test Student login with:

- Email
- Username
- Numeric User ID

Test Faculty login.
Test Admin login.
Test Logout.

### Forgot Password

- Request OTP for an active account.
- Verify wrong OTP is rejected.
- Verify correct OTP.
- Enter mismatched new passwords and confirm rejection.
- Reset with matching password.
- Old password must fail.
- New password must work.

## C. Admin

### Academic Structure

- Domain
- Department / Stream
- Course / Program
- Level / Year
- Subject
- Active / inactive controls

### Users & Faculty

- Create Faculty.
- Activate / deactivate user.
- Assign Faculty to Subject.
- Remove Faculty Subject assignment.

### Oversight

Verify Admin can see:

- Resources
- Question Bank
- Quizzes
- Assignments
- Skills
- Peer Groups

Test hide / restore where available.

### Reports

- Course Report loads.
- Faculty Contribution Report loads.
- Course CSV downloads.
- Faculty CSV downloads.
- System Check reports all required tables.

## D. Faculty

Faculty must see only Admin-assigned Subjects.

### Resources

- Upload a file.
- Publish immediately.
- Edit.
- Unpublish.
- Republish.
- Delete test resource.

### Question Bank

- Create Unit / Module.
- Create MCQ.
- Create True / False.
- Create Short Answer.
- Publish / unpublish own question.

### Quizzes

- Build from existing question.
- Add question inside Quiz Builder.
- Publish Quiz.
- Student sees Quiz.
- Unpublish Quiz.

### Assignments

- Create Assignment.
- Publish.
- Student submits.
- Open Student submission.
- Grade with marks and feedback.

### Skills

- Create Skill for assigned Subject.
- Student sees it.
- Student updates progress.
- Faculty aggregate progress changes.

### Peer Groups

- Create group.
- Student joins.
- Faculty posts.
- Student replies.
- Open / close group.

### Analytics

- Faculty Progress page shows only assigned-subject learning activity.

## E. Student

### Resources

- Only matching Course / Level resources appear.
- Video view works.
- File / link opening works.

### Question Bank

- Only approved/published relevant questions appear.
- Unit filter works.

### Quiz

- Attempt published Quiz.
- Submit.
- Score appears.
- Answer review works.
- Attempt limit works.

### Assignment

- Relevant Assignment appears.
- Submit text/link/file.
- Marks and Faculty feedback appear after grading.

### Progress

- Quiz attempt appears.
- Subject mastery updates.
- Weak areas appear only after activity.

### Skills

- Relevant Skill appears.
- Save 0–100% progress.

### Peer Groups

- Relevant group appears.
- Join.
- Post.
- Reply.
- Leave.

### Search

Search:

- Resource
- Question
- Quiz
- Assignment
- Skill
- Peer Group

No unrelated-course content should appear.

### Activity Center

Check recent:

- Resources
- Quizzes
- Assignments
- Grades
- Peer discussions

### Profile

- Full Name update.
- Phone update.
- ID / Username / Email remain read-only.
- Change password using current password.

## F. Responsive UI

Test:

- 1366px desktop
- 1024px
- 760px
- mobile width

Verify:

- No horizontal overflow.
- Sidebar is hidden on mobile until menu click.
- Sidebar toggle works.
- Header remains aligned.
- Footer remains full width.
- Forms stay inside cards.
- Tables scroll inside their container.
