$ErrorActionPreference = "Stop"
Set-Location "$PSScriptRoot\frontend"

if (-not (Test-Path "node_modules")) {
    throw "frontend\node_modules does not exist. Run .\setup.ps1 first."
}

npm run dev
