@echo off
title Discord Clone - 서버 관리자
color 0A

:MAIN_MENU
cls
echo ========================================
echo    Discord Clone 서버 관리자
echo ========================================
echo.
echo [1] 모든 서버 시작
echo [2] 서버 상태 확인
echo [3] 모든 서버 종료
echo [4] 서버 재시작
echo [5] 네트워크 정보 확인
echo [6] 로그 뷰어 열기
echo [0] 종료
echo.
set /p choice="선택하세요 (0-6): "

if "%choice%"=="1" goto START_SERVERS
if "%choice%"=="2" goto CHECK_STATUS
if "%choice%"=="3" goto STOP_SERVERS
if "%choice%"=="4" goto RESTART_SERVERS
if "%choice%"=="5" goto NETWORK_INFO
if "%choice%"=="6" goto LOG_VIEWER
if "%choice%"=="0" goto EXIT
goto MAIN_MENU

:START_SERVERS
cls
echo ========================================
echo    서버 시작 중...
echo ========================================
echo.
echo [1/3] 백엔드 서버 시작 중...
start "Discord Clone Backend" cmd /k "cd backend && npm run dev"

echo [2/3] 3초 대기 중...
timeout /t 3 /nobreak > nul

echo [3/3] 프론트엔드 서버 시작 중...
start "Discord Clone Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo ✅ 서버들이 시작되었습니다!
echo.
echo 📱 접속 URL:
echo    - 프론트엔드: http://localhost:3000
echo    - 백엔드 API: http://localhost:5000
echo.
pause
goto MAIN_MENU

:CHECK_STATUS
cls
echo ========================================
echo    서버 상태 확인
echo ========================================
echo.
node check-servers.js
echo.
pause
goto MAIN_MENU

:STOP_SERVERS
cls
echo ========================================
echo    서버 종료 중...
echo ========================================
echo.
echo Node.js 프로세스를 종료합니다...
taskkill /f /im node.exe 2>nul
echo.
echo ✅ 모든 서버가 종료되었습니다.
echo.
pause
goto MAIN_MENU

:RESTART_SERVERS
cls
echo ========================================
echo    서버 재시작 중...
echo ========================================
echo.
echo [1/4] 기존 서버 종료...
taskkill /f /im node.exe 2>nul

echo [2/4] 3초 대기...
timeout /t 3 /nobreak > nul

echo [3/4] 백엔드 서버 시작...
start "Discord Clone Backend" cmd /k "cd backend && npm run dev"

echo [4/4] 프론트엔드 서버 시작...
timeout /t 2 /nobreak > nul
start "Discord Clone Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo ✅ 서버가 재시작되었습니다!
echo.
pause
goto MAIN_MENU

:NETWORK_INFO
cls
echo ========================================
echo    네트워크 정보
echo ========================================
echo.
echo 내부 IP 주소:
ipconfig | findstr "IPv4"
echo.
echo 다른 기기에서 접속하려면:
echo http://[위의IP주소]:3000
echo.
echo 예시: http://192.168.1.100:3000
echo.
pause
goto MAIN_MENU

:LOG_VIEWER
cls
echo ========================================
echo    로그 뷰어 시작
echo ========================================
echo.
echo 로그 뷰어를 시작합니다...
start "Discord Clone Log Viewer" 로그뷰어.bat
echo.
echo ✅ 로그 뷰어가 별도 창에서 실행되었습니다.
echo.
pause
goto MAIN_MENU

:EXIT
cls
echo ========================================
echo    Discord Clone 서버 관리자 종료
echo ========================================
echo.
echo 모든 서버를 종료합니다...
taskkill /f /im node.exe 2>nul
echo.
echo 👋 안녕히 가세요!
timeout /t 2 /nobreak > nul
exit
