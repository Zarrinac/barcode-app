$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$androidDir = Join-Path $repoRoot 'android'
$nativeAndroidDir = Join-Path $repoRoot 'android-native'
$javaHome = 'C:\Program Files\Android\Android Studio\jbr'
$defaultCapacitorServerUrl = 'http://bcrs.dcode.co.ir/scanner?freshLogin=1'
$defaultNativeApiBaseUrl = 'http://bcrs.dcode.co.ir'
$capacitorServerUrl = if ($env:CAPACITOR_SERVER_URL) { $env:CAPACITOR_SERVER_URL } else { $defaultCapacitorServerUrl }
$nativeApiBaseUrl = if ($env:BARCODE_API_BASE_URL) { $env:BARCODE_API_BASE_URL } else { $defaultNativeApiBaseUrl }

if (-not (Test-Path (Join-Path $javaHome 'bin\java.exe'))) {
  throw "Android Studio JDK 21 was not found at $javaHome"
}

$env:JAVA_HOME = $javaHome
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
$env:CAPACITOR_SERVER_URL = $capacitorServerUrl
$env:BARCODE_API_BASE_URL = $nativeApiBaseUrl

Push-Location $repoRoot
try {
  Write-Host "Using Capacitor server URL: $env:CAPACITOR_SERVER_URL"
  Write-Host "Using native API base URL: $env:BARCODE_API_BASE_URL"
  $capSyncOutput = & cmd.exe /d /c "npx.cmd cap sync android" 2>&1
  $capSyncExitCode = $LASTEXITCODE
  $capSyncOutput | ForEach-Object { Write-Host $_ }
  if ($capSyncExitCode -ne 0 -and -not (($capSyncOutput -join "`n") -match 'Sync finished')) {
    throw "Capacitor sync failed with exit code $capSyncExitCode"
  }

  $androidIconSource = Join-Path $repoRoot 'public\favicon\android'
  $androidIconTarget = Join-Path $repoRoot 'android\app\src\main\res'
  $adaptiveForeground = Join-Path $androidIconSource 'adaptive-foreground.png'
  $launcherDensities = @('mipmap-mdpi', 'mipmap-hdpi', 'mipmap-xhdpi', 'mipmap-xxhdpi', 'mipmap-xxxhdpi')

  foreach ($density in $launcherDensities) {
    foreach ($iconFile in @('ic_launcher.png', 'ic_launcher_round.png')) {
      $sourceIcon = Join-Path $androidIconSource "$density\$iconFile"
      $targetIcon = Join-Path $androidIconTarget "$density\$iconFile"

      if ((Test-Path -LiteralPath $sourceIcon) -and (Test-Path -LiteralPath (Split-Path -Parent $targetIcon))) {
        Copy-Item -LiteralPath $sourceIcon -Destination $targetIcon -Force
      }
    }

    $targetForeground = Join-Path $androidIconTarget "$density\ic_launcher_foreground.png"
    if ((Test-Path -LiteralPath $adaptiveForeground) -and (Test-Path -LiteralPath (Split-Path -Parent $targetForeground))) {
      Copy-Item -LiteralPath $adaptiveForeground -Destination $targetForeground -Force
    }
  }

  $stringsPath = Join-Path $repoRoot 'android\app\src\main\res\values\strings.xml'
  [xml]$stringsXml = Get-Content -LiteralPath $stringsPath
  foreach ($item in $stringsXml.resources.string) {
    if ($item.name -eq 'app_name') {
      $item.InnerText = '"D''CODE"'
    }
    if ($item.name -eq 'title_activity_main') {
      $item.InnerText = '"D''CODE Barcode Scanner"'
    }
  }
  $settings = New-Object System.Xml.XmlWriterSettings
  $settings.Encoding = New-Object System.Text.UTF8Encoding($false)
  $settings.Indent = $true
  $writer = [System.Xml.XmlWriter]::Create($stringsPath, $settings)
  try {
    $stringsXml.Save($writer)
  } finally {
    $writer.Close()
  }
} finally {
  Pop-Location
}

Push-Location $androidDir
try {
  & .\gradlew.bat assembleDebug
  if ($LASTEXITCODE -ne 0) {
    throw "Gradle build failed with exit code $LASTEXITCODE"
  }
} finally {
  Pop-Location
}

Push-Location $nativeAndroidDir
try {
  & .\gradlew.bat :app:assembleDebug "-PBARCODE_API_BASE_URL=$nativeApiBaseUrl"
  if ($LASTEXITCODE -ne 0) {
    throw "Native Gradle build failed with exit code $LASTEXITCODE"
  }
} finally {
  Pop-Location
}

$sourceApk = Join-Path $androidDir 'app\build\outputs\apk\debug\app-debug.apk'
$nativeSourceApk = Join-Path $nativeAndroidDir 'app\build\outputs\apk\debug\app-debug.apk'
$downloadDir = Join-Path $repoRoot 'public\downloads'
$latestCapacitorApk = Join-Path $downloadDir 'dcode-barcode-latest.apk'
$latestNativeApk = Join-Path $downloadDir 'barcode-native.apk'

if (-not (Test-Path -LiteralPath $sourceApk)) {
  throw "Debug APK was not found at $sourceApk"
}

if (-not (Test-Path -LiteralPath $nativeSourceApk)) {
  throw "Native debug APK was not found at $nativeSourceApk"
}

New-Item -ItemType Directory -Path $downloadDir -Force | Out-Null
Copy-Item -LiteralPath $sourceApk -Destination $latestCapacitorApk -Force
Copy-Item -LiteralPath $nativeSourceApk -Destination $latestNativeApk -Force
Write-Host "Published Capacitor APK to $latestCapacitorApk"
Write-Host "Published native APK to $latestNativeApk"
