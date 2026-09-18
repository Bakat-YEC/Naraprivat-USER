@echo off
chcp 65001 >nul
title Push NARAPRIVAT ke GitHub
echo ==========================================================
echo              PUSH NARAPRIVAT KE GITHUB
echo ==========================================================
echo.
echo Sebelum lanjut, pastikan kamu sudah:
echo   1. Membuat repo naraprivat di github.com (Public)
echo   2. Di repo itu: Settings ^> Pages ^> Source = GitHub Actions
echo   3. Membuat token (ghp_...) dari Settings ^> Developer settings
echo.
echo ----------------------------------------------------------
set /p USERNAME=Username GitHub kamu: 
echo ----------------------------------------------------------
set /p REPO=Nama repo (enter = naraprivat): 
if "%REPO%"=="" set REPO=naraprivat
echo.
echo Konek ke github.com/%USERNAME%/%REPO% ...
git remote remove origin 2>nul
git remote add origin https://github.com/%USERNAME%/%REPO%.git
git branch -M main
echo.
echo Sedang push... 
echo KALAU DIMINTA LOGIN, ISIKAN:
echo   Username : %USERNAME%
echo   Password : TOKEN kamu (ghp_...), BUKAN password GitHub.
echo.
git push -u origin main
echo.
if %errorlevel%==0 (
    echo ==========================================================
    echo SELESAI. Buka di browser:
    echo   https://%USERNAME%.github.io/%REPO%/
    echo   (tunggu tab Actions hijau dulu, kurang lebih 4 menit)
    echo ==========================================================
) else (
    echo.
    echo PUSH GAGAL. Foto/salin pesan error di atas, kirim ke asisten.
    echo Kemungkinan: token salah, repo belum dibuat, atau repo sudah
    echo berisi file (padahal harus kosong).
)
echo.
pause