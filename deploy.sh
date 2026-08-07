#\!/bin/bash
set -e

APP_NAME="new-api"
APP_DIR="/www/newapi"
BINARY="$APP_DIR/$APP_NAME"
SERVICE="newapi"

cd "$APP_DIR"

echo "=== 1/5 拉取最新代码 ==="
git pull origin main

echo "=== 2/5 构建前端 ==="
cd web/classic && bun install && bun run build
cd "$APP_DIR"/web/default && bun install && bun run build
cd "$APP_DIR"

echo "=== 3/5 编译 ==="
VERSION="$(git describe --tags --always --dirty 2>/dev/null || git rev-parse --short HEAD)"
echo "版本: $VERSION ($(date +%Y-%m-%d\ %H:%M:%S))"
go build -ldflags "-s -w -X 'github.com/QuantumNous/new-api/common.Version=$VERSION'" -o "$APP_NAME.tmp"
chmod +x "$APP_NAME.tmp"

echo "=== 4/5 替换并重启 ==="
mv "$APP_NAME.tmp" "$BINARY"
chown newapi:newapi "$BINARY"
systemctl restart "$SERVICE"

echo "=== 5/5 健康检查 ==="
sleep 2
if systemctl is-active --quiet "$SERVICE"; then
    echo "部署成功！版本: $VERSION"
    systemctl status "$SERVICE" --no-pager | head -5
else
    echo "\!\!\! 启动失败，查看日志排查 \!\!\!"
    journalctl -u "$SERVICE" --no-pager -n 20
fi
