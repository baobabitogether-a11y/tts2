#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
COMPOSE_FILE="$SCRIPT_DIR/compose.yml"
COMPOSE=(docker compose --project-directory "$PROJECT_ROOT" -f "$COMPOSE_FILE")
LOCAL_COMPOSE_FILE="$SCRIPT_DIR/local-compose.yml"
LOCAL_ENV_FILE="$PROJECT_ROOT/.env.local-supabase"

usage() {
  cat <<'EOF'
Usage:
  ./docker/manage.sh build
  ./docker/manage.sh e2e [Playwright arguments...]
  ./docker/manage.sh local-up
  ./docker/manage.sh local-down
  ./docker/manage.sh local-logs
  ./docker/manage.sh shell

Examples:
  ./docker/manage.sh build
  ./docker/manage.sh e2e
  ./docker/manage.sh e2e --grep "renders"
EOF
}

require_docker() {
  if ! command -v docker >/dev/null 2>&1 || ! docker info >/dev/null 2>&1; then
    echo "Docker is required and the Docker daemon must be available." >&2
    exit 1
  fi
}

export DOCKER_UID="$(id -u)"
export DOCKER_GID="$(id -g)"

prepare_artifacts() {
  mkdir -p "$SCRIPT_DIR/artifacts/test-results" "$SCRIPT_DIR/artifacts/playwright-report"
}

build_image() {
  "${COMPOSE[@]}" build e2e
}

local_compose() {
  docker compose --project-directory "$PROJECT_ROOT" \
    --env-file "$LOCAL_ENV_FILE" \
    -f "$LOCAL_COMPOSE_FILE" "$@"
}

local_env_value() {
  local name="$1"
  local value
  value="$(awk -F= -v key="$name" '$1 == key { sub(/^[^=]*=/, ""); print; exit }' "$LOCAL_ENV_FILE")"
  if [[ -z "$value" ]]; then
    echo "Missing $name in $LOCAL_ENV_FILE; remove the file and rerun local-up to regenerate it." >&2
    return 1
  fi
  printf '%s' "$value"
}

wait_for_local_supabase() {
  local attempt
  for attempt in $(seq 1 60); do
    if curl --fail --silent \
      -H "apikey: $SUPABASE_PUBLISHABLE_KEY" \
      "$SUPABASE_URL/rest/v1/" >/dev/null 2>&1 \
      && curl --fail --silent \
      "$SUPABASE_URL/auth/v1/health" >/dev/null 2>&1; then
      return
    fi
    sleep 2
  done
  echo "Local Supabase REST/Auth did not become ready; inspect with ./docker/manage.sh local-logs." >&2
  return 1
}

wait_for_local_app() {
  local attempt
  for attempt in $(seq 1 60); do
    if curl --fail --silent http://127.0.0.1:8080/health >/dev/null 2>&1; then
      return
    fi
    sleep 2
  done
  echo "The local app did not become healthy on port 8080; inspect with ./docker/manage.sh local-logs." >&2
  return 1
}

local_up() {
  node "$SCRIPT_DIR/local-env.mjs"
  POSTGRES_PASSWORD="$(local_env_value POSTGRES_PASSWORD)"
  SUPABASE_URL="$(local_env_value SUPABASE_URL)"
  SUPABASE_PUBLISHABLE_KEY="$(local_env_value SUPABASE_PUBLISHABLE_KEY)"
  VITE_SUPABASE_URL="$(local_env_value VITE_SUPABASE_URL)"
  LOCAL_APP_URL="$(local_env_value LOCAL_APP_URL)"
  export POSTGRES_PASSWORD SUPABASE_URL SUPABASE_PUBLISHABLE_KEY VITE_SUPABASE_URL LOCAL_APP_URL

  local_compose up -d --build --wait --wait-timeout 180
  wait_for_local_supabase
  LOVABLE_DB_MIGRATION_URL="postgres://postgres:${POSTGRES_PASSWORD}@127.0.0.1:5432/postgres" \
    npx drizzle-kit migrate
  wait_for_local_app
  echo "Local Supabase and the app are running."
  echo "Local app health verified: http://127.0.0.1:8080/health"
  echo "Local Supabase REST/Auth health verified: http://127.0.0.1:54321"
  if [[ -n "${CODESPACE_NAME:-}" ]]; then
    echo "External browser access is not verified. Check the VS Code Ports panel and open its forwarded URL for port 8080."
    echo "Forward port 54321 too if the browser needs Supabase sign-in."
  else
    echo "App: $LOCAL_APP_URL"
    echo "Supabase API: $VITE_SUPABASE_URL"
  fi
  echo "Studio is not included in this minimal host-network stack."
}

main() {
  cd "$PROJECT_ROOT"
  local command="${1:-}"
  case "$command" in
    build)
      require_docker
      "${COMPOSE[@]}" build e2e
      ;;
    e2e)
      require_docker
      build_image
      prepare_artifacts
      shift
      "${COMPOSE[@]}" run --rm e2e npm run test:e2e -- "$@"
      ;;
    local-up)
      require_docker
      local_up
      ;;
    local-down)
      require_docker
      if [[ -f "$LOCAL_ENV_FILE" ]]; then
        shift
        local_compose down "$@"
      else
        echo "No local Supabase environment exists; nothing to stop."
      fi
      ;;
    local-logs)
      require_docker
      if [[ -f "$LOCAL_ENV_FILE" ]]; then
        local_compose logs -f --tail 100
      else
        echo "No local Supabase environment exists; run ./docker/manage.sh local-up first." >&2
        exit 1
      fi
      ;;
    shell)
      require_docker
      build_image
      prepare_artifacts
      "${COMPOSE[@]}" run --rm --entrypoint bash e2e
      ;;
    help|--help|-h|"")
      usage
      ;;
    *)
      echo "Unknown command: $command" >&2
      usage >&2
      exit 2
      ;;
  esac
}

main "$@"
