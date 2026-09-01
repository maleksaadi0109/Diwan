# PowerShell script to build Diwan for Windows (.exe)
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "   Building Diwan for Windows (.exe)    " -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

# 1. Check pnpm
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    Write-Host "Error: pnpm is required. Please install pnpm." -ForegroundColor Red
    Exit 1
}

# 2. Check Rust
if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
    Write-Host "Error: Rust/Cargo is required. Please install Rust from https://rustup.rs" -ForegroundColor Red
    Exit 1
}

# 3. Install dependencies
Write-Host "--> Installing dependencies..." -ForegroundColor Yellow
pnpm install

# 4. Build Frontend
Write-Host "--> Building Frontend..." -ForegroundColor Yellow
pnpm --filter @workspace/arabic-poetry run build

# 5. Fetch/verify the offline speech model + other bundled resources.
# Fails the whole build loudly if anything required is missing, instead of
# silently producing an installer that needs internet on first run.
Write-Host "--> Preparing Windows bundle (offline speech model, ffmpeg, worker exe)..." -ForegroundColor Yellow
node scripts/prepare-windows-bundle.mjs
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Windows bundle is incomplete. See messages above." -ForegroundColor Red
    Exit 1
}

# 6. Build Tauri .exe
Write-Host "--> Building Windows .exe installer with Tauri..." -ForegroundColor Green
pnpm --filter @workspace/arabic-poetry tauri build --target x86_64-pc-windows-msvc

Write-Host ""
Write-Host "=========================================" -ForegroundColor Green
Write-Host " Build Finished Successfully! " -ForegroundColor Green
Write-Host " Executable located in:" -ForegroundColor White
Write-Host " artifacts/arabic-poetry/src-tauri/target/release/bundle/nsis/" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Green
