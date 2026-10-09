# Removes Castle Siege: its shortcuts, its Settings > Apps entry and its install folder (the folder this script
# sits in once installed). Saved games are in the browser's storage and are left alone.
$ErrorActionPreference = 'Stop'
$dir = $PSScriptRoot
if (-not (Test-Path (Join-Path $dir 'index.html')) -or -not (Test-Path (Join-Path $dir 'castle-siege.ico'))) {
  throw "This doesn't look like an installed copy of Castle Siege ($dir); nothing was removed."
}
foreach ($place in [Environment]::GetFolderPath('Programs'), [Environment]::GetFolderPath('Desktop')) {
  $lnk = Join-Path $place 'Castle Siege.lnk'
  if (Test-Path $lnk) { Remove-Item -Force $lnk }
}
$key = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\CastleSiege'
if (Test-Path $key) { Remove-Item -Recurse -Force $key }
Set-Location $env:TEMP
Remove-Item -Recurse -Force $dir
Write-Host 'Castle Siege has been uninstalled. Your saved games are still in the browser, ready if you reinstall.'
