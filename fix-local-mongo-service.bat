@echo off
:: Self-elevate script if not running as Administrator
NET SESSION >nul 2>&1
if %errorLevel% neq 0 (
    echo Requesting Administrator privileges to fix MongoDB Service...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

echo ========================================================
echo Fixing Local MongoDB Service & FTDC Corruption (Admin Mode)
echo ========================================================

echo 1. Stopping MongoDB service...
net stop MongoDB >nul 2>&1

echo 2. Cleaning corrupted FTDC diagnostic interim temp files...
if exist "C:\Program Files\MongoDB\Server\8.2\data\diagnostic.data\metrics.interim.temp" (
    del /f /q "C:\Program Files\MongoDB\Server\8.2\data\diagnostic.data\metrics.interim.temp"
    echo    - Removed metrics.interim.temp
)
if exist "C:\Program Files\MongoDB\Server\8.2\data\diagnostic.data\metrics.interim" (
    del /f /q "C:\Program Files\MongoDB\Server\8.2\data\diagnostic.data\metrics.interim"
    echo    - Removed metrics.interim
)

echo 3. Resetting stale lock file...
type nul > "C:\Program Files\MongoDB\Server\8.2\data\mongod.lock"
echo    - Lock file reset.

echo 4. Starting MongoDB service...
net start MongoDB

echo 5. Verifying service status...
sc query MongoDB

echo ========================================================
echo Local MongoDB Service successfully started!
echo You can now run 'npm run dev' or 'node test-local-mongo.mjs'
echo ========================================================
pause
