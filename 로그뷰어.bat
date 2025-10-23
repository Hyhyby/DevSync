@echo off
title Discord Clone - 로그 뷰어
color 0E

:MAIN_MENU
cls
echo ========================================
echo    Discord Clone 로그 뷰어
echo ========================================
echo.
echo [1] 실시간 로그 모니터링
echo [2] 접속 로그 보기
echo [3] 오류 로그 보기
echo [4] 사용자 활동 로그 보기
echo [5] 로그 파일 정리
echo [6] 로그 통계 보기
echo [0] 종료
echo.
set /p choice="선택하세요 (0-6): "

if "%choice%"=="1" goto LIVE_MONITOR
if "%choice%"=="2" goto ACCESS_LOGS
if "%choice%"=="3" goto ERROR_LOGS
if "%choice%"=="4" goto USER_LOGS
if "%choice%"=="5" goto CLEANUP_LOGS
if "%choice%"=="6" goto LOG_STATS
if "%choice%"=="0" goto EXIT
goto MAIN_MENU

:LIVE_MONITOR
cls
echo ========================================
echo    실시간 로그 모니터링
echo ========================================
echo.
echo 실시간으로 모든 로그를 모니터링합니다...
echo Ctrl+C를 눌러 종료하세요.
echo.
cd backend
if exist logs\access.log (
    echo 📝 접속 로그:
    type logs\access.log | findstr /C:"ACCESS"
) else (
    echo 로그 파일이 없습니다.
)
echo.
if exist logs\error.log (
    echo ❌ 오류 로그:
    type logs\error.log | findstr /C:"ERROR"
) else (
    echo 오류 로그가 없습니다.
)
echo.
if exist logs\users.log (
    echo 👤 사용자 로그:
    type logs\users.log | findstr /C:"USER"
) else (
    echo 사용자 로그가 없습니다.
)
echo.
pause
goto MAIN_MENU

:ACCESS_LOGS
cls
echo ========================================
echo    접속 로그
echo ========================================
echo.
cd backend
if exist logs\access.log (
    echo 최근 20개 접속 기록:
    echo.
    powershell "Get-Content logs\access.log | Select-Object -Last 20"
) else (
    echo 접속 로그가 없습니다.
)
echo.
pause
goto MAIN_MENU

:ERROR_LOGS
cls
echo ========================================
echo    오류 로그
echo ========================================
echo.
cd backend
if exist logs\error.log (
    echo 최근 오류 기록:
    echo.
    powershell "Get-Content logs\error.log | Select-Object -Last 20"
) else (
    echo 오류 로그가 없습니다.
)
echo.
pause
goto MAIN_MENU

:USER_LOGS
cls
echo ========================================
echo    사용자 활동 로그
echo ========================================
echo.
cd backend
if exist logs\users.log (
    echo 최근 사용자 활동:
    echo.
    powershell "Get-Content logs\users.log | Select-Object -Last 20"
) else (
    echo 사용자 로그가 없습니다.
)
echo.
pause
goto MAIN_MENU

:CLEANUP_LOGS
cls
echo ========================================
echo    로그 파일 정리
echo ========================================
echo.
cd backend
if exist logs (
    echo 로그 파일 크기 확인:
    dir logs\*.log
    echo.
    echo 오래된 로그를 백업하시겠습니까? (Y/N)
    set /p cleanup="선택: "
    if /i "%cleanup%"=="Y" (
        echo 로그 파일을 백업합니다...
        for %%f in (logs\*.log) do (
            copy "%%f" "%%f.backup"
        )
        echo ✅ 로그 파일이 백업되었습니다.
    )
) else (
    echo 로그 디렉토리가 없습니다.
)
echo.
pause
goto MAIN_MENU

:LOG_STATS
cls
echo ========================================
echo    로그 통계
echo ========================================
echo.
cd backend
if exist logs (
    echo 📊 로그 파일 통계:
    echo.
    for %%f in (logs\*.log) do (
        echo 파일: %%~nxf
        echo 크기: %%~zf bytes
        echo 수정일: %%~tf
        echo.
    )
    
    echo 📈 활동 통계:
    if exist logs\access.log (
        for /f %%i in ('findstr /C:"ACCESS" logs\access.log ^| find /c /v ""') do echo 총 접속: %%i회
    )
    if exist logs\users.log (
        for /f %%i in ('findstr /C:"LOGIN_SUCCESS" logs\users.log ^| find /c /v ""') do echo 성공 로그인: %%i회
        for /f %%i in ('findstr /C:"LOGIN_FAILED" logs\users.log ^| find /c /v ""') do echo 실패 로그인: %%i회
    )
    if exist logs\error.log (
        for /f %%i in ('findstr /C:"ERROR" logs\error.log ^| find /c /v ""') do echo 총 오류: %%i개
    )
) else (
    echo 로그 파일이 없습니다.
)
echo.
pause
goto MAIN_MENU

:EXIT
cls
echo ========================================
echo    로그 뷰어 종료
echo ========================================
echo.
echo 👋 로그 뷰어를 종료합니다.
timeout /t 2 /nobreak > nul
exit
