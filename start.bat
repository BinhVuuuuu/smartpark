@echo off
title SmartPark SSME - He thong Xep lich Xe may Khoa hoc Dich vu
echo ======================================================================
echo   HE THONG XEP LICH DI XE MAY CHO SINH VIEN (SMARTPARK SSME)
echo   Truong Dai hoc Cong nghe - Dai hoc Quoc gia Ha Noi (UET - VNU)
echo ======================================================================
echo.
echo Dang khoi dong Web Server tren Node.js...
echo.
cd /d "%~dp0app"
start "" http://localhost:3000
node src/server.js
pause

