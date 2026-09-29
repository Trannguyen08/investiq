"""Run registered feature suites and write isolated test/coverage reports."""

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
}


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run one feature's tests and generate JUnit plus coverage reports.",
    )
    parser.add_argument("feature", choices=sorted(FEATURES))
    parser.add_argument("suite", choices=("unit", "integration", "all"))
    return parser.parse_args()


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
    html_directory = report_directory / "html"
    report_directory.mkdir(parents=True, exist_ok=True)

    command = [
        sys.executable,
        "-m",
        "pytest",
        *test_paths,
        "--cov-branch",
        "--cov-context=test",
        "--no-cov-on-fail",
        "--cov-report=term-missing",
        f"--cov-report=markdown:{report_directory / 'coverage.md'}",
        f"--cov-report=xml:{report_directory / 'coverage.xml'}",
        f"--cov-report=html:{html_directory}",
        f"--junitxml={report_directory / 'junit.xml'}",
    ]
    for module in coverage_modules:
        command.append(f"--cov={module}")

    print(f"\nRunning {feature_name} {suite_name} tests", flush=True)
    completed = subprocess.run(command, cwd=backend_root, check=False)
    if completed.returncode == 0:
        print(f"Reports: {report_directory}", flush=True)
    return completed.returncode


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
