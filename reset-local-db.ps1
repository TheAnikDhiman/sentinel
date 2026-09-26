$ErrorActionPreference = "Stop"
$db = Join-Path $PSScriptRoot "backend\sentinel.db"
if (Test-Path $db) {
    Remove-Item $db
    Write-Host "Deleted backend\sentinel.db. It will be recreated on next backend start." -ForegroundColor Green
} else {
    Write-Host "No local SQLite database found."
}
