$p = Get-Process electron -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -like '*MBE Desktop*' }
if ($p) {
    taskkill /F /PID $p.Id /T 2>&1 | Out-Null
    Write-Host "Killed MBE Desktop (PID $($p.Id))"
} else {
    Write-Host "MBE Desktop not running"
}
exit 0
