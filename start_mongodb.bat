@echo off
echo ===================================================
echo Starting and Repairing Local MongoDB Service...
echo ===================================================

net stop MongoDB >nul 2>&1

if exist "C:\Program Files\MongoDB\Server\8.2\data\mongod.lock" (
    echo Removing stale mongod.lock...
    del /f /q "C:\Program Files\MongoDB\Server\8.2\data\mongod.lock"
)

if exist "C:\Program Files\MongoDB\Server\8.2\data\diagnostic.data\metrics.interim*" (
    echo Cleaning up temporary diagnostic files...
    del /f /q "C:\Program Files\MongoDB\Server\8.2\data\diagnostic.data\metrics.interim*"
)

echo Starting MongoDB service...
net start MongoDB

if %ERRORLEVEL% equ 0 (
    echo.
    echo ===================================================
    echo SUCCESS: MongoDB is now running on 127.0.0.1:27017!
    echo ===================================================
) else (
    echo.
    echo Failed to start service with standard privileges.
    echo Please right-click this file and select 'Run as administrator'.
)

pause
