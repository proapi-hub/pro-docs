#!/usr/bin/env bash
# 服务器首次部署引导脚本
# 用法：在服务器上 root 身份执行一次
set -euo pipefail

DEPLOY_DIR="/opt/pro-docs"
COMPOSE_FILE_URL="${COMPOSE_FILE_URL:-https://raw.githubusercontent.com/Prorise-cool/pro-docs/main/docker-compose.yml}"

echo "[1/4] 准备部署目录 $DEPLOY_DIR"
mkdir -p "$DEPLOY_DIR"
cd "$DEPLOY_DIR"

echo "[2/4] 写入 docker-compose.yml"
curl -fsSL "$COMPOSE_FILE_URL" -H "Authorization: Bearer ${GHCR_TOKEN}" -o docker-compose.yml || {
  echo "公网拉取失败，尝试无 token 拉取（仓库可能未公开）"
  curl -fsSL "$COMPOSE_FILE_URL" -o docker-compose.yml
}

echo "[3/4] 登录 GHCR 拉取私有镜像"
echo "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USER" --password-stdin

echo "[4/4] 启动容器"
docker compose pull
docker compose up -d --remove-orphans

echo
echo "✅ 部署完成。容器监听 127.0.0.1:3210，请到 1Panel 配置反向代理 → $1"
docker compose ps
