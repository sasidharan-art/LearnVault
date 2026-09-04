# LearnVault DBMS Viva Guide

## What is LearnVault?

LearnVault is a role-based educational database system that manages academic structure, users, Faculty teaching access, learning resources, Question Bank content, quizzes, assignments, skills, peer learning and Student progress.

## Why MySQL?

The project contains strongly related structured data:

- User has a Role.
- Student belongs to a Course and Level.
- Subject belongs to a Course.
- Faculty is assigned to Subjects.
- Resources belong to Subjects.
- Quiz contains Questions.
- Assignment has Student Submissions.

A relational database is suitable because primary keys, foreign keys and joins can enforce these relationships.

## Primary Key

A primary key uniquely identifies a row.

Examples:

- users.id
- subjects.id
- quizzes.id
- assignments.id

## Foreign Key

A foreign key connects related tables and enforces referential integrity.

Examples:

- student_profiles.user_id → users.id
- subjects.course_id → courses.id
- resources.subject_id → subjects.id
- assignment_submissions.assignment_id → assignments.id

## One-to-Many Example

One Subject can have many Resources.

subjects.id
→ resources.subject_id

## Many-to-Many Example

A Quiz can contain many Questions and a Question can be reused in many Quizzes.

This is handled using the junction table:

quiz_questions

It stores:

- quiz_id
- question_id
- question_order

## Another Many-to-Many Example

Faculty and Subjects can have multiple assignments.

This is represented by:

faculty_subject_assignments

## Why Separate student_profiles and faculty_profiles?

The users table contains common account data.

Role-specific information is separated to avoid many irrelevant NULL fields and to keep the schema normalized.

## Normalization

The design separates entities such as:

- Roles
- Users
- Courses
- Subjects
- Resource Types
- Questions
- Quizzes

This reduces repeated data and update anomalies.

## JOIN Example

To find the Student's Course:

users
JOIN student_profiles
JOIN courses

To find a Resource with Subject information:

resources
JOIN subjects
JOIN courses

## Transaction Example

Quiz creation inserts:

1. Quiz record.
2. Quiz-question mappings.

A database transaction ensures all operations succeed together or roll back together.

Assignment grading and password reset also benefit from controlled multi-step database operations.

## Index

Indexes speed up frequently searched columns.

Examples in LearnVault include:

- User email / username
- Assignment-submission Student
- OTP user / expiry
- Subject / status filters

## View vs Table

A table physically stores rows.

A view is a saved SQL query that presents data from one or more tables.

LearnVault currently performs report queries through backend SQL; database views could be added for reusable reporting.

## ACID

Atomicity:
A transaction either completes fully or rolls back.

Consistency:
Foreign keys and validation preserve valid data.

Isolation:
Concurrent database operations are separated by the DBMS transaction rules.

Durability:
Committed data remains stored.

## Authentication vs Authorization

Authentication:
Who is the user?

Authorization:
What is the user allowed to do?

LearnVault authenticates using JWT and authorizes by role plus academic access.

## Why HttpOnly Cookie?

JavaScript cannot directly read the authentication token, reducing exposure to token theft through ordinary client-side scripts.

## Why bcrypt?

Passwords should not be stored as plain text.

bcrypt stores a one-way password hash.

## What is the purpose of password_reset_otps?

It stores temporary reset verification information:

- User
- Hashed OTP
- Expiry
- Attempts
- Verification time
- Used time

The OTP itself is not stored as plain text.

## Weak Area Analysis

Quiz attempts and question accuracy are aggregated by Subject / Unit to help identify areas with lower performance.

## LearnVault Role Design

Admin:
Governance and oversight.

Faculty:
Learning-content owner for assigned Subjects.

Student:
Learner with Course / Level restricted access.

This removes unnecessary Admin approval bottlenecks while retaining centralized platform control.
