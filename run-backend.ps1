$ErrorActionPreference = "Stop"
Set-Location "$PSScriptRoot\backend"

if (-not (Test-Path ".venv")) {
    throw "backend\.venv does not exist. Run .\setup.ps1 first."
}

& ".\.venv\Scripts\python.exe" -m uvicorn app.main:app --reload --port 8000
