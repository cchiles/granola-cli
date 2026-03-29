#!/bin/bash
set -euo pipefail

REPO="cchiles/granola-cli"
BINARY_NAME="granola"

# Determine install directory: env override > /usr/local/bin (if writable) > ~/.local/bin
if [ -n "${GRANOLA_INSTALL_DIR:-}" ]; then
  INSTALL_DIR="$GRANOLA_INSTALL_DIR"
elif [ -w /usr/local/bin ]; then
  INSTALL_DIR="/usr/local/bin"
else
  INSTALL_DIR="$HOME/.local/bin"
fi

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
mkdir -p "$INSTALL_DIR"
install -m 755 "$TMPFILE" "$INSTALL_DIR/$BINARY_NAME"

echo ""
echo "Installed to $INSTALL_DIR/$BINARY_NAME"

# Check if INSTALL_DIR is in PATH
case ":$PATH:" in
  *":$INSTALL_DIR:"*) ;;
  *)
    echo ""
    echo "WARNING: $INSTALL_DIR is not in your PATH."
    echo "Add it by running:"
    echo ""
    echo "  export PATH=\"$INSTALL_DIR:\$PATH\""
    echo ""
    echo "Or add that line to your ~/.zshrc or ~/.bashrc."
    ;;
esac

echo ""
echo "Run 'granola --help' to verify."
echo ""
echo "To configure your API key, run:"
echo ""
echo "   granola config"
echo ""
