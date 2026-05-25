$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$androidDir = Join-Path $repoRoot 'android'
$javaHome = 'C:\Program Files\Android\Android Studio\jbr'

if (-not (Test-Path (Join-Path $javaHome 'bin\java.exe'))) {
  throw "Android Studio JDK 21 was not found at $javaHome"
}

$env:JAVA_HOME = $javaHome
$env:Path = "$env:JAVA_HOME\bin;$env:Path"

Push-Location $repoRoot
try {
  & npx.cmd cap sync android
  if ($LASTEXITCODE -ne 0) {
    throw "Capacitor sync failed with exit code $LASTEXITCODE"
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
