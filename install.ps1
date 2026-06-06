# Cipher Toolkit — Windows 一键安装
# 用法: .\install.ps1 [-Mode dev|prod|docker]

param(
    [ValidateSet('dev', 'prod', 'docker', 'skip')]
    [string]$Mode = 'skip'
)

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

Write-Host ''
Write-Host '=== 密码学工具箱 · 一键安装 ===' -ForegroundColor Cyan
Write-Host ''

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host '未检测到 Node.js，请先安装 Node.js 22+：' -ForegroundColor Red
    Write-Host '  https://nodejs.org/' -ForegroundColor Yellow
    exit 1
}

$nodeVer = (node -p "process.versions.node.split('.')[0]")
if ([int]$nodeVer -lt 20) {
    Write-Host "Node 版本过低 ($(node -v))，建议 22+" -ForegroundColor Yellow
}

Write-Host "Node $(node -v) · npm $(npm -v)"
Write-Host '正在安装依赖（根目录 + backend + frontend）...'
npm run install:all
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ''
Write-Host '安装完成。' -ForegroundColor Green
Write-Host ''
Write-Host '启动方式：'
Write-Host '  开发模式   npm run dev              → http://localhost:5173'
Write-Host '  生产单端口 npm run start:prod       → http://localhost:3001'
Write-Host '  Docker     docker compose up --build'
Write-Host '  详细文档   DEPLOY.md'
Write-Host ''

if ($Mode -eq 'skip') {
    $choice = Read-Host '输入 dev / prod / docker 立即启动（回车跳过）'
    if ($choice) { $Mode = $choice.Trim().ToLower() }
}

switch ($Mode) {
    'dev'    { npm run dev }
    'prod'   { npm run start:prod }
    'docker' {
        if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
            Write-Host '未检测到 Docker，请先安装 Docker Desktop' -ForegroundColor Red
            exit 1
        }
        docker compose up --build
    }
    default { }
}
