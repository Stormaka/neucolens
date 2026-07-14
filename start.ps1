# NEU-CodeLens Skills Lab — Start Script
# Khởi động Backend (port 3001) và Frontend (port 5173)

Write-Host "`n🚀 NEU-CodeLens Skills Lab — Khởi động hệ thống..." -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`n" -ForegroundColor DarkGray

# Start Backend
Write-Host "🟡 Khởi động Backend (Express + SQLite)..." -ForegroundColor Yellow
$backend = Start-Process powershell -ArgumentList "-ExecutionPolicy Bypass -Command `"cd '$PSScriptRoot\backend'; node server.js`"" -PassThru -WindowStyle Normal
Write-Host "   ✅ Backend PID: $($backend.Id) → http://localhost:3001/api/health" -ForegroundColor Green

Start-Sleep -Seconds 2

# Start Frontend
Write-Host "🟡 Khởi động Frontend (Vite + React)..." -ForegroundColor Yellow
$frontend = Start-Process powershell -ArgumentList "-ExecutionPolicy Bypass -Command `"cd '$PSScriptRoot\frontend'; npm run dev -- --host`"" -PassThru -WindowStyle Normal
Write-Host "   ✅ Frontend PID: $($frontend.Id) → http://localhost:5173" -ForegroundColor Green

Start-Sleep -Seconds 3

# Open browser
Write-Host "`n🌐 Mở trình duyệt..." -ForegroundColor Cyan
Start-Process "http://localhost:5173"

Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
Write-Host "📋 Tài khoản demo:" -ForegroundColor White
Write-Host "   👨‍🏫 Giảng viên: teacher@neu.edu.vn / teacher123" -ForegroundColor Cyan
Write-Host "   🚀 SV Giỏi:    an@neu.edu.vn / student123" -ForegroundColor Green
Write-Host "   ⚠️  SV At-Risk:  tuan@neu.edu.vn / student123" -ForegroundColor Yellow
Write-Host "   🤖 SV AI-Warn: son@neu.edu.vn / student123" -ForegroundColor Magenta
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`n" -ForegroundColor DarkGray
Write-Host "Nhấn Ctrl+C để dừng..." -ForegroundColor DarkGray

# Keep script running
while ($true) { Start-Sleep -Seconds 30 }
