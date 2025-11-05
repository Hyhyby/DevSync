@echo off
title Discord Clone - Electron Build
color 0E

cls
echo ========================================
echo    Discord Clone Electron 빌드
echo ========================================
echo.
echo 데스크톱 앱 설치 파일을 생성합니다...
echo.

cd /d "%~dp0"

echo [1/4] 의존성 확인 중...
if not exist "node_modules\electron" (
    echo    npm install 실행...
    call npm install
)

echo [2/4] 프론트엔드 빌드 중...
echo.
cd frontend
call npm run build
cd ..

echo [3/4] 백엔드 빌드 준비...
echo    백엔드 파일 복사 중...
echo.

echo [4/4] Electron 앱 패키징 중...
echo.
npm run dist-win

echo.
echo ========================================
echo    빌드 완료!
echo ========================================
echo.
echo 📦 설치 파일 위치: dist\Discord Clone Setup *.exe
echo.
echo 설치 파일을 실행하여 Discord Clone을 설치할 수 있습니다.
echo.

pause
