#!/usr/bin/env bash
# deploy.sh — pull, rebuild, and roll the dms-template server container.
#
# Flow:
#   1. git pull + submodule update for dms-template and src/dms
#   2. docker build with a timestamped tag + :latest
#   3. If no container is running, start fresh.
#      Otherwise: start a staging container on no host port, wait for its
#      built-in HEALTHCHECK to go "healthy", then swap.
#
# Note on "zero downtime":
#   The swap stops the old container and starts the new one on the same host
#   port. With Docker's NAT-based -p forwarding only one container can hold
#   the port at a time, so there's a brief blip (~1s for `docker stop` to
#   exit). True zero-downtime requires a reverse proxy (nginx/haproxy) in
#   front holding the host port and switching upstreams on a SIGHUP. This
#   script does the closest thing without that — the new image is fully
#   verified healthy before the old one is touched, so a broken build never
#   takes traffic.
#
# Usage:
#   ./deploy.sh              # pull + build + roll
#   FORCE_REBUILD=1 ./deploy.sh   # add --no-cache to docker build
#
# Env overrides (all optional):
#   IMAGE_NAME, CONTAINER_NAME, HOST_PORT, ENV_FILE, VOLUME_NAME,
#   HEALTH_TIMEOUT (seconds), KEEP_PREV (number of -prev- containers to keep)

set -euo pipefail

# --- Docker permission: route docker calls through `sg docker -c` only when
# needed. Git/SSH stays in the user's original shell so SSH_AUTH_SOCK + agent
# keys keep working — re-execing the whole script under sg breaks `git pull`
# over SSH because the agent socket isn't reachable from the sg subshell.
USE_SG=0
if ! docker version >/dev/null 2>&1; then
  if id -nG | tr ' ' '\n' | grep -qx docker; then
    USE_SG=1
  else
    echo "error: docker not accessible and current user is not in the 'docker' group" >&2
    echo "  sudo usermod -aG docker \$USER   # then re-login or: newgrp docker" >&2
    exit 1
  fi
fi
docker() {
  if (( USE_SG )); then
    # Build a single-quote-escaped command string for `sg docker -c`.
    # Avoids `printf '%q '` because some older bashes (3.x) escape -flag args
    # in ways that break the receiver's parser.
    local _cmd="command docker"
    local _a
    for _a in "$@"; do
      _cmd+=" '${_a//\'/\'\\\'\'}'"
    done
    command sg docker -c "$_cmd"
  else
    command docker "$@"
  fi
}

# --- Config -----------------------------------------------------------------
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IMAGE_NAME="${IMAGE_NAME:-dms-template-server}"
CONTAINER_NAME="${CONTAINER_NAME:-dms-template-server}"
ENV_FILE="${ENV_FILE:-${REPO_DIR}/.env}"
VOLUME_NAME="${VOLUME_NAME:-dms-template-var}"
CONTAINER_VAR_PATH="/app/src/dms/packages/dms-server/var"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-180}"
KEEP_PREV="${KEEP_PREV:-3}"

# Default HOST_PORT to whatever PORT= line is in .env, else 3001.
default_host_port=3001
if [[ -f "$ENV_FILE" ]]; then
  port_from_env="$(grep -E '^PORT=' "$ENV_FILE" | tail -1 | cut -d= -f2- | tr -d '"' | tr -d "'")"
  [[ -n "${port_from_env:-}" ]] && default_host_port="$port_from_env"
fi
HOST_PORT="${HOST_PORT:-$default_host_port}"

log()  { printf '\033[1;34m[deploy]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[deploy:warn]\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31m[deploy:err]\033[0m %s\n' "$*" >&2; exit 1; }

[[ -f "$ENV_FILE" ]] || die "missing env file: $ENV_FILE"

# --- 1. Pull latest ---------------------------------------------------------
branch="$(git -C "$REPO_DIR" rev-parse --abbrev-ref HEAD)"
log "pulling dms-template (branch: $branch)"
git -C "$REPO_DIR" fetch --tags origin
git -C "$REPO_DIR" pull --ff-only

log "updating dms submodule to remote tip"
git -C "$REPO_DIR" submodule sync --recursive
git -C "$REPO_DIR" submodule update --init --remote --recursive

# --- 2. Build ---------------------------------------------------------------
sha="$(git -C "$REPO_DIR" rev-parse --short HEAD)"
TAG="$(date -u +%Y%m%d-%H%M%S)-${sha}"

# Avoid empty-array expansion under `set -u` (bash <4.4 errors). Use two
# concrete invocations instead.
if [[ "${FORCE_REBUILD:-0}" == "1" ]]; then
  log "building ${IMAGE_NAME}:${TAG} (also :latest) (--no-cache)"
  docker build --no-cache -t "${IMAGE_NAME}:${TAG}" -t "${IMAGE_NAME}:latest" "$REPO_DIR"
