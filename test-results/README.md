# Allure feature test results and reports

This directory is the local workspace for generated Allure result data and viewable Allure reports.
Generated files are ignored by Git so test runs do not create repository noise. The repository does
not generate legacy `pytest-html`, JUnit, coverage XML, or coverage Markdown artifacts here.

Each backend feature uses this layout:

```text
test-results/<feature-slug>/
|-- unit/
|   |-- allure-results/*.json
|   `-- allure-report/index.html
`-- integration/
    |-- allure-results/*.json
    `-- allure-report/index.html
```

Run a registered feature from the repository root:

```powershell
backend\.venv313\Scripts\python.exe backend\tests\run_feature_tests.py logging-viewer all
```

The runner prints branch coverage in the terminal and then automatically generates a single-file
Allure report, even when pytest reports a failure. Open it directly, for example:

```powershell
Invoke-Item test-results\logging-viewer\unit\allure-report\index.html
```

`allure-pytest` remains the Python test adapter that produces the source JSON. The pinned official
Allure Commandline package under `frontend/` converts those results to HTML; Java and the dependencies
installed by `npm --prefix frontend ci` are required. This Allure HTML is distinct from the removed
legacy pytest HTML/coverage reports.
