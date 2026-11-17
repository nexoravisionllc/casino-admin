# Starts the Admin Node.js backend on http://localhost:5100
# Connects to the "Solution" MySQL database (see admin-backend\.env).
$node = "D:\work\tools\node-v26.5.0-win-x64"
if (Test-Path $node) { $env:Path = "$node;" + $env:Path }
Set-Location "$PSScriptRoot\admin-backend"
if (-not (Test-Path node_modules)) { npm install }
npm start
