#!/usr/bin/env sh
set -eu

usage() {
  echo "Usage: backup_scheduler.sh [--once] [--dry-run]"
}

run_once=false
dry_run=false
for argument in "$@"; do
  case "$argument" in
    --once) run_once=true ;;
    --dry-run) dry_run=true ;;
    *) usage >&2; exit 2 ;;
  esac
done

interval_seconds=${BACKUP_INTERVAL_SECONDS:-21600}
case "$interval_seconds" in
  *[!0-9]*|"") echo "BACKUP_INTERVAL_SECONDS must be a positive integer" >&2; exit 2 ;;
esac
if [ "$interval_seconds" -lt 3600 ]; then
  echo "BACKUP_INTERVAL_SECONDS must be at least 3600" >&2
  exit 2
fi

script_directory=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

while :; do
  if [ "$dry_run" = true ]; then
    sh "$script_directory/backup_db.sh" --dry-run
  else
    sh "$script_directory/backup_db.sh"
  fi
  if [ "$run_once" = true ]; then
    exit 0
  fi
  sleep "$interval_seconds"
done
