<#
.SYNOPSIS
    Pre-PR & Pre-Push Quality Gate for InvestIQ.
    Chay toan bo cac buoc kiem tra giong het GitHub Actions CI truoc khi tao Pull Request hoac Push code.
#>

$ErrorActionPreference = "Stop"
$rootDir = (Get-Item $PSScriptRoot).Parent.FullName
Set-Location $rootDir

Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "   INVESTIQ LOCAL CI / PRE-PR QUALITY GATE          " -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan

$hasError = $false

# 1. Kiem tra Git Diff & Khoang trang (Whitespace check against dev)
Write-Host "`n[1/5] Kiem tra Git Diff Whitespace (git diff origin/dev --check)..." -ForegroundColor Yellow
try {
    $diffOutput = git diff origin/dev --check 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Loi khoang trang (trailing whitespace / blank lines):" -ForegroundColor Red
        Write-Host $diffOutput
        $hasError = $true
    } else {
        Write-Host "Git diff sach, khong co loi khoang trang." -ForegroundColor Green
    }
} catch {
    Write-Host "Khong the kiem tra diff voi origin/dev (hay chay git fetch origin dev)." -ForegroundColor Yellow
}

# 2. Frontend Lint
Write-Host "`n[2/5] Kiem tra Frontend Lint (ESLint)..." -ForegroundColor Yellow
try {
    npm --prefix frontend run lint
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Frontend Lint that bai!" -ForegroundColor Red
        $hasError = $true
    } else {
        Write-Host "Frontend Lint dat chuan." -ForegroundColor Green
    }
} catch {
    Write-Host "Frontend Lint gap ngoai le." -ForegroundColor Red
    $hasError = $true
}

# 3. Frontend Typecheck
Write-Host "`n[3/5] Kiem tra Frontend TypeScript Typecheck (tsc)..." -ForegroundColor Yellow
try {
    npm --prefix frontend run typecheck
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Frontend Typecheck that bai!" -ForegroundColor Red
        $hasError = $true
    } else {
        Write-Host "Frontend Typecheck dat chuan 0 loi." -ForegroundColor Green
    }
} catch {
    Write-Host "Frontend Typecheck gap ngoai le." -ForegroundColor Red
    $hasError = $true
}

# 4. Backend Lint & Typecheck (Ruff & Mypy)
Write-Host "`n[4/5] Kiem tra Backend Ruff & Mypy..." -ForegroundColor Yellow
$pyPath = "$rootDir\backend\.venv313\Scripts\python.exe"
if (-not (Test-Path $pyPath)) {
    $pyPath = "python"
}

try {
    Push-Location "$rootDir\backend"

    # Ruff
    Write-Host "  -> Chay ruff check ." -ForegroundColor Gray
    & $pyPath -m ruff check .
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Backend Ruff check that bai!" -ForegroundColor Red
        $hasError = $true
    } else {
        Write-Host "Backend Ruff dat chuan." -ForegroundColor Green
    }

    # Mypy
    Write-Host "  -> Chay mypy" -ForegroundColor Gray
    & $pyPath -m mypy
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Backend Mypy check that bai!" -ForegroundColor Red
        $hasError = $true
    } else {
        Write-Host "Backend Mypy dat chuan 0 loi type." -ForegroundColor Green
    }
} finally {
    Pop-Location
}

# 5. Backend Unit Tests (Cach ly moi truong nhu CI)
Write-Host "`n[5/5] Kiem tra Backend Unit Tests (Pytest)..." -ForegroundColor Yellow
try {
    Push-Location "$rootDir\backend"
    $envRenamed = $false
    if (Test-Path ".env") {
        Rename-Item ".env" ".env.gate.bak"
        $envRenamed = $true
    }
    try {
        & $pyPath -m pytest tests/unit/ -v --tb=short
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Backend Unit Tests that bai!" -ForegroundColor Red
            $hasError = $true
        } else {
            Write-Host "Backend Unit Tests passed 100%." -ForegroundColor Green
        }
    } finally {
        if ($envRenamed -and (Test-Path ".env.gate.bak")) {
            Rename-Item ".env.gate.bak" ".env"
        }
    }
} finally {
    Pop-Location
}

Write-Host "`n====================================================" -ForegroundColor Cyan
if ($hasError) {
    Write-Host "KET QUA: CO LOI CAN FIX TRUOC KHI PUSH / TAO PULL REQUEST!" -ForegroundColor Red
    exit 1
} else {
    Write-Host "KET QUA: TAT CA KIEM TRA DEU XANH (READY FOR PR / MERGE)!" -ForegroundColor Green
    exit 0
}
