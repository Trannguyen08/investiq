# Dependency and Supply-Chain Rules

- Add a dependency only when the standard library, platform, or an installed package does not meet
  the requirement cleanly. Record why the added capability is needed.
- Verify the exact package is canonical and maintained; check ownership, release history, security
  posture, license, provenance, and known vulnerabilities before installation.
- Declare Python dependencies in the backend manifest and JavaScript dependencies in the frontend
  manifest. Repository-level tooling belongs at the root only if it serves multiple services.
- Maintain one authoritative lock/resolution file per ecosystem and install it in frozen mode in CI.
  Never hand-merge a conflicted lockfile; resolve manifests and regenerate it with the package manager.
- Pin exact versions for CI actions, build/codegen tooling, containers, and one-off executors.
- Treat install scripts, native extensions, model packages, browser SDKs, plugins, and agent tooling
  as higher-risk dependencies requiring closer review.
- Review the complete manifest and lockfile diff. Registry URL or integrity-hash changes are security events.
- Remove unused direct dependencies in the same change that removes their last consumer.
- Keep framework/toolchain upgrades separate from feature work so regressions can be isolated.
- Security findings include installed version, dependency path, reachability, available fix, and
  operational impact; scanner output is evidence to verify, not an automatic verdict.
- Produce and retain an SBOM for release artifacts once release automation is implemented.
