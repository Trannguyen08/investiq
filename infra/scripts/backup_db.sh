#!/usr/bin/env sh
set -eu

usage() {
  echo "Usage: backup_db.sh [--dry-run]"
}

dry_run=false
case "${1:-}" in
  "") ;;
  --dry-run) dry_run=true ;;
  *) usage >&2; exit 2 ;;
esac

: "${BACKUP_DIR:?BACKUP_DIR must point to independent backup storage}"
: "${PGHOST:?PGHOST is required}"
: "${PGDATABASE:?PGDATABASE is required}"
: "${PGUSER:?PGUSER is required}"

case "$BACKUP_DIR" in
  /|"") echo "Refusing unsafe BACKUP_DIR" >&2; exit 2 ;;
esac

timestamp=$(date -u +%Y%m%dT%H%M%SZ)
backup_id="investiq-${timestamp}"
archive_path="${BACKUP_DIR}/${backup_id}.dump"
manifest_path="${BACKUP_DIR}/${backup_id}.manifest"

if [ "$dry_run" = true ]; then
  echo "Would create ${archive_path} and checksum manifest"
  exit 0
fi

mkdir -p -- "$BACKUP_DIR"
lock_directory="${BACKUP_DIR}/.investiq-backup.lock"
if ! mkdir -- "$lock_directory" 2>/dev/null; then
  echo "Another backup process holds ${lock_directory}" >&2
  exit 1
fi
temporary_directory=""
cleanup() {
  if [ -n "$temporary_directory" ]; then
    rm -rf -- "$temporary_directory"
  fi
  rmdir -- "$lock_directory" 2>/dev/null || true
}
trap cleanup EXIT HUP INT TERM
temporary_directory=$(mktemp -d "${BACKUP_DIR}/.investiq-backup.XXXXXX")

temporary_archive="${temporary_directory}/${backup_id}.dump"
pg_dump --format=custom --no-owner --no-acl --file="$temporary_archive"
pg_restore --list "$temporary_archive" >/dev/null
checksum=$(sha256sum "$temporary_archive" | awk '{print $1}')
byte_size=$(wc -c < "$temporary_archive" | tr -d ' ')
server_version=$(psql --tuples-only --no-align --command="SHOW server_version" | head -n 1)
schema_versions=$(psql --tuples-only --no-align --command="SELECT coalesce(string_agg(version, ',' ORDER BY version), 'none') FROM app_schema_migrations" | head -n 1)
extensions=$(psql --tuples-only --no-align --command="SELECT coalesce(string_agg(extname, ',' ORDER BY extname), 'none') FROM pg_extension" | head -n 1)
database_role=$(psql --tuples-only --no-align --command="SELECT current_user" | head -n 1)

temporary_manifest="${temporary_directory}/${backup_id}.manifest"
{
  printf 'backup_id=%s\n' "$backup_id"
  printf 'created_at=%s\n' "$timestamp"
  printf 'database=%s\n' "$PGDATABASE"
  printf 'server_version=%s\n' "$server_version"
  printf 'schema_versions=%s\n' "$schema_versions"
  printf 'extensions=%s\n' "$extensions"
  printf 'database_role=%s\n' "$database_role"
  printf 'sha256=%s\n' "$checksum"
  printf 'bytes=%s\n' "$byte_size"
  printf 'format=pg_dump_custom\n'
} > "$temporary_manifest"

mv -- "$temporary_archive" "$archive_path"
mv -- "$temporary_manifest" "$manifest_path"
trap - EXIT HUP INT TERM
rmdir -- "$temporary_directory"
rmdir -- "$lock_directory"
echo "Backup complete: ${backup_id}"