else
  log "building ${IMAGE_NAME}:${TAG} (also :latest)"
  docker build -t "${IMAGE_NAME}:${TAG}" -t "${IMAGE_NAME}:latest" "$REPO_DIR"
fi

# --- 3. Roll ----------------------------------------------------------------
existing_id="$(docker ps -q --filter "name=^${CONTAINER_NAME}$" || true)"

run_canonical() {
  docker run -d \
    --restart unless-stopped \
    --env-file "$ENV_FILE" \
    -p "${HOST_PORT}:${HOST_PORT}" \
    -v "${VOLUME_NAME}:${CONTAINER_VAR_PATH}" \
    --name "$CONTAINER_NAME" \
    "${IMAGE_NAME}:${TAG}" >/dev/null
}

wait_healthy() {
  local name="$1" timeout="$2" deadline state
  deadline=$(( SECONDS + timeout ))
  while (( SECONDS < deadline )); do
    state="$(docker inspect -f '{{.State.Health.Status}}' "$name" 2>/dev/null || echo missing)"
    case "$state" in
      healthy)   return 0 ;;
      unhealthy) return 1 ;;
      *)         sleep 2 ;;
    esac
  done
  return 1
}

if [[ -z "$existing_id" ]]; then
  log "no existing container; starting fresh on :${HOST_PORT}"
  # Remove a stopped container of the same name if present.
  docker rm "$CONTAINER_NAME" >/dev/null 2>&1 || true
  run_canonical
  log "waiting for $CONTAINER_NAME to become healthy"
  if ! wait_healthy "$CONTAINER_NAME" "$HEALTH_TIMEOUT"; then
    docker logs --tail 80 "$CONTAINER_NAME" || true
    die "$CONTAINER_NAME failed initial healthcheck"
  fi
  log "deployed ${IMAGE_NAME}:${TAG} as $CONTAINER_NAME"
  exit 0
fi

log "existing container running ($existing_id); preparing rolling swap"

STAGING="${CONTAINER_NAME}-staging-$$"
cleanup_staging() { docker rm -f "$STAGING" >/dev/null 2>&1 || true; }
trap cleanup_staging EXIT

log "starting staged container $STAGING (no host port; same env, same volume)"
docker run -d \
  --env-file "$ENV_FILE" \
  -v "${VOLUME_NAME}:${CONTAINER_VAR_PATH}" \
  --name "$STAGING" \
  "${IMAGE_NAME}:${TAG}" >/dev/null

log "waiting up to ${HEALTH_TIMEOUT}s for staged container to be healthy"
if ! wait_healthy "$STAGING" "$HEALTH_TIMEOUT"; then
  docker logs --tail 80 "$STAGING" || true
  die "staged container failed healthcheck — aborting; $CONTAINER_NAME left in place"
fi
log "staged container is healthy"

# Cutover: stop+rm staging (it holds the volume), then stop old, then start
# canonical from the verified-good image. Brief gap during this sequence.
docker stop "$STAGING" >/dev/null
docker rm "$STAGING" >/dev/null
trap - EXIT

prev_name="${CONTAINER_NAME}-prev-$(date -u +%Y%m%d-%H%M%S)"
log "cutover: renaming old → ${prev_name}, rebinding :${HOST_PORT}"
docker stop "$CONTAINER_NAME" >/dev/null
docker rename "$CONTAINER_NAME" "$prev_name" >/dev/null

run_canonical

# Trim older -prev-* containers, keeping the most recent KEEP_PREV.
mapfile -t prev_list < <(docker ps -a --filter "name=^${CONTAINER_NAME}-prev-" --format '{{.Names}}' | sort)
if (( ${#prev_list[@]} > KEEP_PREV )); then
  drop_count=$(( ${#prev_list[@]} - KEEP_PREV ))
  for c in "${prev_list[@]:0:drop_count}"; do
    log "pruning old container $c"
    docker rm -f "$c" >/dev/null || true
  done
fi

log "waiting for $CONTAINER_NAME to become healthy"
if ! wait_healthy "$CONTAINER_NAME" "$HEALTH_TIMEOUT"; then
  docker logs --tail 80 "$CONTAINER_NAME" || true
  die "$CONTAINER_NAME failed post-cutover healthcheck — rollback: docker rm -f $CONTAINER_NAME && docker rename $prev_name $CONTAINER_NAME && docker start $CONTAINER_NAME"
fi

# Best-effort prune of dangling images from old builds.
docker image prune -f --filter "label!=keep" >/dev/null 2>&1 || true

log "deployed ${IMAGE_NAME}:${TAG} as $CONTAINER_NAME (previous kept as $prev_name)"
