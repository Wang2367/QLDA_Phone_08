$ErrorActionPreference='Stop'
$projectRoot=Split-Path -Parent $PSScriptRoot
Push-Location -LiteralPath $projectRoot
try {
 if(!(Test-Path -LiteralPath 'node_modules/express')) {
   & npm.cmd ci --no-audit --no-fund
   if($LASTEXITCODE -ne 0) { throw 'Cài thư viện chưa thành công.' }
 }
 & npm.cmd run db:setup
 if($LASTEXITCODE -ne 0) { throw 'Kiểm tra DB_SERVER và Windows Authentication.' }
 if(!(Test-Path -LiteralPath 'dist/index.html')) {
   & npm.cmd run build
   if($LASTEXITCODE -ne 0) { throw 'Build chưa thành công.' }
 }
 & node server/index.js
} finally { Pop-Location }

