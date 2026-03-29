#!/bin/bash
set -euo pipefail

REPO="cchiles/granola-cli"
INSTALL_DIR="/usr/local/bin"
BINARY_NAME="granola"

echo "Installing granola-cli..."

# Detect platform
OS="$(uname -s)"
ARCH="$(uname -m)"

if [ "$OS" != "Darwin" ]; then
  echo "error: only macOS is supported. Got: $OS" >&2
  exit 1
fi

if [ "$ARCH" != "arm64" ] && [ "$ARCH" != "x86_64" ]; then
  echo "error: unsupported architecture: $ARCH" >&2
  exit 1
fi

case "$ARCH" in
  x86_64) ARCH_LABEL="x64" ;;
  arm64)  ARCH_LABEL="arm64" ;;
esac

ASSET="granola-darwin-${ARCH_LABEL}"

# Download from latest release
DOWNLOAD_URL="https://github.com/${REPO}/releases/latest/download/${ASSET}"
TMPFILE="$(mktemp)"
trap 'rm -f "$TMPFILE"' EXIT

echo "Downloading ${ASSET}..."
if ! curl -fsSL -o "$TMPFILE" "$DOWNLOAD_URL"; then
  echo "error: download failed. Check https://github.com/${REPO}/releases" >&2
  exit 1
fi

chmod 755 "$TMPFILE"

# Verify it runs
if ! "$TMPFILE" --version &>/dev/null; then
  echo "error: downloaded binary is not valid" >&2
  exit 1
fi

# Install
if [ -w "$INSTALL_DIR" ]; then
  install -m 755 "$TMPFILE" "$INSTALL_DIR/$BINARY_NAME"
else
  echo "Installing to $INSTALL_DIR (requires sudo)..."
  sudo install -m 755 "$TMPFILE" "$INSTALL_DIR/$BINARY_NAME"
fi

echo ""
echo "Installed! Run 'granola --help' to verify."
echo ""
echo "To configure your API key, run:"
echo ""
echo "   granola config"
echo ""
