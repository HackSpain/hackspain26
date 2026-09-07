#!/usr/bin/env sh
# Install the hackspain CLI:  curl -fsSL https://hackspain.com/install.sh | sh
# Env: HACKSPAIN_VERSION (default: latest), HACKSPAIN_INSTALL_DIR (default: ~/.local/bin)
set -eu

repo="HackSpain/hackspain26"
version="${HACKSPAIN_VERSION:-latest}"
install_dir="${HACKSPAIN_INSTALL_DIR:-$HOME/.local/bin}"

os="$(uname -s)"
arch="$(uname -m)"
case "$os" in
  Linux) os="linux" ;;
  Darwin) os="darwin" ;;
  *) echo "hackspain: unsupported OS '$os'. On Windows download hackspain-windows-x64.exe from https://github.com/$repo/releases" >&2; exit 1 ;;
esac
case "$arch" in
  x86_64 | amd64) arch="x64" ;;
  arm64 | aarch64) arch="arm64" ;;
  *) echo "hackspain: unsupported architecture '$arch'" >&2; exit 1 ;;
esac

asset="hackspain-$os-$arch"
if [ "$version" = "latest" ]; then
  base="https://github.com/$repo/releases/latest/download"
else
  base="https://github.com/$repo/releases/download/cli-v${version#cli-v}"
fi

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

echo "Downloading $asset ($version)…"
curl -fsSL "$base/$asset" -o "$tmp/hackspain"
curl -fsSL "$base/SHA256SUMS" -o "$tmp/SHA256SUMS"

expected="$(grep " $asset\$" "$tmp/SHA256SUMS" | cut -d' ' -f1)"
if [ -z "$expected" ]; then
  echo "hackspain: $asset not listed in SHA256SUMS" >&2; exit 1
fi
if command -v sha256sum >/dev/null 2>&1; then
  actual="$(sha256sum "$tmp/hackspain" | cut -d' ' -f1)"
else
  actual="$(shasum -a 256 "$tmp/hackspain" | cut -d' ' -f1)"
fi
if [ "$expected" != "$actual" ]; then
  echo "hackspain: checksum mismatch for $asset" >&2; exit 1
fi

mkdir -p "$install_dir"
chmod +x "$tmp/hackspain"
mv "$tmp/hackspain" "$install_dir/hackspain"
echo "Installed $install_dir/hackspain ($("$install_dir/hackspain" --version))"

case ":$PATH:" in
  *":$install_dir:"*) ;;
  *) echo "Add it to your PATH, e.g.:  export PATH=\"$install_dir:\$PATH\"" ;;
esac
echo "Next: hackspain auth login"
