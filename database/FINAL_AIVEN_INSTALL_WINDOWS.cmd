@echo off
setlocal
cd /d "%~dp0.."

echo ============================================================
echo LearnVault - Final Aiven Database Installer
echo ============================================================
echo.
echo This script targets the existing Aiven MySQL database: defaultdb
echo It does NOT create a new Aiven service.
echo.
echo IMPORTANT: the project package contains feature migrations, but the
echo original core LearnVault schema (users/roles/courses/subjects/etc.)
echo is not present in this package. Therefore this installer will STOP
echo if the core schema is missing instead of corrupting the database.
echo.
set /p DB_HOST=Enter Aiven host [mysql-20d61a66-sasidharan.j.aivencloud.com]: 
if "%DB_HOST%"=="" set DB_HOST=mysql-20d61a66-sasidharan.j.aivencloud.com
set /p DB_PORT=Enter Aiven port [15288]: 
if "%DB_PORT%"=="" set DB_PORT=15288

echo.
echo Checking core tables...
mysql --host=%DB_HOST% --port=%DB_PORT% --user=avnadmin --password --ssl-mode=REQUIRED defaultdb -e "SELECT table_name FROM information_schema.tables WHERE table_schema='defaultdb' AND table_name IN ('users','roles','courses','subjects','course_levels','student_profiles') ORDER BY table_name;"
if errorlevel 1 goto :fail

echo.
echo If the query above showed all six core tables, continue with the feature migrations.
echo Run these commands from the LearnVault project root:
echo.
echo mysql --host=%DB_HOST% --port=%DB_PORT% --user=avnadmin --password --ssl-mode=REQUIRED defaultdb ^< database\academic_registration_update.sql
echo mysql --host=%DB_HOST% --port=%DB_PORT% --user=avnadmin --password --ssl-mode=REQUIRED defaultdb ^< database\hackathon_education_live_classes.sql
echo mysql --host=%DB_HOST% --port=%DB_PORT% --user=avnadmin --password --ssl-mode=REQUIRED defaultdb ^< database\hackathon_native_live_classroom.sql
echo mysql --host=%DB_HOST% --port=%DB_PORT% --user=avnadmin --password --ssl-mode=REQUIRED defaultdb ^< database\hackathon_native_webrtc.sql
echo mysql --host=%DB_HOST% --port=%DB_PORT% --user=avnadmin --password --ssl-mode=REQUIRED defaultdb ^< database\hackathon_live_classroom_complete_upgrade.sql
echo mysql --host=%DB_HOST% --port=%DB_PORT% --user=avnadmin --password --ssl-mode=REQUIRED defaultdb ^< database\hackathon_live_streaming_security_performance.sql
echo mysql --host=%DB_HOST% --port=%DB_PORT% --user=avnadmin --password --ssl-mode=REQUIRED defaultdb ^< database\PRODUCTION_LIVE_INTELLIGENCE_PATCH.sql
 echo.
echo Installer prepared. Review each command before execution.
goto :end
:fail
echo.
echo Could not connect to Aiven. Check host, port, username, and password.
:end
endlocal
