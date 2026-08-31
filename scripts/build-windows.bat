@echo off
echo =========================================
echo    Building Diwan for Windows (.exe)
echo =========================================

echo [1/3] Installing dependencies...
call pnpm install
if %ERRORLEVEL% NEQ 0 (
    echo Error during pnpm install
    pause
    exit /b %ERRORLEVEL%
)

echo [2/3] Building frontend...
call pnpm --filter @workspace/arabic-poetry run build
if %ERRORLEVEL% NEQ 0 (
    echo Error during frontend build
    pause
    exit /b %ERRORLEVEL%
)

echo [3/3] Building Windows .exe bundle with Tauri...
call pnpm --filter @workspace/arabic-poetry tauri build
if %ERRORLEVEL% NEQ 0 (
    echo Error during Tauri build
    pause
    exit /b %ERRORLEVEL%
)

echo =========================================
echo  Build Finished Successfully!
echo  Check: artifacts\arabic-poetry\src-tauri\target\release\bundle\nsis\
echo =========================================
pause
