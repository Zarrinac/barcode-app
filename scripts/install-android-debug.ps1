$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$apkPath = Join-Path $repoRoot 'android\app\build\outputs\apk\debug\app-debug.apk'
$adbPath = Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools\adb.exe'

if (-not (Test-Path $apkPath)) {
  throw "APK was not found at $apkPath. Run npm run android:apk first."
}

if (-not (Test-Path $adbPath)) {
  throw "ADB was not found at $adbPath"
}

& $adbPath devices
& $adbPath install -r $apkPath
