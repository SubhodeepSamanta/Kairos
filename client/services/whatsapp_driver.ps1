param (
    [Parameter(Mandatory=$true)]
    [string]$action, # "ensure_open", "search_contact", "send_text", "status_tab", "screenshot", "click"
    
    [string]$contactName = "",
    [string]$message = "",
    [int]$clickX = 0,
    [int]$clickY = 0
)

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# Win32 API declaration
$win32Code = @"
using System;
using System.Runtime.InteropServices;
public class Win32 {
    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
    
    [StructLayout(LayoutKind.Sequential)]
    public struct RECT {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool IsIconic(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [DllImport("user32.dll")]
    public static extern void mouse_event(int dwFlags, int dx, int dy, int cButtons, int dwExtraInfo);
    
    public const int MOUSEEVENTF_LEFTDOWN = 0x02;
    public const int MOUSEEVENTF_LEFTUP = 0x04;
}
"@
Add-Type -TypeDefinition $win32Code -ErrorAction SilentlyContinue

# Find WhatsApp process with a main window (handles WhatsApp.Root and WhatsApp)
function Get-WhatsAppProcess {
    return Get-Process -Name "WhatsApp*" -ErrorAction SilentlyContinue | 
           Where-Object { $_.MainWindowHandle -ne 0 } | 
           Select-Object -First 1
}

# Escape special characters for Wscript.Shell SendKeys
function Escape-SendKeys {
    param([string]$str)
    if (-not $str) { return "" }
    $escaped = ""
    foreach ($char in $str.ToCharArray()) {
        $c = [string]$char
        if ($c -in '+', '^', '%', '~', '(', ')', '[', ']', '{', '}') {
            $escaped += "{$c}"
        } else {
            $escaped += $c
        }
    }
    return $escaped
}

# Ensure WhatsApp is open, active, and focused using standard Win32 ShowWindow and title-bar focus click
function Ensure-WhatsApp {
    $proc = Get-WhatsAppProcess
    if (-not $proc) {
        Start-Process "whatsapp:"
        $timeout = 15
        $elapsed = 0
        while ($elapsed -lt $timeout) {
            $proc = Get-WhatsAppProcess
            if ($proc -and $proc.Responding) {
                break
            }
            Start-Sleep -Milliseconds 500
            $elapsed += 0.5
        }
    }
    
    if (-not $proc) {
        Write-Error "WhatsApp failed to load."
        exit 1
    }

    # If the active foreground window belongs to the WhatsApp process, skip focusing to avoid stealing text cursor focus
    $fgWindow = [Win32]::GetForegroundWindow()
    $fgPid = 0
    [void][Win32]::GetWindowThreadProcessId($fgWindow, [ref]$fgPid)
    if ($fgPid -eq $proc.Id) {
        return $proc
    }

    # 1. Restore window if minimized, otherwise show it in its current state
    if ([Win32]::IsIconic($proc.MainWindowHandle)) {
        [void][Win32]::ShowWindow($proc.MainWindowHandle, 9) # 9 = SW_RESTORE
        Start-Sleep -Milliseconds 300
    } else {
        [void][Win32]::ShowWindow($proc.MainWindowHandle, 5) # 5 = SW_SHOW
        Start-Sleep -Milliseconds 100
    }

    # 2. Set foreground window
    [void][Win32]::SetForegroundWindow($proc.MainWindowHandle)
    Start-Sleep -Milliseconds 200

    # 3. Simulate mouse click in the center of the title bar area to force active keyboard focus
    $rect = New-Object Win32+RECT
    if ([Win32]::GetWindowRect($proc.MainWindowHandle, [ref]$rect)) {
        $width = $rect.Right - $rect.Left
        if ($width -gt 150) {
            $clickX = $rect.Left + ($width / 2)
            $clickY = $rect.Top + 15
            
            # Save current cursor position to restore it later
            $oldPos = [System.Windows.Forms.Cursor]::Position
            
            [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($clickX, $clickY)
            Start-Sleep -Milliseconds 100
            [Win32]::mouse_event([Win32]::MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0)
            Start-Sleep -Milliseconds 100
            [Win32]::mouse_event([Win32]::MOUSEEVENTF_LEFTUP, 0, 0, 0, 0)
            
            # Restore cursor position
            [System.Windows.Forms.Cursor]::Position = $oldPos
            Start-Sleep -Milliseconds 300
        }
    }
    
    return $proc
}

# Run requested actions
try {
    switch ($action) {
        "ensure_open" {
            $proc = Ensure-WhatsApp
            Write-Output "WhatsApp is ready. HWND: $($proc.MainWindowHandle)"
        }

        "search_contact" {
            $proc = Ensure-WhatsApp
            $wshell = New-Object -ComObject Wscript.Shell
            
            # Ctrl+F to search
            $wshell.SendKeys('^f')
            Start-Sleep -Milliseconds 400
            
            # Clear search box using Ctrl+A and Backspace
            $wshell.SendKeys('^a')
            Start-Sleep -Milliseconds 200
            $wshell.SendKeys('{BACKSPACE}')
            Start-Sleep -Milliseconds 200
            
            # Type contact name (escaped to support parentheses/spaces properly)
            $escapedContact = Escape-SendKeys $contactName
            $wshell.SendKeys($escapedContact)
            Start-Sleep -Seconds 2
            
            # Take screenshot of the filtered search results list
            $handle = $proc.MainWindowHandle
            $rect = New-Object Win32+RECT
            if ([Win32]::GetWindowRect($handle, [ref]$rect)) {
                $width = $rect.Right - $rect.Left
                $height = $rect.Bottom - $rect.Top
                
                if ($width -le 0 -or $height -le 0) {
                    Write-Error "WhatsApp window is minimized or not renderable."
                    exit 1
                }

                $bmp = New-Object System.Drawing.Bitmap $width, $height
                $graphics = [System.Drawing.Graphics]::FromImage($bmp)
                $graphics.CopyFromScreen($rect.Left, $rect.Top, 0, 0, (New-Object System.Drawing.Size($width, $height)))
                
                $scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
                $screenshotPath = Join-Path $scriptPath "temp_whatsapp.png"
                $bmp.Save($screenshotPath, [System.Drawing.Imaging.ImageFormat]::Png)
                
                $graphics.Dispose()
                $bmp.Dispose()
                
                Write-Output "bounds:L=$($rect.Left),T=$($rect.Top),W=$width,H=$height"
                Write-Output "path:$screenshotPath"
            } else {
                Write-Error "Failed to retrieve WhatsApp window boundaries."
                exit 1
            }
        }

        "select_contact" {
            $proc = Ensure-WhatsApp
            $rect = New-Object Win32+RECT
            if ([Win32]::GetWindowRect($proc.MainWindowHandle, [ref]$rect)) {
                $clickX = $rect.Left + 200
                $clickY = $rect.Top + 230
                
                $oldPos = [System.Windows.Forms.Cursor]::Position
                [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($clickX, $clickY)
                Start-Sleep -Milliseconds 100
                [Win32]::mouse_event([Win32]::MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0)
                Start-Sleep -Milliseconds 100
                [Win32]::mouse_event([Win32]::MOUSEEVENTF_LEFTUP, 0, 0, 0, 0)
                
                [System.Windows.Forms.Cursor]::Position = $oldPos
                Start-Sleep -Seconds 1
                Write-Output "Selected first search result."
            } else {
                Write-Error "Failed to get window bounds for select_contact."
                exit 1
            }
        }

        "send_text" {
            $proc = Ensure-WhatsApp
            
            # Focus the message input box directly using a target coordinate click
            $rect = New-Object Win32+RECT
            if ([Win32]::GetWindowRect($proc.MainWindowHandle, [ref]$rect)) {
                $width = $rect.Right - $rect.Left
                if ($width -gt 500) {
                    $clickX = $rect.Left + ($width / 2) + 100
                    $clickY = $rect.Bottom - 40
                    
                    $oldPos = [System.Windows.Forms.Cursor]::Position
                    [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($clickX, $clickY)
                    Start-Sleep -Milliseconds 100
                    [Win32]::mouse_event([Win32]::MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0)
                    Start-Sleep -Milliseconds 100
                    [Win32]::mouse_event([Win32]::MOUSEEVENTF_LEFTUP, 0, 0, 0, 0)
                    
                    # Restore cursor position
                    [System.Windows.Forms.Cursor]::Position = $oldPos
                    Start-Sleep -Milliseconds 200
                }
            }
            
            $wshell = New-Object -ComObject Wscript.Shell
            # Type and send message (escaped to handle formatting keys)
            $escapedMsg = Escape-SendKeys $message
            $wshell.SendKeys($escapedMsg)
            Start-Sleep -Milliseconds 300
            $wshell.SendKeys('{ENTER}')
            Write-Output "Sent message."
        }

        "status_tab" {
            $proc = Ensure-WhatsApp
            $wshell = New-Object -ComObject Wscript.Shell
            
            # Navigate to status tab (Ctrl+3 is standard for status UWP)
            $wshell.SendKeys('^3')
            Start-Sleep -Seconds 1
            Write-Output "Navigated to status tab."
        }

        "screenshot" {
            $proc = Ensure-WhatsApp
            $handle = $proc.MainWindowHandle
            
            # Get window coordinates
            $rect = New-Object Win32+RECT
            if ([Win32]::GetWindowRect($handle, [ref]$rect)) {
                $width = $rect.Right - $rect.Left
                $height = $rect.Bottom - $rect.Top
                
                # Check for minimized window bounds
                if ($width -le 0 -or $height -le 0) {
                    Write-Error "WhatsApp window is minimized or not renderable."
                    exit 1
                }

                # Capture window region
                $bmp = New-Object System.Drawing.Bitmap $width, $height
                $graphics = [System.Drawing.Graphics]::FromImage($bmp)
                $graphics.CopyFromScreen($rect.Left, $rect.Top, 0, 0, (New-Object System.Drawing.Size($width, $height)))
                
                # Save screenshot to file
                $scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
                $screenshotPath = Join-Path $scriptPath "temp_whatsapp.png"
                $bmp.Save($screenshotPath, [System.Drawing.Imaging.ImageFormat]::Png)
                
                $graphics.Dispose()
                $bmp.Dispose()
                
                # Return paths and bounds
                Write-Output "bounds:L=$($rect.Left),T=$($rect.Top),W=$width,H=$height"
                Write-Output "path:$screenshotPath"
            } else {
                Write-Error "Failed to retrieve WhatsApp window boundaries."
                exit 1
            }
        }

        "click" {
            # Move cursor and simulate left click
            [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($clickX, $clickY)
            Start-Sleep -Milliseconds 100
            [Win32]::mouse_event([Win32]::MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0)
            Start-Sleep -Milliseconds 100
            [Win32]::mouse_event([Win32]::MOUSEEVENTF_LEFTUP, 0, 0, 0, 0)
            Write-Output "Clicked at ($clickX, $clickY)"
        }

        "capture_full_screen" {
            # Capture the entire primary screen
            $screen = [System.Windows.Forms.Screen]::PrimaryScreen
            $bounds = $screen.Bounds
            $width = $bounds.Width
            $height = $bounds.Height
            
            $bmp = New-Object System.Drawing.Bitmap $width, $height
            $graphics = [System.Drawing.Graphics]::FromImage($bmp)
            $graphics.CopyFromScreen($bounds.X, $bounds.Y, 0, 0, $bounds.Size)
            
            $scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
            $screenshotPath = Join-Path $scriptPath "temp_screen.png"
            $bmp.Save($screenshotPath, [System.Drawing.Imaging.ImageFormat]::Png)
            
            $graphics.Dispose()
            $bmp.Dispose()
            
            Write-Output "path:$screenshotPath"
        }

        default {
            Write-Error "Unknown driver action: $action"
            exit 1
        }
    }
} catch {
    Write-Error "Driver automation failed: $_"
    exit 1
}
