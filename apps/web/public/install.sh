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
download() {
  file="$1"
  destination="$2"
  if status="$(curl -fsSL -w '%{http_code}' "$base/$file" -o "$destination" 2>/dev/null)"; then
    return
  fi
  if [ "$status" = "404" ]; then
    echo "hackspain: $file was not found (HTTP 404). Check the release and HACKSPAIN_VERSION at https://github.com/$repo/releases" >&2
  else
    echo "hackspain: could not download $file (HTTP ${status:-unknown})." >&2
  fi
  exit 1
}

download "$asset" "$tmp/hackspain"
download SHA256SUMS "$tmp/SHA256SUMS"

expected="$(awk -v asset="$asset" '$2 == asset { print $1; exit }' "$tmp/SHA256SUMS")"
if [ -z "$expected" ]; then
  echo "hackspain: $asset not listed in SHA256SUMS" >&2; exit 1
fi
if command -v sha256sum >/dev/null 2>&1; then
  actual="$(sha256sum "$tmp/hackspain" | cut -d' ' -f1)"
elif command -v shasum >/dev/null 2>&1; then
  actual="$(shasum -a 256 "$tmp/hackspain" | cut -d' ' -f1)"
else
  echo "hackspain: SHA-256 verification needs sha256sum or shasum; install one and retry." >&2
  exit 1
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
  *)
    case "${SHELL:-}" in
      */zsh) rc_file="$HOME/.zshrc" ;;
      */bash)
        if [ "$os" = "darwin" ]; then rc_file="$HOME/.bash_profile"
        else rc_file="$HOME/.bashrc"; fi
        ;;
      */fish) rc_file="$HOME/.config/fish/config.fish" ;;
      *) rc_file="$HOME/.profile" ;;
    esac
    echo "Add $install_dir to your PATH in $rc_file:"
    case "${SHELL:-}" in
      */fish) echo "  fish_add_path \"$install_dir\"" ;;
      *) echo "  export PATH=\"$install_dir:\$PATH\"" ;;
    esac
    ;;
esac
echo "Next: hackspain auth login"
