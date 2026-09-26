# Feature test results

This directory is the local workspace for generated test and coverage reports. Generated files are
ignored by Git so test runs do not create repository noise.

Each backend feature uses this layout:

```text
test-results/<feature-slug>/
|-- unit/
|   |-- coverage.md
|   |-- coverage.xml
|   |-- html/index.html
|   `-- junit.xml
`-- integration/
    |-- coverage.md
    |-- coverage.xml
    |-- html/index.html
    `-- junit.xml
```

Run a registered feature from the repository root:

```powershell
backend\.venv313\Scripts\python.exe backend\tests\run_feature_tests.py logging-viewer all
```

Open the `html/index.html` file for line-by-line coverage. `coverage.md` is the compact summary and
`junit.xml` contains individual test results and durations.
