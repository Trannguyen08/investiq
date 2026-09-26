export default function LogsPage() {
  const logViewerUrl = process.env.NEXT_PUBLIC_LOG_VIEWER_URL ?? "http://localhost:9999";

  return (
    <main className="panel">
      <p className="eyebrow">Admin workspace</p>
      <h1>Runtime logs</h1>
      <p>
        Open the localhost-only viewer for API requests, application messages, warnings, and errors
        from the edge, backend, frontend, and job containers. Build output and routine health checks
        are excluded.
      </p>
      <a className="primary-link" href={logViewerUrl} target="_blank" rel="noreferrer">
        Open logging viewer
      </a>
      <p className="muted-copy">
        HTTP entries expose code, API URL, log content, time, container, request ID, and a short
        explanation. Status groups are highlighted through their log level.
      </p>
    </main>
  );
}
