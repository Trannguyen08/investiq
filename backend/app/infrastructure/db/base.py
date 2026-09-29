"""Forward-only SQL migration runner for release jobs."""

from __future__ import annotations

from pathlib import Path

import psycopg

from app.infrastructure.config.settings import settings

MIGRATIONS_ROOT = Path(__file__).with_name("migrations")


def apply_migrations(database_url: str | None = None) -> tuple[str, ...]:
    applied: list[str] = []
    with psycopg.connect(database_url or settings.database_url) as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS app_schema_migrations (
                version text PRIMARY KEY,
                applied_at timestamptz NOT NULL DEFAULT now()
            )
            """
        )
        existing = {
            row[0]
            for row in connection.execute("SELECT version FROM app_schema_migrations").fetchall()
        }
        for migration_path in sorted(MIGRATIONS_ROOT.glob("*.sql")):
            version = migration_path.stem
            if version in existing:
                continue
            sql = migration_path.read_text(encoding="utf-8")
            with connection.transaction():
                connection.execute(sql)
                connection.execute(
                    "INSERT INTO app_schema_migrations (version) VALUES (%s)",
                    (version,),
                )
            applied.append(version)
    return tuple(applied)


if __name__ == "__main__":
    for applied_version in apply_migrations():
        print(f"Applied {applied_version}")
