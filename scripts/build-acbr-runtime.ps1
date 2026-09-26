$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$AcbrCommit = '2784a56ad10f60b9fa412c8d172e495e9d93a0e7'
$FortesCommit = '888e387faca5a691b246a6b493776b8435be59f3'
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$Target = Join-Path $RepoRoot 'fiscal-runtime\acbr'
$WorkRoot = Join-Path $env:RUNNER_TEMP ('acbr-' + [Guid]::NewGuid().ToString('N').Substring(0,8))
$AcbrRoot = Join-Path $WorkRoot 'ACBr'
$FortesRoot = Join-Path $WorkRoot 'fortes'

function Invoke-Checked([string]$File, [string[]]$Arguments) {
  Write-Host "> $File $($Arguments -join ' ')"
  & $File @Arguments
  if ($LASTEXITCODE -ne 0) { throw "Command failed with exit code ${LASTEXITCODE}: $File" }
}

try {
  $LazBuild = $null
  $command = Get-Command lazbuild.exe -ErrorAction SilentlyContinue
  if ($command) { $LazBuild = $command.Source }
  if (-not $LazBuild) {
    $command = Get-Command lazbuild -ErrorAction SilentlyContinue
    if ($command) { $LazBuild = $command.Source }
  }
  if (-not $LazBuild) {
    $candidate = Get-ChildItem 'C:\lazarus' -Filter lazbuild.exe -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($candidate) { $LazBuild = $candidate.FullName }
  }
  if (-not $LazBuild) { throw 'lazbuild nao encontrado. Instale Lazarus/FPC no runner antes de compilar o ACBr.' }

  New-Item -ItemType Directory -Force -Path $WorkRoot | Out-Null
  Invoke-Checked 'git' @('-c','core.longpaths=true','clone','--filter=blob:none','--no-checkout','--no-tags','--depth','1','https://github.com/frones/ACBr.git',$AcbrRoot)
  Invoke-Checked 'git' @('-C',$AcbrRoot,'config','core.longpaths','true')
  Invoke-Checked 'git' @('-C',$AcbrRoot,'sparse-checkout','init','--cone')
  Invoke-Checked 'git' @('-C',$AcbrRoot,'sparse-checkout','set','Projetos/ACBrMonitorPLUS','Pacotes/Lazarus','Fontes','DLLs','Exemplos/ACBrDFe/Schemas/NFe')
  Invoke-Checked 'git' @('-C',$AcbrRoot,'fetch','--depth','1','origin',$AcbrCommit)
  Invoke-Checked 'git' @('-C',$AcbrRoot,'checkout','--detach','FETCH_HEAD')
  $actualAcbr = (& git -C $AcbrRoot rev-parse HEAD).Trim()
  if ($actualAcbr -ne $AcbrCommit) { throw "Commit ACBr inesperado: $actualAcbr" }

  Invoke-Checked 'git' @('-c','core.longpaths=true','clone','--no-tags','--depth','1','https://github.com/fortesinformatica/fortesreport-ce.git',$FortesRoot)
  Invoke-Checked 'git' @('-C',$FortesRoot,'fetch','--depth','1','origin',$FortesCommit)
  Invoke-Checked 'git' @('-C',$FortesRoot,'checkout','--detach','FETCH_HEAD')

  $fortesPackage = Get-ChildItem $FortesRoot -Filter 'frce.lpk' -Recurse | Select-Object -First 1
  if (-not $fortesPackage) { throw 'Pacote Lazarus do FortesReport nao encontrado.' }
  Invoke-Checked $LazBuild @("--add-package-link=$($fortesPackage.FullName)")

  $acbrPackages = @(Get-ChildItem (Join-Path $AcbrRoot 'Pacotes\Lazarus') -Filter '*.lpk' -Recurse | Sort-Object FullName)
  if ($acbrPackages.Count -eq 0) { throw 'Pacotes Lazarus do ACBr nao encontrados.' }
  foreach ($package in $acbrPackages) {
    Invoke-Checked $LazBuild @("--add-package-link=$($package.FullName)")
  }

  $monitorProject = Join-Path $AcbrRoot 'Projetos\ACBrMonitorPLUS\Lazarus\ACBrMonitor.lpi'
  Invoke-Checked $LazBuild @('--build-mode=Release-Win64-x86_64',$monitorProject)

  $monitorExe = Get-ChildItem (Split-Path $monitorProject) -Filter 'ACBrMonitor64.exe' -Recurse | Select-Object -First 1
  if (-not $monitorExe) { throw 'A compilacao terminou sem gerar ACBrMonitor64.exe.' }

  if (Test-Path $Target) { Remove-Item $Target -Recurse -Force }
  New-Item -ItemType Directory -Force -Path $Target | Out-Null
  Copy-Item $monitorExe.FullName (Join-Path $Target 'ACBrMonitorPLUS.exe') -Force

  $schemas = Join-Path $AcbrRoot 'Exemplos\ACBrDFe\Schemas\NFe'
  if (-not (Test-Path $schemas)) { throw 'Schemas NFe/NFC-e do ACBr nao encontrados.' }
  New-Item -ItemType Directory -Force -Path (Join-Path $Target 'Schemas') | Out-Null
  Copy-Item $schemas (Join-Path $Target 'Schemas\NFe') -Recurse -Force

  foreach ($dependencyDir in @(
    (Join-Path $AcbrRoot 'DLLs\OpenSSL\3.1.3\x64'),
    (Join-Path $AcbrRoot 'DLLs\LibXml2\x64')
  )) {
    if (-not (Test-Path $dependencyDir)) { throw "Dependencia ACBr ausente: $dependencyDir" }
    Copy-Item (Join-Path $dependencyDir '*') $Target -Force
  }

  $monitorDir = Join-Path $AcbrRoot 'Projetos\ACBrMonitorPLUS\Lazarus'
  Copy-Item (Join-Path $monitorDir 'LICENSE.TXT') (Join-Path $Target 'ACBR-LICENSE.TXT') -Force
  if (Test-Path (Join-Path $monitorDir 'ACBrIBGE.txt')) { Copy-Item (Join-Path $monitorDir 'ACBrIBGE.txt') $Target -Force }
  @"
ArtiSys ERP bundled fiscal runtime
ACBr source: https://github.com/frones/ACBr
ACBr commit: $AcbrCommit
FortesReport source: https://github.com/fortesinformatica/fortesreport-ce
FortesReport commit: $FortesCommit
Build: Lazarus/FPC, Release-Win64-x86_64
The ACBr executable is compiled from source during the ArtiSys ERP release pipeline.
No runtime download or paid fiscal provider is required by the ERP core.
"@ | Set-Content (Join-Path $Target 'SOURCE.txt') -Encoding UTF8

  $required = @(
    'ACBrMonitorPLUS.exe',
    'ACBR-LICENSE.TXT',
    'SOURCE.txt',
    'libcrypto-3-x64.dll',
    'libssl-3-x64.dll',
    'libxml2.dll'
  )
  foreach ($name in $required) {
    $file = Join-Path $Target $name
    if (-not (Test-Path $file)) { throw "Runtime ACBr incompleto: $name" }
  }
  if ((Get-Item (Join-Path $Target 'ACBrMonitorPLUS.exe')).Length -lt 100000) { throw 'ACBrMonitorPLUS.exe gerado parece invalido.' }
  Write-Host "ACBr runtime pronto em $Target"
}
finally {
  if (Test-Path $WorkRoot) { Remove-Item $WorkRoot -Recurse -Force -ErrorAction SilentlyContinue }
}
