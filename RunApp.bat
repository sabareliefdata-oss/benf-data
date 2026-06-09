@echo off
:: Set text encoding to UTF-8 for Arabic support in command prompt
chcp 65001 >nul
title نظام إدارة المستفيدين والربط الذكي

echo ==========================================================
echo       نظام إدارة المستفيدين والربط الذكي بالبطاقات
echo ==========================================================
echo.
echo جاري تشغيل سيرفر النظام المحلي...
echo يرجى إبقاء هذه النافذة مفتوحة أثناء استخدام التطبيق.
echo.
echo [معلومات] يمكنك وضع ملفات الـ PDF للبطاقات في مجلد: pdf_inputs
echo [معلومات] سيتم حفظ البطاقات المربوطة في مجلد: uploads\cards
echo.

:: Open browser after 2 seconds
start /b cmd /c "timeout /t 2 >nul && start http://localhost:5000"

:: Start the Node server
cd backend
node server.js

pause
