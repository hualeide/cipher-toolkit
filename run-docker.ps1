# 一键运行（GitHub Packages 预构建镜像，仅需 Docker）
# Windows: .\run-docker.ps1
# Linux/macOS: ./run-docker.sh

$ErrorActionPreference = 'Stop'

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host '请先安装 Docker Desktop: https://www.docker.com/products/docker-desktop/' -ForegroundColor Red
    exit 1
}

$ComposeFile = Join-Path $PSScriptRoot 'docker-compose.ghcr.yml'
Write-Host '拉取 ghcr.io/hualeide/cipher-toolkit:latest ...' -ForegroundColor Cyan
docker compose -f $ComposeFile pull
docker compose -f $ComposeFile up -d

Write-Host ''
Write-Host '已启动 → http://localhost:3001' -ForegroundColor Green
Write-Host '停止: docker compose -f docker-compose.ghcr.yml down'
