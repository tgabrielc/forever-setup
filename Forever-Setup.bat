<# : Forever Setup
@echo off
set "FOREVER_SETUP=%~f0"
powershell -NoProfile -ExecutionPolicy Bypass -Command "iex ([IO.File]::ReadAllText($env:FOREVER_SETUP))"
if errorlevel 1 pause
exit /b
#>
# The one file to send: gets the newest setup from the release into a "Forever Setup" folder beside this file and starts Install.ps1.
# Runs what it downloads, as Update.ps1 does: the release has to stay trusted.
$ErrorActionPreference = 'Stop'
$Url = 'https://github.com/tgabrielc/forever-setup/releases/latest/download/package.b64'
$Folder = Join-Path (Split-Path -Parent $env:FOREVER_SETUP) 'Forever Setup'
$Temp = Join-Path $env:TEMP ('forever-setup-' + [guid]::NewGuid())
New-Item -ItemType Directory $Temp | Out-Null
try {
    $new = Join-Path $Temp 'new'
    try {
        Write-Host 'Getting the newest setup...'
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12   # Windows PowerShell 5.1 may default to older
        $ProgressPreference = 'SilentlyContinue'
        $text = Join-Path $Temp 'package.b64'
        $zip = Join-Path $Temp 'package.zip'
        Invoke-WebRequest -UseBasicParsing -TimeoutSec 120 -Uri $Url -OutFile $text
        [IO.File]::WriteAllBytes($zip, [Convert]::FromBase64String([IO.File]::ReadAllText($text)))
        Add-Type -AssemblyName System.IO.Compression.FileSystem
        [IO.Compression.ZipFile]::ExtractToDirectory($zip, $new)   # refuses entries that point outside $new
        foreach ($need in 'Install.ps1', 'Shared.ps1', 'Interface\AddOns') {
            if (-not (Test-Path -LiteralPath (Join-Path $new $need))) { throw "the download has no $need" }
        }
    } catch {
        Write-Host "Could not get the setup, so nothing changed: $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }
    New-Item -ItemType Directory -Force $Folder | Out-Null
    # Replaced whole, or a helper since retired would be installed again. Loose files stay: the saved game folder and the logs.
    foreach ($old in 'Interface', 'WTF') {
        $path = Join-Path $Folder $old
        if (Test-Path -LiteralPath $path) { Remove-Item -Recurse -Force -LiteralPath $path }
    }
    Get-ChildItem -LiteralPath $new | Copy-Item -Recurse -Force -Destination $Folder
} finally {
    Remove-Item -Recurse -Force -LiteralPath $Temp -ErrorAction SilentlyContinue
}
Write-Host "Setup files, with Update.bat and Uninstall.bat: $Folder"
# Already set up in a game (the game folder saved beside this file, with the installer's answers in it): offer both
# tools instead of going through the install. Update.bat is the latest of what is there; Install.ps1 is new features.
$gameFile = Join-Path $Folder 'game-folder.txt'
$Game = if (Test-Path -LiteralPath $gameFile) { (Get-Content -LiteralPath $gameFile -TotalCount 1).Trim() } else { '' }
if ($Game -and (Test-Path -LiteralPath (Join-Path $Game 'PetreSetup-backup\choices.txt'))) {
    Write-Host ''
    Write-Host 'Forever is already set up in your game.' -ForegroundColor Green
    Write-Host '  U  Update: the newest version of what you have. Your settings are not touched.'
    Write-Host '  I  Install: the installer again, for new features and new questions.'
    if ((Read-Host 'Update or Install? [U]') -match '^\s*[iI]') {
        & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Folder 'Install.ps1')
    } else {
        & cmd /c (Join-Path $Folder 'Update.bat')
    }
    exit $LASTEXITCODE
}
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Folder 'Install.ps1')
exit $LASTEXITCODE
