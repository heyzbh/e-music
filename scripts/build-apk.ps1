# Builds the release APK from a mirror at a short path (C:\em).
# The project lives deep inside OneDrive, which pushes native build paths past Windows'
# 260-character limit. The mirror is one-way: this folder is never modified except for
# the finished APK copied back into it.
#
# Usage:  powershell -ExecutionPolicy Bypass -File scripts\build-apk.ps1 [-Version 0.2]

param(
  [string]$Version = "dev",
  [string]$Mirror = "C:\em"
)

$ErrorActionPreference = "Stop"
$source = Split-Path -Parent $PSScriptRoot
$jdk = Join-Path $env:USERPROFILE ".jdks\jdk-17.0.20.1+1"

Write-Host "Mirroring $source -> $Mirror"
# Skip build outputs; they are regenerated and would only slow the copy.
$excludeDirs = @(
  (Join-Path $source "android\build"),
  (Join-Path $source "android\app\build"),
  (Join-Path $source "android\.gradle"),
  (Join-Path $source ".expo"),
  ".cxx"
)
$libBuilds = Get-ChildItem (Join-Path $source "node_modules") -Directory -Recurse -Depth 3 -Filter build -ErrorAction SilentlyContinue |
  Where-Object { $_.Parent.Name -eq "android" } | ForEach-Object { $_.FullName }
robocopy $source $Mirror /MIR /NFL /NDL /NJH /NJS /NP /XF *.apk /XD ($excludeDirs + $libBuilds) | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy failed with code $LASTEXITCODE" }

Push-Location (Join-Path $Mirror "android")
try {
  $env:JAVA_HOME = $jdk
  # Old daemons keep files locked on Windows (seen in the lint cache); start clean.
  & .\gradlew.bat --stop | Out-Null
  # Lint "vital" checks are for store releases; skipping them avoids that lock and saves minutes.
  & .\gradlew.bat assembleRelease -PreactNativeArchitectures=arm64-v8a --console=plain `
    -x lintVitalAnalyzeRelease -x lintVitalReportRelease -x lintVitalRelease
  if ($LASTEXITCODE -ne 0) { throw "Gradle build failed" }
} finally {
  Pop-Location
}

$apk = Join-Path $Mirror "android\app\build\outputs\apk\release\app-release.apk"
$target = Join-Path $source "e-music-v$Version.apk"
Copy-Item $apk $target -Force
Write-Host "APK ready: $target"
