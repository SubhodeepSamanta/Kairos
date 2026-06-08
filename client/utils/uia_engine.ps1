param([string]$InputJson)

Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$payloadObj = $InputJson | ConvertFrom-Json
$action = $payloadObj.action
$appName = $payloadObj.app
$selector = $payloadObj.selector
$value = $payloadObj.value
$depth = if ($payloadObj.depth) { $payloadObj.depth } else { 3 }

if ($action -eq "capture_window" -and $appName -eq '__screen__') {
  try {
    $screen = [System.Windows.Forms.Screen]::PrimaryScreen
    $bounds = $screen.Bounds
    $bmp = New-Object System.Drawing.Bitmap(
      $bounds.Width, $bounds.Height
    )
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.CopyFromScreen(
      $bounds.X, $bounds.Y, 0, 0, $bounds.Size
    )
    $tmpPath = [System.IO.Path]::Combine(
      $env:TEMP,
      "kairos_$([System.Guid]::NewGuid().ToString('N')).png"
    )
    $bmp.Save(
      $tmpPath, 
      [System.Drawing.Imaging.ImageFormat]::Png
    )
    $g.Dispose()
    $bmp.Dispose()
    Write-Output (
      @{ success = $true; result = $tmpPath } | 
      ConvertTo-Json -Compress
    )
    exit 0
  }
  catch {
    Write-Output (
      @{ 
        success = $false
        error   = "Screen capture failed: $($_.Exception.Message)" 
      } | ConvertTo-Json -Compress
    )
    exit 0
  }
}

function Get-AppWindow($name) {
  $procs = Get-Process | Where-Object {
    $_.MainWindowHandle -ne 0 -and (
      $_.ProcessName -like "*$name*" -or 
      $_.MainWindowTitle -like "*$name*"
    )
  }
  if (-not $procs) { return $null }
  $proc = $procs | Select-Object -First 1
  return [System.Windows.Automation.AutomationElement]::FromHandle(
    $proc.MainWindowHandle
  )
}

