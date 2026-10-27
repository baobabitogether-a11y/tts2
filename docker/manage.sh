#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
COMPOSE_FILE="$SCRIPT_DIR/compose.yml"
COMPOSE=(docker compose --project-directory "$PROJECT_ROOT" -f "$COMPOSE_FILE")

usage() {
  cat <<'EOF'
Usage:
  ./docker/manage.sh build
  ./docker/manage.sh e2e [Playwright arguments...]
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

main() {
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
