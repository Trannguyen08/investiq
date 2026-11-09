<#
.SYNOPSIS
    Deploy Setup & Cloud Configuration Generator for InvestIQ
    Ho tro cau hinh va trien khai he thong theo Phuong an 1 (Vercel + Koyeb/Render + Neon.tech)
#>

$ErrorActionPreference = "Stop"
$rootDir = (Get-Item $PSScriptRoot).Parent.FullName
Set-Location $rootDir

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   INVESTIQ CLOUD DEPLOYMENT SETUP (Vercel + Koyeb + Neon) " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Kiem tra cac cong cu CLI san co
Write-Host "`n[1/4] Kiem tra cong cu CLI tren may..." -ForegroundColor Yellow

$prevEap = $ErrorActionPreference
$ErrorActionPreference = "SilentlyContinue"

$vercelVer = (vercel --version 2>$null)
if ($LASTEXITCODE -eq 0 -and $vercelVer) {
    Write-Host "  -> Vercel CLI: SAN SANG (version: $vercelVer)" -ForegroundColor Green
} else {
    Write-Host "  -> Vercel CLI: Chua cai dat hoac chua san sang (cai bang 'npm i -g vercel')" -ForegroundColor DarkYellow
}

$neonVer = (neonctl --version 2>$null)
if ($LASTEXITCODE -eq 0 -and $neonVer) {
    Write-Host "  -> Neon CLI: SAN SANG (version: $neonVer)" -ForegroundColor Green
} else {
    Write-Host "  -> Neon CLI: Chua cai dat (cai bang 'npm i -g neonctl')" -ForegroundColor DarkYellow
}

$ErrorActionPreference = $prevEap

# 2. Sinh cac Key bao mat ngau nhien cho Production (neu can)
Write-Host "`n[2/4] Sinh bo khoa ma hoa & secret an toan cho Production..." -ForegroundColor Yellow

function New-CryptoSecret([int]$bytes = 32) {
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $data = New-Object byte[] $bytes
    $rng.GetBytes($data)
    return [Convert]::ToBase64String($data).TrimEnd('=').Replace('/', '_').Replace('+', '-')
}

function New-FernetKey {
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $data = New-Object byte[] 32
    $rng.GetBytes($data)
    return [Convert]::ToBase64String($data)
}

$secretKey = New-CryptoSecret 32
$bffSecret = New-CryptoSecret 36
$jwtSecret = New-CryptoSecret 36
$otpHmac = New-CryptoSecret 36
$sessionKey = New-CryptoSecret 32
$fernetKey = New-FernetKey
$adminSecret = New-CryptoSecret 32

Write-Host "  -> Da tao bo key ngau nhien dat chuan cryptographic security." -ForegroundColor Green

# 3. Mau bien moi truong cho Backend (Koyeb / Render)
Write-Host "`n[3/4] Danh sach bien moi truong cho BACKEND (Koyeb / Render):" -ForegroundColor Cyan
Write-Host @"
--------------------------------------------------------------------------------
APP_ENV=production
PORT=8000
DATABASE_URL=<CHUOI_KET_NOI_NEON_POSTGRESQL>?sslmode=require
AUTO_MIGRATE=true
SECRET_KEY=$secretKey
AUTH_ENABLED=true
AUTH_BFF_SECRET=$bffSecret
AUTH_JWT_SECRET=$jwtSecret
AUTH_OTP_HMAC_KEY=$otpHmac
AUTH_SESSION_ENCRYPTION_KEY=$sessionKey
AUTH_PAYLOAD_ENCRYPTION_KEY=$fernetKey
MARKET_DATA_MODE=vnstock
NEWS_INGESTION_ENABLED=false
BACKEND_CORS_ORIGINS=http://localhost:3000
--------------------------------------------------------------------------------
"@ -ForegroundColor Gray

# 4. Mau bien moi truong cho Frontend (Vercel)
Write-Host "[4/4] Danh sach bien moi truong cho FRONTEND (Vercel):" -ForegroundColor Cyan
Write-Host @"
--------------------------------------------------------------------------------
NODE_ENV=production
API_INTERNAL_BASE_URL=https://<TEN-BACKEND>.koyeb.app/api
INTERNAL_API_URL=https://<TEN-BACKEND>.koyeb.app/api
NEXT_PUBLIC_API_URL=/api
NEXT_PUBLIC_MARKET_WS_URL=wss://<TEN-BACKEND>.koyeb.app/ws/v1/market
AUTH_BFF_SECRET=$bffSecret
AUTH_SESSION_ENCRYPTION_KEY=$sessionKey
ADMIN_UI_PASSWORD=Admin@InvestIQ2026!
ADMIN_SESSION_SECRET=$adminSecret
--------------------------------------------------------------------------------
"@ -ForegroundColor Gray

Write-Host "Hoan tat chuan bi. Xem huong dan chi tiet tung buoc tai docs/deploy-vercel-koyeb.md" -ForegroundColor Green
