export const SERVER_SCRIPT = `$ErrorActionPreference = 'Stop'
try {
  Add-Type -AssemblyName UIAutomationClient
  Add-Type -AssemblyName UIAutomationTypes
  Add-Type -AssemblyName System.Windows.Forms
} catch {}

$fgSig = '[DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();'
$Fg = Add-Type -MemberDefinition $fgSig -Name Fg -Namespace KairosNative -PassThru
$AE = [System.Windows.Automation.AutomationElement]
$TW = [System.Windows.Automation.TreeWalker]::ControlViewWalker
$PInvoke = [System.Windows.Automation.InvokePattern]::Pattern
$PValue = [System.Windows.Automation.ValuePattern]::Pattern
$PToggle = [System.Windows.Automation.TogglePattern]::Pattern
$PExpand = [System.Windows.Automation.ExpandCollapsePattern]::Pattern
$PSelItem = [System.Windows.Automation.SelectionItemPattern]::Pattern
$script:cache = @()

function Num($v) {
  try { $d = [double]$v } catch { return 0 }
  if ([double]::IsNaN($d) -or [double]::IsInfinity($d)) { return 0 }
  if ($d -gt 100000) { return 100000 }
  if ($d -lt -100000) { return -100000 }
  return [int]$d
}

function Clean($s) {
  if ($null -eq $s) { return '' }
  return ([string]$s).Replace([char]10, ' ').Replace([char]13, ' ').Replace([char]9, ' ')
}

function Get-Patterns($el) {
  $out = @()
  $map = [ordered]@{ invoke = $PInvoke; value = $PValue; toggle = $PToggle; expandcollapse = $PExpand; selectionitem = $PSelItem }
  foreach ($k in $map.Keys) {
    $p = $null
    try { if ($el.TryGetCurrentPattern($map[$k], [ref]$p)) { $out += $k } } catch {}
  }
  return $out
}

function Read-Window {
  $hwnd = $Fg::GetForegroundWindow()
  $win = $null
  try { $win = $AE::FromHandle($hwnd) } catch {}
  if ($null -eq $win) { return @{ window = $null; elements = @() } }
  $title = ''
  $appName = ''
  try { $title = Clean $win.Current.Name } catch {}
  try { $appName = (Get-Process -Id $win.Current.ProcessId -ErrorAction SilentlyContinue).ProcessName } catch {}
  $items = New-Object System.Collections.ArrayList
  $cacheList = New-Object System.Collections.ArrayList
  $queue = New-Object System.Collections.Queue
  $queue.Enqueue($win)
  while ($queue.Count -gt 0 -and $cacheList.Count -lt 160) {
    $el = $queue.Dequeue()
    try {
      $c = $el.Current
      $r = $c.BoundingRectangle
      $ref = $cacheList.Count
      [void]$cacheList.Add($el)
      [void]$items.Add(@{
        ref = $ref
        name = (Clean $c.Name)
        control = [string]$c.ControlType.ProgrammaticName
        autoId = (Clean $c.AutomationId)
        enabled = [bool]$c.IsEnabled
        offscreen = [bool]$c.IsOffscreen
        rect = @{ x = (Num $r.X); y = (Num $r.Y); w = (Num $r.Width); h = (Num $r.Height) }
        patterns = @(Get-Patterns $el)
      })
    } catch {}
    try {
      $child = $TW.GetFirstChild($el)
      while ($null -ne $child) { $queue.Enqueue($child); $child = $TW.GetNextSibling($child) }
    } catch {}
  }
  $script:cache = $cacheList.ToArray()
  return @{ window = @{ title = $title; app = $appName }; elements = @($items.ToArray()) }
}

function Get-Cached($ref) {
  if ($null -eq $ref) { return $null }
  $i = [int]$ref
  if ($i -lt 0 -or $i -ge $script:cache.Length) { return $null }
  return $script:cache[$i]
}

function Do-Invoke($el) {
  $p = $null
  if ($el.TryGetCurrentPattern($PInvoke, [ref]$p)) { $p.Invoke(); return $true }
  if ($el.TryGetCurrentPattern($PSelItem, [ref]$p)) { $p.Select(); return $true }
  if ($el.TryGetCurrentPattern($PToggle, [ref]$p)) { $p.Toggle(); return $true }
  if ($el.TryGetCurrentPattern($PExpand, [ref]$p)) { $p.Expand(); return $true }
  try { $el.SetFocus(); return $true } catch {}
  return $false
}

function Do-SetValue($el, $value) {
  $p = $null
  if ($el.TryGetCurrentPattern($PValue, [ref]$p)) {
    if ($p.Current.IsReadOnly) { return $false }
    $p.SetValue([string]$value)
    return $true
  }
  try { $el.SetFocus(); [System.Windows.Forms.SendKeys]::SendWait([string]$value); return $true } catch {}
  return $false
}

function Do-Toggle($el, $on) {
  $p = $null
  if (-not $el.TryGetCurrentPattern($PToggle, [ref]$p)) { return $false }
  $want = 'Off'
  if ($on) { $want = 'On' }
  $guard = 0
  while ([string]$p.Current.ToggleState -ne $want -and $guard -lt 3) { $p.Toggle(); $guard++ }
  return ([string]$p.Current.ToggleState -eq $want)
}

function Do-Select($el, $value) {
  $p = $null
  if ($el.TryGetCurrentPattern($PExpand, [ref]$p)) { try { $p.Expand() } catch {} }
  $cond = New-Object System.Windows.Automation.PropertyCondition($AE::NameProperty, [string]$value)
  $match = $el.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $cond)
  if ($null -eq $match) { return $false }
  return (Do-Invoke $match)
}

function Dispatch($req) {
  switch ($req.cmd) {
    'ping' { return @{ id = $req.id; ok = $true; data = @{ pong = $true } } }
    'read' { return @{ id = $req.id; ok = $true; data = (Read-Window) } }
    'keys' {
      try { [System.Windows.Forms.SendKeys]::SendWait([string]$req.keys); return @{ id = $req.id; ok = $true; data = @{ sent = $true } } }
      catch { return @{ id = $req.id; ok = $false; error = $_.Exception.Message } }
    }
  }
  $el = Get-Cached $req.ref
  if ($null -eq $el) { return @{ id = $req.id; ok = $false; error = 'element not found - read_desktop again for fresh ids' } }
  $ok = $false
  try {
    switch ($req.cmd) {
      'invoke' { $ok = Do-Invoke $el }
      'setvalue' { $ok = Do-SetValue $el $req.value }
      'toggle' { $ok = Do-Toggle $el $req.on }
      'select' { $ok = Do-Select $el $req.value }
      default { return @{ id = $req.id; ok = $false; error = ('unknown command: ' + [string]$req.cmd) } }
    }
  } catch { return @{ id = $req.id; ok = $false; error = $_.Exception.Message } }
  if ($ok) { return @{ id = $req.id; ok = $true; data = @{ done = $true } } }
  return @{ id = $req.id; ok = $false; error = 'the element did not accept that action' }
}

$stdin = [System.Console]::In
while ($true) {
  $line = $stdin.ReadLine()
  if ($null -eq $line) { break }
  $t = $line.Trim()
  if ($t -eq '') { continue }
  $resp = $null
  try {
    $req = $t | ConvertFrom-Json
    $resp = Dispatch $req
  } catch {
    $resp = @{ id = $null; ok = $false; error = $_.Exception.Message }
  }
  $json = $resp | ConvertTo-Json -Compress -Depth 8
  [System.Console]::Out.WriteLine($json)
  [System.Console]::Out.Flush()
}
`;