function Find-Element($root, $sel) {
  $conditions = @()
  
  if ($sel.name) {
    $conditions += New-Object System.Windows.Automation.PropertyCondition(
      [System.Windows.Automation.AutomationElement]::NameProperty,
      $sel.name,
      [System.Windows.Automation.PropertyConditionFlags]::IgnoreCase
    )
  }
  
  if ($sel.automationId) {
    $conditions += New-Object System.Windows.Automation.PropertyCondition(
      [System.Windows.Automation.AutomationElement]::AutomationIdProperty,
      $sel.automationId
    )
  }
  
  if ($sel.controlType) {
    $typeMap = @{
      'Button'   = [System.Windows.Automation.ControlType]::Button
      'Edit'     = [System.Windows.Automation.ControlType]::Edit
      'ListItem' = [System.Windows.Automation.ControlType]::ListItem
      'Text'     = [System.Windows.Automation.ControlType]::Text
      'List'     = [System.Windows.Automation.ControlType]::List
      'MenuItem' = [System.Windows.Automation.ControlType]::MenuItem
      'CheckBox' = [System.Windows.Automation.ControlType]::CheckBox
      'ComboBox' = [System.Windows.Automation.ControlType]::ComboBox
    }
    if ($typeMap[$sel.controlType]) {
      $conditions += New-Object System.Windows.Automation.PropertyCondition(
        [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
        $typeMap[$sel.controlType]
      )
    }
  }
  
  if ($conditions.Count -eq 0) { return $null }
  
  $finalCondition = if ($conditions.Count -eq 1) {
    $conditions[0]
  }
  else {
    New-Object System.Windows.Automation.AndCondition($conditions)
  }
  
  return $root.FindFirst(
    [System.Windows.Automation.TreeScope]::Descendants,
    $finalCondition
  )
}

function Get-ElementTree($element, $currentDepth, $maxDepth) {
  if ($currentDepth -gt $maxDepth) { return $null }
  
  $info = @{
    name         = $element.Current.Name
    controlType  = $element.Current.ControlType.ProgrammaticName
    automationId = $element.Current.AutomationId
    value        = ''
  }
  
  try {
    $vp = $element.GetCurrentPattern(
      [System.Windows.Automation.ValuePattern]::Pattern
    )
    $info.value = $vp.Current.Value
  }
  catch {}
  
  $children = @()
  $walker = [System.Windows.Automation.TreeWalker]::ControlViewWalker
  $child = $walker.GetFirstChild($element)
  while ($child -ne $null) {
    $childTree = Get-ElementTree $child ($currentDepth + 1) $maxDepth
    if ($childTree) { $children += $childTree }
    $child = $walker.GetNextSibling($child)
  }
  
  if ($children.Count -gt 0) { $info.children = $children }
  return $info
}

try {
  $window = Get-AppWindow $appName
  if (-not $window) {
    Write-Output (@{ success = $false; error = "App '$appName' not found or not running" } | ConvertTo-Json -Compress)
    exit 0
  }

  switch ($action) {
    "focus_window" {
      $proc = Get-Process | Where-Object {
        $_.MainWindowHandle -ne 0 -and (
          $_.ProcessName -like "*$appName*" -or
          $_.MainWindowTitle -like "*$appName*"
        )
      } | Select-Object -First 1
      
      Add-Type @"
using System.Runtime.InteropServices;
public class WinFocus {
  [DllImport("user32.dll")] 
  public static extern bool SetForegroundWindow(System.IntPtr hWnd);
  [DllImport("user32.dll")]
  public static extern bool ShowWindow(System.IntPtr hWnd, int cmd);
}
"@ -ErrorAction SilentlyContinue
      
      [WinFocus]::ShowWindow($proc.MainWindowHandle, 9)
      Start-Sleep -Milliseconds 200
      [WinFocus]::SetForegroundWindow($proc.MainWindowHandle)
      
      Write-Output (@{ success = $true; result = "Focused $appName" } | ConvertTo-Json -Compress)
    }

    "find_and_click" {
      $el = Find-Element $window $selector
      if (-not $el) {
        Write-Output (@{ success = $false; error = "Element not found: $($selector | ConvertTo-Json -Compress)" } | ConvertTo-Json -Compress)
        exit 0
      }
      try {
        $pattern = $el.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)
        $pattern.Invoke()
      }
      catch {
        $el.SetFocus()
        Start-Sleep -Milliseconds 100
        Add-Type -AssemblyName System.Windows.Forms
        [System.Windows.Forms.SendKeys]::SendWait(' ')
      }
      Write-Output (@{ success = $true; result = "Clicked $($el.Current.Name)" } | ConvertTo-Json -Compress)
    }

    "find_and_type" {
      $el = Find-Element $window $selector
      if (-not $el) {
        Write-Output (@{ success = $false; error = "Element not found" } | ConvertTo-Json -Compress)
        exit 0
      }
      try {
        $pattern = $el.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern)
        $pattern.SetValue($value)
      }
      catch {
        $el.SetFocus()
        Start-Sleep -Milliseconds 100
        [System.Windows.Forms.SendKeys]::SendWait($value)
      }
      Write-Output (@{ success = $true; result = "Typed into $($el.Current.Name)" } | ConvertTo-Json -Compress)
    }

    "find_and_read" {
      $el = Find-Element $window $selector
      if (-not $el) {
        Write-Output (@{ success = $false; error = "Element not found" } | ConvertTo-Json -Compress)
        exit 0
      }
      $text = $el.Current.Name
      try {
        $pattern = $el.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern)
        $text = $pattern.Current.Value
      }
      catch {}
      Write-Output (@{ success = $true; result = $text } | ConvertTo-Json -Compress)
    }

    "get_window_tree" {
      $tree = Get-ElementTree $window 0 $depth
      Write-Output (@{ success = $true; result = $tree } | ConvertTo-Json -Compress -Depth 20)
    }

    "capture_window" {
      Add-Type @"
using System.Runtime.InteropServices;
public class WinRect {
  [DllImport("user32.dll")]
  public static extern bool GetWindowRect(System.IntPtr hWnd, out RECT r);
  public struct RECT { public int L, T, R, B; }
}
"@ -ErrorAction SilentlyContinue
      
      $proc = Get-Process | Where-Object {
        $_.MainWindowHandle -ne 0 -and (
          $_.ProcessName -like "*$appName*" -or
          $_.MainWindowTitle -like "*$appName*"
        )
      } | Select-Object -First 1
      
      $rect = New-Object WinRect+RECT
      [WinRect]::GetWindowRect($proc.MainWindowHandle, [ref]$rect)
      $w = $rect.R - $rect.L
      $h = $rect.B - $rect.T
      
      $bmp = New-Object System.Drawing.Bitmap($w, $h)
      $g = [System.Drawing.Graphics]::FromImage($bmp)
      $g.CopyFromScreen($rect.L, $rect.T, 0, 0, (New-Object System.Drawing.Size($w, $h)))
      
      $tmpPath = [System.IO.Path]::Combine($env:TEMP, "kairos_capture_$([System.Guid]::NewGuid().ToString('N')).png")
      $bmp.Save($tmpPath, [System.Drawing.Imaging.ImageFormat]::Png)
      $g.Dispose(); $bmp.Dispose()
      
      Write-Output (@{ success = $true; result = $tmpPath } | ConvertTo-Json -Compress)
    }

    default {
      Write-Output (@{ success = $false; error = "Unknown action: $action" } | ConvertTo-Json -Compress)
    }
  }
}
catch {
  Write-Output (@{ success = $false; error = $_.Exception.Message } | ConvertTo-Json -Compress)
}
