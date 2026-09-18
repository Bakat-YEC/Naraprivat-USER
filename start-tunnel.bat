@echo off
title NARAPRIVAT - Tunnel Cloudflare
echo ============================================
echo   NARAPRIVAT - Memulai tunnel publik...
echo   Jalankan server dulu (start-server.bat).
echo   Setelah jalan, salin URL https://xxx.trycloudflare.com
echo   yang muncul di jendela ini untuk dibagikan.
echo ============================================
cd /d "C:\Users\ASUS\9Router\tools"
cloudflared.exe tunnel --url http://127.0.0.1:5000 --protocol http2
pause
