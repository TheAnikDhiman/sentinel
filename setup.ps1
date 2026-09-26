$ErrorActionPreference = "Stop"

Write-Host "\nSentinel setup" -ForegroundColor Cyan
Write-Host "--------------"

if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    throw "Python was not found. Install Python 3.11+ and reopen PowerShell."
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw "Node.js was not found. Install Node.js 20+ and reopen PowerShell."
}

Write-Host "\n[1/4] Creating Python environment..." -ForegroundColor Yellow
if (-not (Test-Path "backend\.venv")) {
    python -m venv backend\.venv
}

Write-Host "[2/4] Installing backend packages..." -ForegroundColor Yellow
& "backend\.venv\Scripts\python.exe" -m pip install --upgrade pip
& "backend\.venv\Scripts\python.exe" -m pip install -r backend\requirements.txt

if (-not (Test-Path "backend\.env")) {
    Copy-Item "backend\.env.example" "backend\.env"
    Write-Host "Created backend\.env from example." -ForegroundColor Green
}

Write-Host "[3/4] Installing frontend packages..." -ForegroundColor Yellow
Push-Location frontend
npm install
if (-not (Test-Path ".env.local")) {
    Copy-Item ".env.local.example" ".env.local"
}
Pop-Location

Write-Host "[4/4] Running backend unit tests..." -ForegroundColor Yellow
Push-Location backend
& ".\.venv\Scripts\python.exe" -m pytest -q
Pop-Location

Write-Host "\nSetup complete." -ForegroundColor Green
Write-Host "1. Add GEMINI_API_KEY and OPENROUTER_API_KEY to backend\.env"
Write-Host "2. Run .\run-backend.ps1"
Write-Host "3. In another terminal run .\run-frontend.ps1"
Write-Host "4. Open http://localhost:3000"
