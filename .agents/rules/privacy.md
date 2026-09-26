# Privacy and Personal Financial Data Rules

- Treat identity, portfolio composition, holdings, watchlists, alerts, risk profile, predictions tied
  to a user, exports, and behavioral analytics as personal or sensitive financial data.
- Collect and retain only fields used by a documented feature. Record purpose, owner, retention window,
  and deletion behavior alongside the schema or data contract.
- Default new logs, metrics, events, traces, caches, exports, and ML datasets to excluding personal data.
  Use pseudonymous stable IDs only when correlation is required.
- User deletion covers primary rows, derived portfolio data, caches, search/read models, messages/DLQs,
  analytics, ML datasets, exports, logs, and backups through deletion, expiry, or crypto-shredding.
- Soft deletion is not final deletion. Define and monitor the hard-purge job and restore-time re-deletion.
- Data export and account deletion require fresh verified identity, resource authorization, rate limits,
  audit logs, and safe asynchronous delivery. Exports are encrypted and expire promptly.
- Production personal data must not enter local fixtures, notebooks, screenshots, model-training samples,
  support artifacts, or third-party tools without explicit approved handling.
- Aggregate/anonymized data must not retain a reversible identity map or allow practical re-identification.
- Analytics, error reporting, and session replay require review of collection, masking, residency,
  retention, and consent obligations before client integration.
- Privacy-law interpretation remains a legal/product decision; engineering must make collection,
  consent, retention, export, and deletion technically enforceable and observable.
