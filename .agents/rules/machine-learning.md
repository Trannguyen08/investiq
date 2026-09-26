# Machine Learning Rules

Apply to feature pipelines, model training, evaluation, registry, inference, sentiment, and notebooks.

- Define target, prediction horizon, decision use, evaluation metric, baseline, and unacceptable failure
  before selecting a model. A more complex model must beat a simple baseline on relevant out-of-sample data.
- Split price/news data chronologically and fit preprocessing only on training periods. Prevent target,
  future, survivorship, and cross-sectional leakage; never randomly shuffle time-series evaluation.
- Version dataset snapshot/query, feature definitions, code commit, dependency environment, random seed,
  hyperparameters, model artifact, and evaluation report for every registered model.
- Feature computation must be identical for training and inference or share one tested implementation.
  Define missing, delayed, duplicated, revised, and out-of-order market/news data behavior.
- Notebooks are for exploration only. Production training/inference logic lives in tested modules and
  workers; notebooks call those modules rather than becoming the sole implementation.
- Make training reproducible within documented hardware/library tolerances. Control seeds and record
  unavoidable nondeterminism instead of promising bit-for-bit equality when unavailable.
- Evaluate by time period and market regime using leakage-safe backtests, transaction costs, slippage,
  and delisting/corporate-action assumptions where relevant.
- Register an artifact only after schema, metric, bias/data-quality, security, and compatibility checks.
  Promotion and rollback are explicit; partial/failed artifacts never become active.
- Inference validates feature schema and model version, bounds batch size and latency, and returns
  provenance, horizon, confidence semantics, and data timestamp. It never presents certainty.
- Monitor input quality, feature drift, prediction distribution, latency, failures, and delayed outcome
  metrics. Drift alerts trigger investigation, not automatic retraining/deployment without gates.
- Model/data files are generated artifacts outside Git; never deserialize untrusted model artifacts.
