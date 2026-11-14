param([string]$MavenCommand = '')

$ErrorActionPreference = 'Stop'
$projectPath = Split-Path -Parent $PSScriptRoot
$backendPath = Join-Path $projectPath 'backend'
$verificationDatabase = 'product_management_coverage_' + [Guid]::NewGuid().ToString('N').Substring(0, 12)
if ($verificationDatabase -notmatch '^product_management_coverage_[a-f0-9]{12}$') { throw 'Invalid verification database name.' }
$verificationUser = 'product_management'
$verificationPassword = ''
$verificationPort = '5433'
foreach ($line in Get-Content -LiteralPath (Join-Path $projectPath '.env')) {
    if ($line -match '^POSTGRES_USER=(.*)$') { $verificationUser = $matches[1] }
    if ($line -match '^POSTGRES_PASSWORD=(.*)$') { $verificationPassword = $matches[1] }
    if ($line -match '^POSTGRES_PORT=(.*)$') { $verificationPort = $matches[1] }
}
if (-not $MavenCommand) { $MavenCommand = Join-Path $backendPath 'mvnw.cmd' }
$previousUrl = $env:PRODUCT_MANAGEMENT_TEST_DATABASE_URL
$previousUser = $env:PRODUCT_MANAGEMENT_TEST_DATABASE_USER
$previousPassword = $env:PRODUCT_MANAGEMENT_TEST_DATABASE_PASSWORD
Push-Location $projectPath
try {
    docker compose exec -T postgres psql -U $verificationUser -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE $verificationDatabase;"
    if ($LASTEXITCODE -ne 0) { throw 'Could not create the dedicated coverage database.' }
    try {
        $env:PRODUCT_MANAGEMENT_TEST_DATABASE_URL = "jdbc:postgresql://localhost:$verificationPort/$verificationDatabase"
        $env:PRODUCT_MANAGEMENT_TEST_DATABASE_USER = $verificationUser
        $env:PRODUCT_MANAGEMENT_TEST_DATABASE_PASSWORD = $verificationPassword
        Push-Location $backendPath
        try {
            # Java writes benign VM warnings to stderr; use its exit code for success.
            $ErrorActionPreference = 'Continue'
            try {
                & $MavenCommand "-Dmaven.repo.local=$(Join-Path (Split-Path -Parent $projectPath) '.maven/repository')" verify 2>&1 | ForEach-Object { "$_" }
                $verificationExitCode = $LASTEXITCODE
            } finally { $ErrorActionPreference = 'Stop' }
            if ($verificationExitCode -ne 0) { throw 'Backend coverage verification failed.' }
        } finally { Pop-Location }
    } finally {
        # Drop only the fresh, uniquely named database created by this invocation.
        docker compose exec -T postgres psql -U $verificationUser -d postgres -v ON_ERROR_STOP=1 -c "DROP DATABASE $verificationDatabase;"
        if ($LASTEXITCODE -ne 0) { Write-Warning "Could not remove coverage database $verificationDatabase." }
    }
} finally {
    $env:PRODUCT_MANAGEMENT_TEST_DATABASE_URL = $previousUrl
    $env:PRODUCT_MANAGEMENT_TEST_DATABASE_USER = $previousUser
    $env:PRODUCT_MANAGEMENT_TEST_DATABASE_PASSWORD = $previousPassword
    Pop-Location
}
