LEARNVAULT — HACKATHON LIVE INTELLIGENCE UPGRADE

What was added
---------------
1. Live Learning Intelligence for Student, Faculty and Admin.
2. Real-time presence heartbeat (online now + current page).
3. Live learning-event stream using Server-Sent Events (SSE).
4. Early-warning risk signals based on stored assessment performance.
5. Faculty intervention view with named at-risk learners.
6. Admin platform pulse with active users, content inventory and risk count.
7. Student live learning pulse: session time, events, quizzes, submissions and due work.
8. Live activity surface and recent event stream.
9. Feedback shortcut on every authenticated role page.
10. Live Intelligence link added to role navigation and dashboards.
11. Responsive desktop/tablet/mobile layout for the new analytics screen.
12. SMTP timeout handling with Brevo port 2525 fallback when port 587 times out.
13. backend/.env.example added. Do not commit real secrets.

Database migration
------------------
Run:
  database/hackathon_live_analytics.sql

It creates:
  user_presence
  learning_events

Deployment order
----------------
1. Run the SQL migration on the same LearnVault MySQL database.
2. Deploy the backend to Render.
3. Set Render environment variables from backend/.env.example.
4. Deploy frontend to Vercel with Root Directory = frontend.
5. Keep the Vercel /api rewrite pointing to the Render API.
6. Hard refresh the frontend with Ctrl+F5.
7. Open /student/live-analytics.html, /faculty/live-analytics.html or /admin/live-analytics.html.

Security
--------
Never paste DB passwords, JWT secrets, SMTP keys or API keys into source files.
The real backend/.env file is intentionally not included in the clean hackathon ZIP.
