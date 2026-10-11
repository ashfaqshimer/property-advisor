<#
.SYNOPSIS
    Starts both the backend (FastAPI) and frontend (Next.js) dev servers concurrently.
.DESCRIPTION
    Runs:
      - Backend: uv run fastapi dev app/main.py (in backend/)
      - Frontend: pnpm dev (in frontend/)
    Logs are multiplexed in real-time with colored prefixes.
    Press Ctrl+C to cleanly terminate both processes.
#>

$ErrorActionPreference = "Stop"

$Root = $PSScriptRoot
$BackendDir = Join-Path $Root "backend"
$FrontendDir = Join-Path $Root "frontend"

# Ensure UTF-8 console output and Python UTF-8 encoding
try {
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
} catch {}

$env:PYTHONUTF8 = "1"
$env:PYTHONIOENCODING = "utf-8"
$env:PYTHONUNBUFFERED = "1"

# Check prerequisites
if (-not (Get-Command "uv" -ErrorAction SilentlyContinue)) {
    Write-Host "[error] 'uv' command was not found in PATH. Please install uv (https://docs.astral.sh/uv/)." -ForegroundColor Red
    exit 1
}

if (-not (Get-Command "pnpm" -ErrorAction SilentlyContinue)) {
    Write-Host "[error] 'pnpm' command was not found in PATH. Please install pnpm (https://pnpm.io/)." -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $BackendDir)) {
    Write-Host "[error] Backend directory not found at: $BackendDir" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $FrontendDir)) {
    Write-Host "[error] Frontend directory not found at: $FrontendDir" -ForegroundColor Red
    exit 1
}

Write-Host "==================================================" -ForegroundColor DarkGray
Write-Host " Starting Property Advisor Dev Servers" -ForegroundColor Cyan
Write-Host "   Backend:  http://localhost:8000" -ForegroundColor DarkCyan
Write-Host "   Frontend: http://localhost:3000" -ForegroundColor DarkMagenta
Write-Host " Press Ctrl+C to stop both servers." -ForegroundColor Yellow
Write-Host "==================================================" -ForegroundColor DarkGray

$processes = @()
$subscriptions = @()

function Start-PrefixedProcess {
    param (
        [string]$Name,
        [ConsoleColor]$Color,
        [string]$FileName,
        [string]$Arguments,
        [string]$WorkingDirectory
    )

    $psi = [System.Diagnostics.ProcessStartInfo]::new()
    $psi.FileName = $FileName
    $psi.Arguments = $Arguments
    $psi.WorkingDirectory = $WorkingDirectory
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true

    $psi.EnvironmentVariables["PYTHONUTF8"] = "1"
    $psi.EnvironmentVariables["PYTHONIOENCODING"] = "utf-8"
    $psi.EnvironmentVariables["PYTHONUNBUFFERED"] = "1"

    $proc = [System.Diagnostics.Process]::new()
    $proc.StartInfo = $psi
    $proc.EnableRaisingEvents = $true

    $subOutId = "$Name-Out-$(New-Guid)"
    $subErrId = "$Name-Err-$(New-Guid)"

    Register-ObjectEvent -InputObject $proc -EventName OutputDataReceived -SourceIdentifier $subOutId -Action {
        if ($EventArgs.Data) {
            Write-Host "[$($Event.MessageData.Name)] " -ForegroundColor $Event.MessageData.Color -NoNewline
            Write-Host $EventArgs.Data
        }
    } -MessageData @{ Name = $Name; Color = $Color } | Out-Null

    Register-ObjectEvent -InputObject $proc -EventName ErrorDataReceived -SourceIdentifier $subErrId -Action {
        if ($EventArgs.Data) {
            Write-Host "[$($Event.MessageData.Name)] " -ForegroundColor Red -NoNewline
            Write-Host $EventArgs.Data
        }
    } -MessageData @{ Name = $Name; Color = $Color } | Out-Null

    $null = $proc.Start()
    $proc.BeginOutputReadLine()
    $proc.BeginErrorReadLine()

    return @{
        Process     = $proc
        Name        = $Name
        Subscribers = @($subOutId, $subErrId)
    }
}

try {
    $backend = Start-PrefixedProcess -Name "backend" -Color Cyan -FileName "cmd.exe" -Arguments "/c uv run fastapi dev app/main.py" -WorkingDirectory $BackendDir
    $processes += $backend.Process
    $subscriptions += $backend.Subscribers

    $frontend = Start-PrefixedProcess -Name "frontend" -Color Magenta -FileName "cmd.exe" -Arguments "/c pnpm dev" -WorkingDirectory $FrontendDir
    $processes += $frontend.Process
    $subscriptions += $frontend.Subscribers

    while ($true) {
        if ($backend.Process.HasExited) {
            Write-Host "`n[backend] Process exited with code $($backend.Process.ExitCode)." -ForegroundColor Yellow
            break
        }
        if ($frontend.Process.HasExited) {
            Write-Host "`n[frontend] Process exited with code $($frontend.Process.ExitCode)." -ForegroundColor Yellow
            break
        }
        Start-Sleep -Milliseconds 250
    }
}
finally {
    Write-Host "`nStopping servers..." -ForegroundColor Yellow

    foreach ($sub in $subscriptions) {
        Unregister-Event -SourceIdentifier $sub -ErrorAction SilentlyContinue
    }

    foreach ($proc in $processes) {
        if ($proc -and -not $proc.HasExited) {
            # Gracefully and forcefully terminate the process tree on Windows
            Start-Process -FilePath "taskkill.exe" -ArgumentList "/PID $($proc.Id) /T /F" -NoNewWindow -Wait -ErrorAction SilentlyContinue
        }
    }

    Write-Host "All servers stopped." -ForegroundColor Green
}
