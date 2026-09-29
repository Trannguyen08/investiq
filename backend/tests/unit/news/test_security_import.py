from pathlib import Path

import pytest

from app.infrastructure.db.import_securities import read_security_rows


def test_security_import_normalizes_reviewed_csv(tmp_path: Path) -> None:
    csv_path = tmp_path / "securities.csv"
    csv_path.write_text(
        "exchange,symbol,issuer_name,valid_from\nhose,fpt,Công ty Cổ phần FPT,2006-01-01\n",
        encoding="utf-8",
    )

    rows = read_security_rows(csv_path)

    assert rows[0].exchange == "HOSE"
    assert rows[0].symbol == "FPT"
    assert rows[0].issuer_name == "Công ty Cổ phần FPT"


def test_security_import_rejects_duplicate_qualified_symbols(tmp_path: Path) -> None:
    csv_path = tmp_path / "securities.csv"
    csv_path.write_text(
        "exchange,symbol,issuer_name,valid_from\n"
        "HOSE,FPT,Công ty Cổ phần FPT,2006-01-01\n"
        "HOSE,FPT,Tên khác,2006-01-01\n",
        encoding="utf-8",
    )

    with pytest.raises(ValueError, match="duplicate HOSE:FPT"):
        read_security_rows(csv_path)
