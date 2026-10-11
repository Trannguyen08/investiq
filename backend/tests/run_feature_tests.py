"""Run registered feature suites and write Allure results plus a viewable report."""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class FeatureTests:
    """Test paths and owned modules used to measure one feature."""

    unit_paths: tuple[str, ...]
    integration_paths: tuple[str, ...]
    unit_coverage_modules: tuple[str, ...]
    integration_coverage_modules: tuple[str, ...]


FEATURES: dict[str, FeatureTests] = {
    "auth": FeatureTests(
        unit_paths=("tests/unit/auth",),
        integration_paths=(
            "tests/integration/api/test_auth_api.py",
            "tests/integration/db/test_auth_repository.py",
        ),
        unit_coverage_modules=(
            "app.application.use_cases.auth",
            "app.infrastructure.security",
        ),
        integration_coverage_modules=(
            "app.api.v1.auth",
            "app.infrastructure.db.repositories.sql_user_repository",
        ),
    ),
    "admin-users": FeatureTests(
        unit_paths=(
            "tests/unit/auth/test_manage_users.py",
            "tests/unit/auth/test_admin_user_cursors.py",
        ),
        integration_paths=(
            "tests/integration/api/test_auth_api.py",
            "tests/integration/db/test_auth_repository.py",
        ),
        unit_coverage_modules=(
            "app.application.use_cases.admin.manage_users",
            "app.api.v1.admin_users",
        ),
        integration_coverage_modules=(
            "app.api.v1.admin_users",
            "app.infrastructure.db.repositories.sql_user_repository",
        ),
    ),
    "news": FeatureTests(
        unit_paths=("tests/unit/news",),
        integration_paths=(
            "tests/integration/api/test_news_api.py",
            "tests/integration/db/test_news_repository.py",
        ),
        unit_coverage_modules=(
            "app.application.use_cases.news",
            "app.infrastructure.external.crawlers",
        ),
        integration_coverage_modules=(
            "app.api.v1.news",
            "app.schemas.news",
            "app.infrastructure.db.repositories.sql_news_repository",
        ),
    ),
    "logging-viewer": FeatureTests(
        unit_paths=("tests/unit/infrastructure/test_logging_config.py",),
        integration_paths=("tests/integration/api/test_request_logging.py",),
        unit_coverage_modules=("app.infrastructure.config.logging_config",),
        integration_coverage_modules=("app.middleware.request_logging",),
    ),
    "market-data": FeatureTests(
        unit_paths=("tests/unit/market_data",),
        integration_paths=("tests/integration/api/test_market_data_api.py",),
        unit_coverage_modules=(
            "app.infrastructure.external.tcbs_market_provider",
            "app.infrastructure.external.vnstock_market_provider",
            "app.application.use_cases.market_data.market_service",
        ),
        integration_coverage_modules=(
            "app.api.v1.market_data",
            "app.schemas.market",
            "app.infrastructure.external.tcbs_market_provider",
        ),
    ),
    "paper-trading": FeatureTests(
        unit_paths=("tests/unit/portfolio",),
        integration_paths=(
            "tests/integration/api/test_paper_portfolio_api.py",
            "tests/integration/db/test_paper_portfolio_repository.py",
        ),
        unit_coverage_modules=(
            "app.application.use_cases.portfolio",
            "app.domain.entities.portfolio",
            "app.domain.entities.holding",
        ),
        integration_coverage_modules=(
            "app.api.v1.portfolio",
            "app.infrastructure.db.repositories.sql_portfolio_repository",
            "app.schemas.portfolio",
        ),
    ),
}


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run one feature's tests and generate terminal coverage plus Allure reports.",
    )
    parser.add_argument("feature", choices=sorted(FEATURES))
    parser.add_argument("suite", choices=("unit", "integration", "all"))
    return parser.parse_args()


def _allure_executable(repository_root: Path) -> str | None:
    executable_name = "allure.cmd" if sys.platform == "win32" else "allure"
    project_executable = repository_root / "frontend" / "node_modules" / ".bin" / executable_name
    if project_executable.is_file():
        return str(project_executable)
    return shutil.which("allure")


def _generate_allure_report(
    allure_directory: Path,
    report_directory: Path,
    repository_root: Path,
) -> int:
    allure_executable = _allure_executable(repository_root)
    if allure_executable is None:
        print(
            "Allure Commandline is unavailable. Run `npm --prefix frontend ci` "
            "and ensure Java is installed.",
            file=sys.stderr,
            flush=True,
        )
        return 2

    completed = subprocess.run(
        [
            allure_executable,
            "generate",
            str(allure_directory),
            "--clean",
            "--single-file",
            "--output",
            str(report_directory),
        ],
        cwd=repository_root,
        check=False,
        capture_output=True,
        text=True,
    )
    if completed.returncode == 0:
        print(f"Allure report: {report_directory / 'index.html'}", flush=True)
    else:
        if completed.stdout.strip():
            print(completed.stdout.strip(), file=sys.stderr, flush=True)
        if completed.stderr.strip():
            print(completed.stderr.strip(), file=sys.stderr, flush=True)
        print("Allure HTML report generation failed.", file=sys.stderr, flush=True)
    return completed.returncode


def _run_suite(
    feature_name: str,
    suite_name: str,
    feature: FeatureTests,
    backend_root: Path,
    repository_root: Path,
) -> int:
    test_paths = feature.unit_paths if suite_name == "unit" else feature.integration_paths
    coverage_modules = (
        feature.unit_coverage_modules
        if suite_name == "unit"
        else feature.integration_coverage_modules
    )
    reports_root = (repository_root / "test-results").resolve()
    report_directory = (reports_root / feature_name / suite_name).resolve()
    if reports_root not in report_directory.parents:
        raise ValueError("Feature report path must stay inside test-results")
    if report_directory.exists():
        shutil.rmtree(report_directory)
    allure_directory = report_directory / "allure-results"
    allure_directory.mkdir(parents=True, exist_ok=True)

    command = [
        sys.executable,
        "-m",
        "pytest",
        *test_paths,
        "--cov-branch",
        "--cov-context=test",
        "--no-cov-on-fail",
        "--cov-report=term-missing",
        f"--alluredir={allure_directory}",
        "--clean-alluredir",
    ]
    for module in coverage_modules:
        command.append(f"--cov={module}")

    print(f"\nRunning {feature_name} {suite_name} tests", flush=True)
    completed = subprocess.run(command, cwd=backend_root, check=False)
    if completed.returncode == 0:
        print(f"Allure results: {allure_directory}", flush=True)
    report_returncode = _generate_allure_report(
        allure_directory,
        report_directory / "allure-report",
        repository_root,
    )
    return completed.returncode or report_returncode


def main() -> int:
    """Run the selected suite or both suites in sequence."""
    args = _parse_args()
    backend_root = Path(__file__).resolve().parents[1]
    repository_root = backend_root.parent
    feature = FEATURES[args.feature]
    suites = ("unit", "integration") if args.suite == "all" else (args.suite,)

    for suite_name in suites:
        return_code = _run_suite(
            args.feature,
            suite_name,
            feature,
            backend_root,
            repository_root,
        )
        if return_code != 0:
            return return_code
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
