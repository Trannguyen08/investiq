"""Import a reviewed Vietnamese security master from a UTF-8 CSV file."""

from __future__ import annotations

import argparse
import csv
import re
from dataclasses import dataclass
from datetime import UTC, date, datetime
from pathlib import Path
from uuid import uuid4

import psycopg

from app.infrastructure.config.settings import settings

SYMBOL_PATTERN = re.compile(r"^[A-Z0-9]{1,12}$")
SUPPORTED_EXCHANGES = frozenset({"HOSE", "HNX", "UPCOM"})
REQUIRED_COLUMNS = frozenset({"exchange", "symbol", "issuer_name", "valid_from"})


@dataclass(frozen=True, slots=True)
class SecurityImportRow:
    exchange: str
    symbol: str
    issuer_name: str
    valid_from: date


def read_security_rows(csv_path: Path) -> tuple[SecurityImportRow, ...]:
    with csv_path.open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        columns = frozenset(reader.fieldnames or ())
        missing = REQUIRED_COLUMNS - columns
        if missing:
            raise ValueError(f"CSV is missing required columns: {', '.join(sorted(missing))}")
        rows: list[SecurityImportRow] = []
        seen: set[str] = set()
        for line_number, raw in enumerate(reader, start=2):
            exchange = raw["exchange"].strip().upper()
            symbol = raw["symbol"].strip().upper()
            issuer_name = raw["issuer_name"].strip()
            if exchange not in SUPPORTED_EXCHANGES:
                raise ValueError(f"line {line_number}: unsupported exchange")
            if not SYMBOL_PATTERN.fullmatch(symbol):
                raise ValueError(f"line {line_number}: invalid symbol")
            if not issuer_name:
                raise ValueError(f"line {line_number}: issuer_name is required")
            try:
                valid_from = date.fromisoformat(raw["valid_from"].strip())
            except ValueError as exc:
                raise ValueError(f"line {line_number}: valid_from must be YYYY-MM-DD") from exc
            qualified_symbol = f"{exchange}:{symbol}"
            if qualified_symbol in seen:
                raise ValueError(f"line {line_number}: duplicate {qualified_symbol}")
            seen.add(qualified_symbol)
            rows.append(SecurityImportRow(exchange, symbol, issuer_name, valid_from))
    if not rows:
        raise ValueError("CSV contains no security rows")
    return tuple(rows)


def import_security_rows(
    rows: tuple[SecurityImportRow, ...], *, database_url: str, source: str
) -> tuple[int, int]:
    inserted = 0
    updated = 0
    verified_at = datetime.now(UTC)
    with psycopg.connect(database_url) as connection, connection.transaction():
        for row in rows:
            existing = connection.execute(
                """
                SELECT sec.id
                FROM securities sec
                JOIN security_identifiers si ON si.security_id = sec.id
                WHERE si.exchange = %s AND si.symbol = %s AND si.valid_to IS NULL
                FOR UPDATE OF sec, si
                """,
                (row.exchange, row.symbol),
            ).fetchone()
            if existing:
                connection.execute(
                    """
                    UPDATE securities
                    SET issuer_name = %s, master_source = %s, master_verified_at = %s,
                        is_active = true
                    WHERE id = %s
                    """,
                    (row.issuer_name, source, verified_at, existing[0]),
                )
                updated += 1
                continue
            security_id = uuid4()
            connection.execute(
                """
                INSERT INTO securities
                    (id, issuer_name, master_source, master_verified_at)
                VALUES (%s, %s, %s, %s)
                """,
                (security_id, row.issuer_name, source, verified_at),
            )
            connection.execute(
                """
                INSERT INTO security_identifiers
                    (id, security_id, symbol, exchange, valid_from)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (uuid4(), security_id, row.symbol, row.exchange, row.valid_from),
            )
            inserted += 1
    return inserted, updated


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--file", type=Path, required=True, help="UTF-8 CSV security master")
    parser.add_argument("--source", required=True, help="Reviewed master-data source name")
    parser.add_argument("--dry-run", action="store_true", help="Validate without writing")
    arguments = parser.parse_args()
    rows = read_security_rows(arguments.file)
    if arguments.dry_run:
        print(f"Validated {len(rows)} security rows")
        return
    inserted, updated = import_security_rows(
        rows, database_url=settings.database_url, source=arguments.source
    )
    print(f"Security master imported: inserted={inserted}, updated={updated}")


if __name__ == "__main__":
    main()
