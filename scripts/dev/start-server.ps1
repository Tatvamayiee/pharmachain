param([string]$envName = "development")

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Set-Location $projectRoot

# Set environment variable
$env:NODE_ENV = $envName

# Start the Node.js server
$process = Start-Process node -ArgumentList "server\index.cjs" -NoNewWindow -PassThru

Write-Host "Backend server started with PID: $($process.Id)"
Write-Host "Server running on http://localhost:41837"