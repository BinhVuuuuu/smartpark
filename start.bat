@echo off
title SmartPark SSME - He thong Xep lich Xe may Khoa hoc Dich vu
echo ======================================================================
echo   HE THONG XEP LICH DI XE MAY CHO SINH VIEN (SMARTPARK SSME)
<<<<<<< HEAD
=======
echo   Mon hoc: Co so Khoa hoc Dich vu - PGS. TS. Ha Quang Thuy
>>>>>>> 045d18bc6ec7043410636de6317e553f086a972b
echo   Truong Dai hoc Cong nghe - Dai hoc Quoc gia Ha Noi (UET - VNU)
echo ======================================================================
echo.
echo Dang khoi dong Web Server tren Node.js...
echo.
cd /d "%~dp0app"
start "" http://localhost:3000
node src/server.js
pause

