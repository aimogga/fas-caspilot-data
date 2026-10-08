#!/usr/bin/env bash
# Boot-time services. Docker and Supabase containers do not survive a snapshot,
# so they start here. Safe to run more than once.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

if [[ -f /exec-daemon/tmux.portal.conf ]]; then
  TMUX=(tmux -f /exec-daemon/tmux.portal.conf)
else
  TMUX=(tmux)
fi

sudo mkdir -p /etc/docker
if [[ ! -f /etc/docker/daemon.json ]]; then
  sudo tee /etc/docker/daemon.json >/dev/null <<'EOF'
{
  "features": { "containerd-snapshotter": false },
  "storage-driver": "fuse-overlayfs",
  "iptables": true
}
EOF
fi

sudo update-alternatives --set iptables /usr/sbin/iptables-legacy
sudo update-alternatives --set ip6tables /usr/sbin/ip6tables-legacy

if ! docker info >/dev/null 2>&1; then
  if ! "${TMUX[@]}" has-session -t dockerd 2>/dev/null; then
    "${TMUX[@]}" new-session -d -s dockerd -- \
      "sudo dockerd --host=unix:///var/run/docker.sock >> /tmp/dockerd.log 2>&1"
  fi
  ready=0
  for _ in $(seq 1 60); do
    if docker info >/dev/null 2>&1; then
      ready=1
      break
    fi
    # The socket is root-only until the ubuntu user is in the docker group
    # for this login. chmod keeps supabase start working on the same boot.
    if [[ -S /var/run/docker.sock ]]; then
      sudo chmod 666 /var/run/docker.sock || true
    fi
    sleep 1
  done
  if [[ "$ready" -ne 1 ]]; then
    echo "dockerd did not become ready; see /tmp/dockerd.log" >&2
    exit 1
  fi
fi

if [[ -S /var/run/docker.sock ]]; then
  sudo chmod 666 /var/run/docker.sock || true
fi

# Local keys are printed by the CLI. Keep them out of the boot log.
supabase start >> /tmp/supabase-start.log 2>&1

if ! "${TMUX[@]}" has-session -t web 2>/dev/null; then
  "${TMUX[@]}" new-session -d -s web -- \
    "cd /workspace && pnpm dev >> /tmp/web.log 2>&1"
fi

ready=0
for _ in $(seq 1 90); do
  if curl -fsS "http://127.0.0.1:3000/api/health" >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 1
done
if [[ "$ready" -ne 1 ]]; then
  echo "Next.js dev server did not become ready; see /tmp/web.log" >&2
  exit 1
fi
