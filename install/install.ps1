# Installs Castle Siege for the current Windows user: no admin rights, nothing outside the user's profile.
#
#   Double-click "Install Castle Siege.cmd", or run:
#   powershell -ExecutionPolicy Bypass -File install\install.ps1 [-Destination <folder>] [-NoShortcuts]
#
# It copies the game to %LOCALAPPDATA%\Programs\Castle Siege, adds Start menu and desktop shortcuts that open it
# in its own Edge app window (or the default browser when Edge is missing), and lists it under Settings > Apps so
# it can be uninstalled there. Running it again updates the game in place. Saved games live in the browser's
# storage, so updating or uninstalling never touches them.
param(
  [string]$Destination = (Join-Path $env:LOCALAPPDATA 'Programs\Castle Siege'),
  [switch]$NoShortcuts
)
$ErrorActionPreference = 'Stop'

$repo = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path (Join-Path $repo 'index.html'))) { throw "index.html not found next to the install folder ($repo)." }

# The game is index.html, js\ and the two art scripts it loads; the PNGs in art\ are previews and stay behind.
Write-Host "Installing Castle Siege to $Destination"
New-Item -ItemType Directory -Force $Destination | Out-Null
foreach ($old in 'index.html', 'js', 'art') {
  $p = Join-Path $Destination $old
  if (Test-Path $p) { Remove-Item -Recurse -Force $p }
}
Copy-Item (Join-Path $repo 'index.html') $Destination
New-Item -ItemType Directory -Force (Join-Path $Destination 'js'), (Join-Path $Destination 'art') | Out-Null
Copy-Item (Join-Path $repo 'js\*.js') (Join-Path $Destination 'js')
Copy-Item (Join-Path $repo 'art\launch-bg.js'), (Join-Path $repo 'art\gallery.js') (Join-Path $Destination 'art')
Copy-Item (Join-Path $PSScriptRoot 'castle-siege.ico'), (Join-Path $PSScriptRoot 'uninstall.ps1') $Destination

$index = Join-Path $Destination 'index.html'
$icon = Join-Path $Destination 'castle-siege.ico'
$url = ([System.Uri]$index).AbsoluteUri

# Edge's app mode gives the game its own window with no address bar; without Edge, open the page itself.
$edge = @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe") |
  Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1

if (-not $NoShortcuts) {
  $shell = New-Object -ComObject WScript.Shell
  $places = @([Environment]::GetFolderPath('Programs'), [Environment]::GetFolderPath('Desktop'))
  foreach ($dir in $places) {
    $lnk = $shell.CreateShortcut((Join-Path $dir 'Castle Siege.lnk'))
    if ($edge) { $lnk.TargetPath = $edge; $lnk.Arguments = "--app=`"$url`"" }
    else { $lnk.TargetPath = $index; $lnk.Arguments = '' }
    $lnk.WorkingDirectory = $Destination
    $lnk.IconLocation = "$icon,0"
    $lnk.Description = 'Castle Siege: a medieval game of castles and marching troops'
    $lnk.Save()
  }

  # Settings > Apps entry (per user).
  $key = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\CastleSiege'
  New-Item -Force $key | Out-Null
  $size = [int]((Get-ChildItem -Recurse -File $Destination | Measure-Object Length -Sum).Sum / 1KB)
  $props = @{
    DisplayName = 'Castle Siege'; Publisher = 'jackgary86-dev'; DisplayIcon = $icon; InstallLocation = $Destination
    DisplayVersion = (Get-Date -Format 'yyyy.M.d')
    UninstallString = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$(Join-Path $Destination 'uninstall.ps1')`""
  }
  foreach ($k in $props.Keys) { Set-ItemProperty $key $k $props[$k] }
  foreach ($k in 'NoModify', 'NoRepair') { Set-ItemProperty $key $k 1 -Type DWord }
  Set-ItemProperty $key EstimatedSize $size -Type DWord
}

if ($NoShortcuts) { Write-Host "Castle Siege is installed. Open $index to play." }
else { Write-Host 'Castle Siege is installed. Open it from the Start menu or the desktop shortcut.' }
