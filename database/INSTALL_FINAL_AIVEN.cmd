@echo off
setlocal
cd /d "%~dp0\.."
echo ==========================================
echo LearnVault FINAL Hackathon DB Installer
echo Target database: defaultdb
echo ==========================================
echo.
echo The MySQL client will request your Aiven password.
echo Do NOT put the password in this script.
echo.

set "MYSQL=mysql --host=mysql-20d61a66-sasidharan.j.aivencloud.com --port=15288 --user=avnadmin --password --ssl-mode=REQUIRED defaultdb"

echo [1/15] Core schema...
%MYSQL% < database\00_CORE_SCHEMA.sql || goto :error

echo [2/15] Academic registration...
%MYSQL% < database\academic_registration_update.sql || goto :error

echo [3/15] Base Live Classroom...
%MYSQL% < database\02_BASE_LIVE_CLASSES.sql || goto :error

echo [4/15] Faculty subject assignments...
%MYSQL% < database\faculty_resource_phase.sql || goto :error

echo [5/15] Education challenges...
%MYSQL% < database\hackathon_education_live_classes.sql || goto :error

echo [6/15] Assignments...
%MYSQL% < database\assignments_phase_v2_no_fk_names.sql || goto :error

echo [7/15] Question bank...
%MYSQL% < database\question_bank_phase.sql || goto :error

echo [8/15] Quizzes...
%MYSQL% < database\quiz_phase.sql || goto :error

echo [9/15] Skills and peer learning...
%MYSQL% < database\skills_peer_learning_phase.sql || goto :error

echo [10/15] Academic catalog...
%MYSQL% < database\hackathon_academic_catalog_initialization.sql || goto :error

echo [11/15] Academic intelligence and attendance...
%MYSQL% < database\hackathon_academic_intelligence.sql || goto :error

echo [12/15] Academic progression and notifications...
%MYSQL% < database\academic_progression_notifications.sql || goto :error

echo [13/15] Live intelligence and native classroom...
%MYSQL% < database\PRODUCTION_LIVE_INTELLIGENCE_PATCH.sql || goto :error

echo [14/15] Live analytics...
%MYSQL% < database\hackathon_live_analytics.sql || goto :error

echo [15/15] Career / impact features...
%MYSQL% < database\hackathon_nextgen_ai_career_impact.sql || goto :error

echo.
echo ==========================================
echo DATABASE INSTALLATION COMPLETED
echo ==========================================
echo.
echo Demo login password for seeded accounts: password
echo Change demo credentials before real use.
echo.
%MYSQL% -e "SHOW TABLES;"
exit /b 0

:error
echo.
echo ==========================================
echo DATABASE INSTALLATION STOPPED
echo ==========================================
echo Check the error above before continuing.
exit /b 1
