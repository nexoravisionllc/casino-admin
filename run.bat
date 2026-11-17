@echo off
rem Starts the Admin backend (http://localhost:5100), waits until it is up,
rem then starts the frontend (http://localhost:5174) and opens the browser.
rem Each server runs in its own window; close a window to stop that server.
setlocal
cd /d "%~dp0"

set "BACKEND_PORT=5100"
set "FRONTEND_PORT=5174"
set "WAIT_SECONDS=60"

rem Prefer the bundled Node.js when present, otherwise use the one on PATH.
set "NODE_DIR=D:\work\tools\node-v26.5.0-win-x64"
if exist "%NODE_DIR%\node.exe" set "PATH=%NODE_DIR%;%PATH%"
where node >nul 2>nul || (
  echo [ERROR] Node.js was not found. Install Node.js 20.12 or newer.
  pause
  exit /b 1
)

rem The backend needs MySQL; warn (but continue) if the service is not running.
sc query MySQL84 2>nul | findstr /c:"RUNNING" >nul || (
  echo [WARN] The MySQL84 service is not running. Start it with: net start MySQL84
)

rem Install packages on first run.
if not exist "admin-backend\node_modules" (
  echo Installing backend packages...
  pushd admin-backend & call npm install & popd
)
if not exist "admin-frontend\node_modules" (
  echo Installing frontend packages...
  pushd admin-frontend & call npm install & popd
)

rem ---- 1. Backend ----
call :listening %BACKEND_PORT% && (
  echo Backend is already running on port %BACKEND_PORT%.
) || (
  echo Starting backend...
  start "Admin Backend" /d "%~dp0admin-backend" cmd /k npm start
  call :wait %BACKEND_PORT% || (
    echo [ERROR] Backend did not start within %WAIT_SECONDS%s. Check the "Admin Backend" window.
    pause
    exit /b 1
  )
)
echo Backend is up: http://localhost:%BACKEND_PORT%

rem ---- 2. Frontend ----
call :listening %FRONTEND_PORT% && (
  echo Frontend is already running on port %FRONTEND_PORT%.
) || (
  echo Starting frontend...
  start "Admin Frontend" /d "%~dp0admin-frontend" cmd /k npm run dev
  call :wait %FRONTEND_PORT% || (
    echo [ERROR] Frontend did not start within %WAIT_SECONDS%s. Check the "Admin Frontend" window.
    pause
    exit /b 1
  )
)
echo Frontend is up: http://localhost:%FRONTEND_PORT%

start "" "http://localhost:%FRONTEND_PORT%"
exit /b 0

rem ---- helpers ----

rem :listening PORT  -> errorlevel 0 if something listens on PORT
:listening
netstat -ano -p TCP | findstr /r /c:":%1 .*LISTENING" >nul 2>nul && exit /b 0
netstat -ano -p TCPv6 | findstr /r /c:":%1 .*LISTENING" >nul 2>nul
exit /b %errorlevel%

rem :wait PORT  -> waits up to WAIT_SECONDS for PORT to listen
:wait
for /l %%i in (1,1,%WAIT_SECONDS%) do (
  call :listening %1 && exit /b 0
  rem ~1 second pause (works even without an interactive console, unlike timeout)
  ping -n 2 127.0.0.1 >nul
)
exit /b 1
