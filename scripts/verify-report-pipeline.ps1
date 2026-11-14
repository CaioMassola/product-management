param([string]$ApiBaseUrl = 'http://localhost:8080/api')

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$ApiBaseUrl = $ApiBaseUrl.TrimEnd('/')
$verificationCode = 'VERIFY-' + [Guid]::NewGuid().ToString('N').Substring(0, 10).ToUpperInvariant()
$projectRoot = Split-Path -Parent $PSScriptRoot
$outputDirectory = Join-Path $projectRoot 'backend/target/report-verification'
New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null

function Request-Json([string]$Method, [string]$Path, [object]$Body) {
    $requestArguments = @{Method=$Method; Uri=($ApiBaseUrl + $Path); ContentType='application/json'}
    if ($null -ne $Body) { $requestArguments.Body = $Body | ConvertTo-Json -Compress }
    Invoke-RestMethod @requestArguments
}

function Wait-Report([string]$Id) {
    $deadline = [DateTime]::UtcNow.AddSeconds(45)
    do {
        $report = Request-Json 'GET' "/reports/$Id" $null
        if ($report.status -eq 'COMPLETED') { return $report }
        if ($report.status -eq 'FAILED') { throw "Report $Id failed: $($report.errorMessage)" }
        Start-Sleep -Milliseconds 500
    } while ([DateTime]::UtcNow -lt $deadline)
    throw "Report $Id did not complete before the verification deadline."
}

function Read-WorkbookCodes([string]$Id) {
    $filePath = Join-Path $outputDirectory ($Id + '.xlsx')
    Invoke-WebRequest -UseBasicParsing -Uri "$ApiBaseUrl/reports/$Id/download" -OutFile $filePath
    $archive = [System.IO.Compression.ZipFile]::OpenRead($filePath)
    try {
        $entry = $archive.GetEntry('xl/worksheets/sheet1.xml')
        if ($null -eq $entry) { throw 'Downloaded file is not a readable XLSX workbook.' }
        $reader = New-Object System.IO.StreamReader($entry.Open())
        try { [xml]$sheet = $reader.ReadToEnd() } finally { $reader.Dispose() }
        $namespace = New-Object System.Xml.XmlNamespaceManager($sheet.NameTable)
        $namespace.AddNamespace('x', 'http://schemas.openxmlformats.org/spreadsheetml/2006/main')
        @($sheet.SelectNodes('//x:sheetData/x:row[position() > 1]/x:c[starts-with(@r,"B")]/x:is/x:t', $namespace) | ForEach-Object { $_.InnerText })
    } finally { $archive.Dispose() }
}

$active = Request-Json 'POST' '/products' @{code=($verificationCode + '-A'); title='Verification Active Game'; productType='GAMES'; price=150; quantity=2}
$inactive = Request-Json 'POST' '/products' @{code=($verificationCode + '-I'); title='Verification Inactive Game'; productType='GAMES'; price=250; quantity=0}
$null = Request-Json 'PATCH' "/products/$($inactive.id)/status" @{status='INACTIVE'}

$filtered = Request-Json 'POST' '/reports' @{productType='GAMES'; productStatus='ACTIVE'; minPrice=100; maxPrice=500}
$filtered = Wait-Report $filtered.id
$filteredCodes = @(Read-WorkbookCodes $filtered.id)
if ($filteredCodes -notcontains $active.code -or $filteredCodes -contains $inactive.code) { throw 'Combined active export filters were not applied.' }

$inactiveReport = Request-Json 'POST' '/reports' @{productStatus='INACTIVE'}
$inactiveReport = Wait-Report $inactiveReport.id
$inactiveCodes = @(Read-WorkbookCodes $inactiveReport.id)
if ($inactiveCodes -notcontains $inactive.code -or $inactiveCodes -contains $active.code) { throw 'Inactive-only export was not applied.' }

$complete = Request-Json 'POST' '/reports' @{}
$complete = Wait-Report $complete.id
$allCodes = @(Read-WorkbookCodes $complete.id)
if ($allCodes -notcontains $active.code -or $allCodes -notcontains $inactive.code) { throw 'Unfiltered export did not include both statuses.' }

[PSCustomObject]@{
    Result='Passed'
    FilteredReport=$filtered.id
    InactiveReport=$inactiveReport.id
    CompleteReport=$complete.id
    ExportedProducts=$allCodes.Count
    DownloadDirectory=$outputDirectory
}

# Verification products remain as explicit sample records; products are never physically deleted.
