#!/usr/bin/env bash
# Read-only reconnaissance of a target VPS before deploying Hubigo.
# Safe to run as a normal user; uses no sudo and changes nothing.
set -u

section() {
  echo
  echo "=== $1 ==="
}

section "OS"
cat /etc/os-release 2>/dev/null | head -2 || uname -a

section "Docker"
docker --version 2>/dev/null || echo "docker: not installed"
docker compose version 2>/dev/null || docker-compose --version 2>/dev/null || echo "docker compose: not installed"

section "Running containers"
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Ports}}' 2>/dev/null || echo "docker ps failed (permission?)"

section "Compose projects"
docker compose ls 2>/dev/null || echo "n/a"

section "Docker networks"
docker network ls 2>/dev/null || echo "n/a"

section "Listening TCP ports"
ss -tlnp 2>/dev/null || netstat -tlnp 2>/dev/null || echo "neither ss nor netstat available"

section "Reverse proxy"
for p in nginx caddy traefik; do
  command -v "$p" 2>/dev/null && echo "found: $p"
done
ls /etc/nginx/sites-enabled 2>/dev/null
ls /etc/caddy 2>/dev/null
docker ps --filter name=traefik --filter name=caddy --filter name=nginx -q 2>/dev/null | while read -r id; do
  docker inspect --format 'proxy container: {{.Name}} ({{.Config.Image}})' "$id" 2>/dev/null
done

section "Disk"
df -h / 2>/dev/null || echo "n/a"

section "Memory"
free -h 2>/dev/null || vm_stat 2>/dev/null | head -5 || echo "n/a"

echo
echo "Done."
