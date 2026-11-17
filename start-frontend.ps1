# Starts the Admin React (Vite) dev server on http://localhost:5174
$node = "D:\work\tools\node-v26.5.0-win-x64"
if (Test-Path $node) { $env:Path = "$node;" + $env:Path }
Set-Location "$PSScriptRoot\admin-frontend"
npm run dev
