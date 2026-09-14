<#
.SYNOPSIS
  Reports (and optionally stops) leftover agent/MCP helper processes.

.DESCRIPTION
  Claude Code, Codex and their MCP servers (Blender, Roblox Studio, meshy,
  browser automation...) each spawn helper processes: uv.exe, python.exe,
  StudioMCP.exe. A session that ends without stopping its own servers
  leaves those helpers running under the still-alive Claude/Codex app, so a
  "process whose parent is gone" check does NOT catch them — on this
  machine the leaked uv.exe/python.exe processes all still had a live
  parent. Instead this script targets a known allowlist of process NAMES.

  Default mode only REPORTS counts. Pass -Stop to terminate every running
  process whose name is in -Name (defaults to the known MCP-helper set).
  This will disconnect any Claude/Codex tool that is actively using one of
  those helpers right now (e.g. a live Blender MCP call) — restart the
  affected app window if a tool stops responding afterward.

  Never targets core Windows session processes (csrss, wininit, winlogon,
  explorer, smss, services, lsass, svchost, dwm), even if you pass a
  matching -Name by mistake — killing those can crash or log out the
  session.

.PARAMETER Stop
  Terminate every process matching -Name instead of just listing counts.

.PARAMETER Name
  Process name(s) to target. Defaults to the known MCP-helper executables
  that pile up on this machine: uv.exe, uvx.exe, python.exe, pythonw.exe,
  StudioMCP.exe.

.EXAMPLE
  powershell -File scripts/agent-processes.ps1
  powershell -File scripts/agent-processes.ps1 -Stop
  powershell -File scripts/agent-processes.ps1 -Stop -Name chrome.exe,node.exe
#>
param(
  [switch]$Stop,
  [string[]]$Name = @('uv.exe', 'uvx.exe', 'python.exe', 'pythonw.exe', 'StudioMCP.exe')
)

# Hard safety blocklist: never terminate these regardless of -Name.
$NeverKill = @('csrss.exe', 'wininit.exe', 'winlogon.exe', 'explorer.exe', 'smss.exe', 'services.exe', 'lsass.exe', 'svchost.exe', 'dwm.exe')

$all = Get-CimInstance Win32_Process
Write-Host "Total processes: $($all.Count)"

Write-Host "`nCounts for watched MCP/agent-helper process names:"
$all | Where-Object { $Name -contains $_.Name } |
  Group-Object Name | Sort-Object Count -Descending |
  Select-Object Count, Name | Format-Table -AutoSize

$blocked = $Name | Where-Object { $NeverKill -contains $_ }
if ($blocked.Count) { Write-Host "Refusing to target protected system process name(s): $($blocked -join ', ')" }

$targets = $all | Where-Object { $Name -contains $_.Name -and $NeverKill -notcontains $_.Name }

if ($Stop) {
  if (-not $targets.Count) { Write-Host 'Nothing matching -Name found.'; return }
  Write-Host "`nStopping $($targets.Count) process(es) matching: $($Name -join ', ')"
  foreach ($p in $targets) {
    try {
      Stop-Process -Id $p.ProcessId -Force -ErrorAction Stop
      Write-Host "  stopped  $($p.ProcessId)  $($p.Name)"
    } catch {
      Write-Host "  failed   $($p.ProcessId)  $($p.Name)  $($_.Exception.Message)"
    }
  }
} else {
  Write-Host "`nDry run - pass -Stop to terminate every process above named one of: $($Name -join ', ')"
  Write-Host 'Pass -Name to target different process names (e.g. -Name chrome.exe,node.exe).'
}
