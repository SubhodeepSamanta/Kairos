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

# Win32 API declarations
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
    public static extern void mouse_event(int dwFlags, int dx, int dy, int cButtons, int dwExtraInfo);
    
    public const int MOUSEEVENTF_LEFTDOWN = 0x02;
    public const int MOUSEEVENTF_LEFTUP = 0x04;
}
"@
Add-Type -TypeDefinition $win32Code -ErrorAction SilentlyContinue

# Find WhatsApp process with a main window
function Get-WhatsAppProcess {
    return Get-Process -Name "WhatsApp" -ErrorAction SilentlyContinue | 
           Where-Object { $_.MainWindowHandle -ne 0 } | 
           Select-Object -First 1
}

# Ensure WhatsApp is open, active, and responsive
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

    # Bring to foreground
    [void][Win32]::SetForegroundWindow($proc.MainWindowHandle)
    Start-Sleep -Milliseconds 600
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
            
            # Type contact name
            $wshell.SendKeys($contactName)
            Start-Sleep -Seconds 2
            
            # Highlight and select
            $wshell.SendKeys('{DOWN}')
            Start-Sleep -Milliseconds 400
            $wshell.SendKeys('{ENTER}')
            Start-Sleep -Seconds 1
            Write-Output "Opened chat with $contactName"
        }

        "send_text" {
            $proc = Ensure-WhatsApp
            $wshell = New-Object -ComObject Wscript.Shell
            
            # Type and send message
            $wshell.SendKeys($message)
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

        default {
            Write-Error "Unknown driver action: $action"
            exit 1
        }
    }
} catch {
    Write-Error "Driver automation failed: $_"
    exit 1
}
