@echo off
echo =========================================
echo    Building Diwan for Windows (.exe)
echo =========================================

echo [1/4] Installing dependencies...
call pnpm install
if %ERRORLEVEL% NEQ 0 (
    echo Error during pnpm install
    pause
    exit /b %ERRORLEVEL%
)

echo [2/4] Building frontend...
call pnpm --filter @workspace/arabic-poetry run build
if %ERRORLEVEL% NEQ 0 (
    echo Error during frontend build
    pause
    exit /b %ERRORLEVEL%
)

echo [3/4] Preparing Windows bundle (offline speech model, ffmpeg, worker exe)...
call node scripts\prepare-windows-bundle.mjs
if %ERRORLEVEL% NEQ 0 (
    echo Error: Windows bundle is incomplete. See messages above.
    pause
    exit /b %ERRORLEVEL%
)

echo [4/4] Building Windows .exe bundle with Tauri...
call pnpm --filter @workspace/arabic-poetry tauri build --target x86_64-pc-windows-msvc
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
