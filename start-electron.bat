@echo off
title Discord Clone - Electron App
color 0B

cls
echo ========================================
echo    Discord Clone Electron App
echo ========================================
echo.
echo Electron 데스크톱 앱을 시작합니다...
echo.

cd /d "%~dp0"

echo [1/2] 의존성 설치 확인 중...
if not exist "node_modules\electron" (
    echo.
    echo ⚠️  Electron이 설치되지 않았습니다.
    echo    npm install을 실행합니다...
    echo.
    call npm install
    echo.
)

echo [2/2] Electron 앱 시작 중...
echo.
echo 💡 개발 모드에서는 백엔드와 프론트엔드 서버가 자동으로 시작됩니다.
echo.
echo ⏳ 잠시만 기다려주세요...
echo.

npm run electron-dev

pause
