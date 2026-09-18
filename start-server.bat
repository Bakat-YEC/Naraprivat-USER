@echo off
title NARAPRIVAT - Server
echo ============================================
echo   NARAPRIVAT - Memulai server...
echo   Web lokal : http://localhost:5000
echo ============================================
cd /d "C:\Users\ASUS\9Router\server"
set NODE_ENV=production
set JWT_SECRET=ceedf03d06cb13cb5e6e5c5e1a702b79d430e5b0a9a8191546689d0d4e8b340b
node index.js
pause
