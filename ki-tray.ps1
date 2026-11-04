# MeinWochenplan – KI-Symbol im Infobereich der Taskleiste
# Rechtsklick: KI pausieren (Grafikkarte frei) oder aktivieren. Startet auch den PC-Helfer im Hintergrund.
# Start: powershell -STA -WindowStyle Hidden -ExecutionPolicy Bypass -File ki-tray.ps1

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$Container = 'ollama_backend'
$OllamaUrl = 'http://127.0.0.1:11435'
$HelperDir = $PSScriptRoot
$DockerExe = 'C:\Program Files\Docker\Docker\Docker Desktop.exe'

# Nur ein Symbol gleichzeitig
$mutex = New-Object System.Threading.Mutex($false, 'MeinWochenplanKiTray')
if (-not $mutex.WaitOne(0)) { exit }

function New-StateIcon([System.Drawing.Color]$color) {
  $bmp = New-Object System.Drawing.Bitmap 32, 32
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.TextRenderingHint = 'AntiAliasGridFit'
  $g.FillEllipse((New-Object System.Drawing.SolidBrush $color), 1, 1, 30, 30)
  $font = New-Object System.Drawing.Font('Segoe UI', 11, [System.Drawing.FontStyle]::Bold)
  $fmt = New-Object System.Drawing.StringFormat
  $fmt.Alignment = 'Center'; $fmt.LineAlignment = 'Center'
  $g.DrawString('KI', $font, [System.Drawing.Brushes]::Black, (New-Object System.Drawing.RectangleF 0, 1, 32, 32), $fmt)
  $g.Dispose()
  [System.Drawing.Icon]::FromHandle($bmp.GetHicon())
}
$IconOn = New-StateIcon ([System.Drawing.Color]::FromArgb(34, 197, 94))
$IconOff = New-StateIcon ([System.Drawing.Color]::FromArgb(120, 130, 125))
$IconBusy = New-StateIcon ([System.Drawing.Color]::FromArgb(245, 184, 75))

function Docker-Ok { docker info --format '{{.ServerVersion}}' 2>$null | Out-Null; $LASTEXITCODE -eq 0 }
function Ki-Running {
  $r = docker inspect -f '{{.State.Running}}' $Container 2>$null
  $LASTEXITCODE -eq 0 -and $r -eq 'true'
}
function Gpu-Used {
  try { (& nvidia-smi --query-gpu=memory.used,memory.total --format=csv,noheader,nounits 2>$null) -split ',\s*' } catch { $null }
}
function Loaded-Models {
  try { (Invoke-RestMethod "$OllamaUrl/api/ps" -TimeoutSec 3).models } catch { @() }
}

# ---------- PC-Helfer als unsichtbarer Hintergrundprozess ----------
$script:helper = $null
function Helper-Up { try { (Invoke-RestMethod 'http://127.0.0.1:8093/status' -TimeoutSec 2).ok } catch { $false } }
function Start-Helper {
  if (Helper-Up) { return }
  $script:helper = Start-Process -FilePath 'node' -ArgumentList 'pc-helfer.js' -WorkingDirectory $HelperDir -WindowStyle Hidden -PassThru
}
function Stop-Helper {
  if ($script:helper -and -not $script:helper.HasExited) { Stop-Process -Id $script:helper.Id -Force -ErrorAction SilentlyContinue }
  $script:helper = $null
}

# ---------- Menü ----------
$tray = New-Object System.Windows.Forms.NotifyIcon
$tray.Icon = $IconBusy
$tray.Text = 'MeinWochenplan KI'
$tray.Visible = $true

$menu = New-Object System.Windows.Forms.ContextMenuStrip
$itemState = $menu.Items.Add('Status wird geprüft …'); $itemState.Enabled = $false
$itemGpu = $menu.Items.Add(''); $itemGpu.Enabled = $false
$menu.Items.Add('-') | Out-Null
$itemOn = $menu.Items.Add('KI aktivieren')
$itemOff = $menu.Items.Add('KI pausieren (Grafikkarte freigeben)')
$itemUnload = $menu.Items.Add('Nur Modelle entladen (KI bleibt bereit)')
$menu.Items.Add('-') | Out-Null
$itemHelper = $menu.Items.Add('PC-Helfer neu starten')
$itemQuit = $menu.Items.Add('Beenden (KI-Symbol und PC-Helfer)')
$tray.ContextMenuStrip = $menu

