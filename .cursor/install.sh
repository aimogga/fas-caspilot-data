#!/usr/bin/env bash
# Idempotent Cloud Agent install. System packages and the Supabase CLI live here
# so a build snapshot contains them. The Next.js app dependencies come from the lockfile.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

export DEBIAN_FRONTEND=noninteractive

if ! command -v docker >/dev/null 2>&1 || ! command -v fuse-overlayfs >/dev/null 2>&1; then
  sudo apt-get update
  sudo apt-get install -y -o Dpkg::Options::="--force-confold" \
    docker.io \
    docker-compose-v2 \
    fuse-overlayfs \
    iptables
fi

if ! id -nG ubuntu | grep -qw docker; then
  sudo usermod -aG docker ubuntu
fi

SUPABASE_VERSION="2.120.0"
installed_supabase="$(supabase --version 2>/dev/null || true)"
if [[ "$installed_supabase" != "$SUPABASE_VERSION" ]]; then
  deb="$(mktemp --suffix=.deb)"
  curl -fsSL -o "$deb" \
    "https://github.com/supabase/cli/releases/download/v${SUPABASE_VERSION}/supabase_${SUPABASE_VERSION}_linux_amd64.deb"
  sudo dpkg -i "$deb"
  rm -f "$deb"
fi

# Login shells find pnpm via nvm, which is not on the default PATH for every tool.
# Symlink the nvm binaries (not /exec-daemon/node) into /usr/local/bin.
if command -v pnpm >/dev/null 2>&1; then
  pnpm_bin="$(command -v pnpm)"
  node_bin="$(dirname "$pnpm_bin")/node"
  sudo ln -sfn "$pnpm_bin" /usr/local/bin/pnpm
  if [[ -x "$node_bin" ]]; then
    sudo ln -sfn "$node_bin" /usr/local/bin/node
  fi
fi

if ! command -v pnpm >/dev/null 2>&1; then
  corepack enable
  corepack prepare pnpm@10.33.3 --activate
fi

pnpm install --frozen-lockfile
