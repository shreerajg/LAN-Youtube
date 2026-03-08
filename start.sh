#!/bin/bash
set -e

echo ""
echo "  =============================================="
echo "    PHANTOM — Local Media Server"
echo "  =============================================="
echo ""

# Check dependencies
command -v python3 >/dev/null 2>&1 || { echo "[ERROR] python3 not found."; exit 1; }
command -v node    >/dev/null 2>&1 || { echo "[ERROR] node not found."; exit 1; }
command -v ffmpeg  >/dev/null 2>&1 || echo "[WARN] ffmpeg not found. Thumbnails disabled."

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Install Python deps
echo "[1/3] Installing Python dependencies..."
cd "$SCRIPT_DIR/backend"
pip3 install -r requirements.txt -q
pip3 install pystray Pillow -q

# Build frontend
echo "[2/3] Building frontend..."
cd "$SCRIPT_DIR/frontend"
[ ! -d "node_modules" ] && npm install --silent
npm run build

# Start server in system tray
echo "[3/3] Starting PHANTOM server in System Tray..."
echo ""
cd "$SCRIPT_DIR"
# Use python3 to run the system tray launcher silently
nohup python3 launcher.pyw > /dev/null 2>&1 &
echo "Started in background. Look for the tray icon."
