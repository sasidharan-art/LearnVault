@echo off
title LearnVault Final Dependencies
cd /d "%~dp0"

echo Installing LearnVault final dependency...
echo.

call npm install nodemailer

echo.
if errorlevel 1 (
    echo Installation failed.
    pause
    exit /b 1
)

echo Nodemailer installed successfully.
echo.
echo Next: configure SMTP values in backend\.env
pause
