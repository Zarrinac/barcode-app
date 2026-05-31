$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$androidDir = Join-Path $repoRoot 'android'
$javaHome = 'C:\Program Files\Android\Android Studio\jbr'
$capacitorServerUrl = 'http://bcrs.dcode.co.ir/scanner?freshLogin=1'

if (-not (Test-Path (Join-Path $javaHome 'bin\java.exe'))) {
  throw "Android Studio JDK 21 was not found at $javaHome"
}

$env:JAVA_HOME = $javaHome
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
$env:CAPACITOR_SERVER_URL = $capacitorServerUrl

Push-Location $repoRoot
try {
  Write-Host "Using Capacitor server URL: $env:CAPACITOR_SERVER_URL"
  & npx.cmd cap sync android
  if ($LASTEXITCODE -ne 0) {
    throw "Capacitor sync failed with exit code $LASTEXITCODE"
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

$sourceApk = Join-Path $androidDir 'app\build\outputs\apk\debug\app-debug.apk'
$downloadDir = Join-Path $repoRoot 'public\downloads'
$latestApk = Join-Path $downloadDir 'dcode-barcode-latest.apk'

if (-not (Test-Path -LiteralPath $sourceApk)) {
  throw "Debug APK was not found at $sourceApk"
}

New-Item -ItemType Directory -Path $downloadDir -Force | Out-Null
Copy-Item -LiteralPath $sourceApk -Destination $latestApk -Force
Write-Host "Published latest APK to $latestApk"
