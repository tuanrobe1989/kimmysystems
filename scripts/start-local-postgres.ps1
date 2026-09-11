$ErrorActionPreference = 'Stop'
$workspace = Split-Path $PSScriptRoot -Parent
$pgBin = Join-Path $workspace '.local/postgres/pgsql/bin'
$pgData = Join-Path $workspace '.local/pgdata'
$pgLog = Join-Path $workspace '.local/postgres.log'
if (!(Test-Path (Join-Path $pgBin 'pg_ctl.exe')) -or !(Test-Path (Join-Path $pgData 'PG_VERSION'))) {
  throw 'Portable PostgreSQL is not prepared here. Follow README.md to start Docker and migrate the database.'
}
& (Join-Path $pgBin 'pg_ctl.exe') -D $pgData status
if ($LASTEXITCODE -eq 0) { exit 0 }
if (Get-NetTCPConnection -State Listen -LocalPort 5432 -ErrorAction SilentlyContinue) {
  throw 'Port 5432 is occupied by another service. Stop that service or choose a different database port.'
}
& (Join-Path $pgBin 'pg_ctl.exe') -D $pgData -l $pgLog -o '-h 127.0.0.1 -p 5432' start
if ($LASTEXITCODE -ne 0) { throw "PostgreSQL startup failed. Read $pgLog" }
