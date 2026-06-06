#!/usr/bin/env bash
# 一键运行（GitHub Packages 预构建镜像，仅需 Docker）
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v docker >/dev/null 2>&1; then
  echo '请先安装 Docker: https://docs.docker.com/get-docker/'
  exit 1
fi

echo '拉取 ghcr.io/hualeide/cipher-toolkit:latest ...'
docker compose -f docker-compose.ghcr.yml pull
docker compose -f docker-compose.ghcr.yml up -d

echo ''
echo '已启动 → http://localhost:3001'
echo '停止: docker compose -f docker-compose.ghcr.yml down'
