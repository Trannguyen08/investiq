#!/usr/bin/env sh
set -eu

usage() {
  echo "Usage: restore_db.sh [--dry-run] ARCHIVE_PATH"
}

dry_run=false
if [ "${1:-}" = "--dry-run" ]; then
  dry_run=true
  shift
fi
[ "$#" -eq 1 ] || { usage >&2; exit 2; }

archive_path=$1
manifest_path=${archive_path%.dump}.manifest
: "${PGHOST:?PGHOST is required}"
: "${PGDATABASE:?PGDATABASE is required}"
: "${PGUSER:?PGUSER is required}"

[ -f "$archive_path" ] || { echo "Archive does not exist" >&2; exit 2; }
[ -f "$manifest_path" ] || { echo "Manifest does not exist" >&2; exit 2; }

expected_checksum=$(sed -n 's/^sha256=//p' "$manifest_path")
[ -n "$expected_checksum" ] || { echo "Manifest checksum is missing" >&2; exit 2; }
actual_checksum=$(sha256sum "$archive_path" | awk '{print $1}')
[ "$expected_checksum" = "$actual_checksum" ] || { echo "Backup checksum mismatch" >&2; exit 1; }
pg_restore --list "$archive_path" >/dev/null

if [ "$dry_run" = true ]; then
  echo "Archive and checksum are valid; would restore into ${PGDATABASE}"
  exit 0
fi

if [ "${ALLOW_DATABASE_RESTORE:-}" != "yes" ]; then
  echo "Set ALLOW_DATABASE_RESTORE=yes after isolating the target database" >&2
  exit 2
fi

pg_restore --exit-on-error --single-transaction --no-owner --no-acl \
  --clean --if-exists --dbname="$PGDATABASE" "$archive_path"
psql --set=ON_ERROR_STOP=on --command="ANALYZE"
echo "Restore complete; run application smoke tests before cutover"