$script:pendingStart = 0

function Refresh {
  $dockerOk = Docker-Ok
  $running = $dockerOk -and (Ki-Running)
  $gpu = Gpu-Used
  $gpuText = if ($gpu) { "Grafikkarte: $([math]::Round($gpu[0]/1024,1)) von $([math]::Round($gpu[1]/1024,1)) GB belegt" } else { 'Grafikkarte: unbekannt' }
  if ($script:pendingStart -gt 0 -and -not $running) {
    $script:pendingStart--
    if ($dockerOk) { docker start $Container 2>$null | Out-Null }
    $itemState.Text = 'KI startet …'; $tray.Icon = $IconBusy
  } elseif ($running) {
    $script:pendingStart = 0
    $models = @(Loaded-Models | ForEach-Object { $_.name })
    $itemState.Text = if ($models.Count) { "KI aktiv · geladen: $($models -join ', ')" } else { 'KI aktiv · kein Modell im Speicher' }
    $tray.Icon = $IconOn
  } else {
    $itemState.Text = if ($dockerOk) { 'KI pausiert – Grafikkarte frei' } else { 'KI aus (Docker läuft nicht)' }
    $tray.Icon = $IconOff
  }
  $itemGpu.Text = $gpuText
  $itemOn.Enabled = -not $running
  $itemOff.Enabled = $running
  $itemUnload.Enabled = $running
  $t = "MeinWochenplan KI – $($itemState.Text)"
  $tray.Text = $t.Substring(0, [math]::Min(63, $t.Length))
}

$itemOn.Add_Click({
  if (-not (Docker-Ok) -and (Test-Path $DockerExe)) { Start-Process $DockerExe }
  docker start $Container 2>$null | Out-Null
  # Docker Desktop braucht nach dem Start etwas – bis zu 2 Minuten weiter versuchen
  $script:pendingStart = 12
  Start-Helper
  Refresh
})
$itemOff.Add_Click({
  foreach ($m in Loaded-Models) {
    try { Invoke-RestMethod "$OllamaUrl/api/generate" -Method Post -Body (@{ model = $m.name; keep_alive = 0 } | ConvertTo-Json) -ContentType 'application/json' -TimeoutSec 10 | Out-Null } catch {}
  }
  docker stop $Container 2>$null | Out-Null
  $script:pendingStart = 0
  Refresh
  $tray.ShowBalloonTip(3000, 'KI pausiert', 'Grafikspeicher ist frei. Bons liest die App jetzt über Gemini – oder hier wieder aktivieren.', 'Info')
})
$itemUnload.Add_Click({
  foreach ($m in Loaded-Models) {
    try { Invoke-RestMethod "$OllamaUrl/api/generate" -Method Post -Body (@{ model = $m.name; keep_alive = 0 } | ConvertTo-Json) -ContentType 'application/json' -TimeoutSec 10 | Out-Null } catch {}
  }
  Refresh
})
$itemHelper.Add_Click({ Stop-Helper; Start-Sleep -Milliseconds 500; Start-Helper; Refresh })
$itemQuit.Add_Click({
  $timer.Stop(); Stop-Helper
  $tray.Visible = $false; $tray.Dispose()
  [System.Windows.Forms.Application]::Exit()
})
# Linksklick öffnet ebenfalls das Menü
$tray.Add_MouseClick({ param($s, $e) if ($e.Button -eq 'Left') { $m = [System.Windows.Forms.NotifyIcon].GetMethod('ShowContextMenu', [System.Reflection.BindingFlags]'Instance,NonPublic'); $m.Invoke($tray, $null) } })
$menu.Add_Opening({ Refresh })

$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 10000
$timer.Add_Tick({ Refresh })
$timer.Start()

Start-Helper
Refresh
[System.Windows.Forms.Application]::Run()
$mutex.ReleaseMutex()
