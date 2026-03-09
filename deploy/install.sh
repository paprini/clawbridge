#!/bin/bash
set -e

# Install openclaw-a2a as a systemd service
# Usage: sudo bash deploy/install.sh

INSTALL_DIR="/opt/openclaw-a2a"
SERVICE_USER="openclaw"

echo "Installing openclaw-a2a..."

# Create user if needed
if ! id "$SERVICE_USER" &>/dev/null; then
  useradd --system --no-create-home --shell /usr/sbin/nologin "$SERVICE_USER"
  echo "Created user: $SERVICE_USER"
fi

# Copy files
mkdir -p "$INSTALL_DIR"
cp -r src/ package.json package-lock.json "$INSTALL_DIR/"
mkdir -p "$INSTALL_DIR/config" "$INSTALL_DIR/logs"

# Install deps
cd "$INSTALL_DIR"
npm ci --omit=dev

# Set ownership
chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR"
chmod 600 "$INSTALL_DIR/config/peers.json" 2>/dev/null || true

# Install service
cp deploy/openclaw-a2a.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable openclaw-a2a

echo ""
echo "✅ Installed to $INSTALL_DIR"
echo ""
echo "Next steps:"
echo "  1. Create config: cd $INSTALL_DIR && npm run setup:auto"
echo "  2. Edit .env: nano $INSTALL_DIR/.env"
echo "  3. Start: sudo systemctl start openclaw-a2a"
echo "  4. Check: sudo systemctl status openclaw-a2a"
echo "  5. Logs: journalctl -u openclaw-a2a -f"
