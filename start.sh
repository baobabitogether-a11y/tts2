#!/usr/bin/env bash

set -Eeuo pipefail

PROJECT_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

if ! command -v docker >/dev/null 2>&1 || ! docker info >/dev/null 2>&1; then
  echo "Docker is required and the Docker daemon must be available." >&2
  exit 1
fi

./docker/manage.sh local-up

check_http() {
  local name="$1"
  local url="$2"
  local status
  status="$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' --max-time 5 "$url")" || {
    echo "Not ready: $name at $url" >&2
    exit 1
  }
  if [[ ! "$status" =~ ^2[0-9][0-9]$ ]]; then
    echo "Not ready: $name at $url returned HTTP $status" >&2
    exit 1
  fi
  printf 'OK  %-24s %s (HTTP %s)\n' "$name" "$url" "$status"
}

check_tcp() {
  local name="$1"
  local port="$2"
  if ! timeout 3 bash -c "exec 3<>/dev/tcp/127.0.0.1/$port"; then
    echo "Not ready: $name is not accepting TCP connections on port $port" >&2
    exit 1
  fi
  printf 'OK  %-24s 127.0.0.1:%s (TCP)\n' "$name" "$port"
}

check_tcp "PostgreSQL" 5432
check_http "Supabase API gateway" "http://127.0.0.1:54321/auth/v1/health"
check_http "Web app" "http://127.0.0.1:8080/health"
check_http "Same-origin Auth proxy" "http://127.0.0.1:8080/auth/v1/health"

compose=(docker compose --project-directory "$PROJECT_ROOT" \
  --env-file "$PROJECT_ROOT/.env.local-supabase" \
  -f "$PROJECT_ROOT/docker/local-compose.yml")
container_ids="$("${compose[@]}" ps -q)"
if [[ -z "$container_ids" ]]; then
  echo "Not ready: Docker Compose did not return any local stack containers." >&2
  exit 1
fi

container_count=0
while IFS= read -r container; do
  [[ -n "$container" ]] || continue
  container_count=$((container_count + 1))
  name="$(docker inspect --format '{{.Name}}' "$container")"
  health="$(docker inspect --format '{{.State.Health.Status}}' "$container")"
  if [[ "$health" != "healthy" ]]; then
    echo "Not ready: Docker container $name reports $health" >&2
    exit 1
  fi
done <<< "$container_ids"
if [[ "$container_count" -ne 5 ]]; then
  echo "Not ready: expected 5 local stack containers, found $container_count." >&2
  exit 1
fi

echo
echo "App and local database services are ready."
echo "App: http://127.0.0.1:8080"
echo "Codespaces: open port 8080 in the VS Code Ports panel and use its Browse URL."
echo "Browser Auth uses the app's /auth/v1 proxy; port 54321 does not need external forwarding."
