#!/usr/bin/env bash
# Cipher Toolkit — Linux/macOS 一键安装
# 用法: ./install.sh [dev|prod|docker]

set -euo pipefail
cd "$(dirname "$0")"

MODE="${1:-skip}"

echo ''
echo '=== 密码学工具箱 · 一键安装 ==='
echo ''

if ! command -v node >/dev/null 2>&1; then
  echo '未检测到 Node.js，请先安装 Node.js 22+：'
  echo '  https://nodejs.org/'
  exit 1
fi

echo "Node $(node -v) · npm $(npm -v)"
echo '正在安装依赖（根目录 + backend + frontend）...'
npm run install:all

echo ''
echo '安装完成。'
echo ''
echo '启动方式：'
echo '  开发模式   npm run dev              → http://localhost:5173'
echo '  生产单端口 npm run start:prod       → http://localhost:3001'
echo '  Docker     docker compose up --build'
echo '  详细文档   DEPLOY.md'
echo ''

if [[ "$MODE" == "skip" ]]; then
  read -r -p '输入 dev / prod / docker 立即启动（回车跳过）: ' choice || true
  MODE="${choice:-skip}"
fi

case "$MODE" in
  dev)    npm run dev ;;
  prod)   npm run start:prod ;;
  docker)
    if ! command -v docker >/dev/null 2>&1; then
      echo '未检测到 Docker'
      exit 1
    fi
    docker compose up --build
    ;;
esac
