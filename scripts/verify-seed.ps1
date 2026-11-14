$ErrorActionPreference = 'Stop'
$verificationDatabase = 'product_management_seed_check_' + [Guid]::NewGuid().ToString('N').Substring(0, 8)
if ($verificationDatabase -notmatch '^product_management_seed_check_[a-f0-9]{8}$') { throw 'Invalid isolated verification database name.' }
$verificationUser = 'product_management'
$environmentPath = Join-Path (Split-Path -Parent $PSScriptRoot) '.env'
if (Test-Path -LiteralPath $environmentPath) {
    foreach ($line in Get-Content -LiteralPath $environmentPath) {
        if ($line -match '^POSTGRES_USER=(.*)$') { $verificationUser = $matches[1] }
    }
}

docker compose exec -T postgres psql -U $verificationUser -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE $verificationDatabase;"
if ($LASTEXITCODE -ne 0) { throw 'Could not create the isolated seed verification database.' }
try {
    for ($attempt = 1; $attempt -le 2; $attempt++) {
        docker compose run --rm --no-deps -e "DATABASE_URL=jdbc:postgresql://postgres:5432/$verificationDatabase" backend --spring.profiles.active=seed
        if ($LASTEXITCODE -ne 0) { throw "Seed verification run $attempt failed." }
    }
    $seedCount = docker compose exec -T postgres psql -U $verificationUser -d $verificationDatabase -t -A -c 'SELECT COUNT(*) FROM products;'
    if ($LASTEXITCODE -ne 0 -or "$seedCount".Trim() -ne '10000') { throw 'Expected exactly 10000 products after two seed runs.' }
    [PSCustomObject]@{Result='Passed';Products=10000;Runs=2;IsolatedDatabase=$verificationDatabase}
} finally {
    # Remove only the uniquely named database created by this invocation.
    docker compose exec -T postgres psql -U $verificationUser -d postgres -v ON_ERROR_STOP=1 -c "DROP DATABASE $verificationDatabase;"
    if ($LASTEXITCODE -ne 0) { Write-Warning "Could not remove isolated verification database $verificationDatabase." }
}
