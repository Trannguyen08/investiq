# Git Branching, Pull Requests, and Remote Synchronization Rules

Apply to all Git operations, branch lifecycles, pull requests, and commit workflows across this repository.

## 1. Branch synchronization invariant (`dev` vs `main`)

- `dev` is the continuous integration trunk for all active development. The commit history of `dev` must ALWAYS be ahead of or equal to `main` (`dev >= main`).
- `dev` must NEVER fall behind `main`.
- If an emergency hotfix or direct release commit occurs on `main`, `main` must be immediately merged or fast-forwarded back into `dev` (`git checkout dev && git merge --ff-only main && git push origin dev`).

## 2. Pull Request promotion hierarchy

- All task branches (`feature/*`, `fix/*`, `chore/*`, `docs/*`, `refactor/*`) MUST target `dev` when opening a Pull Request (`PR -> dev`).
- Direct pull requests from personal or task branches into `main` are strictly prohibited.
- `main` only receives changes via promotion pull requests from `dev` (`dev -> main`) after integration, testing, and stabilization on `dev`, or via approved release automation that immediately synchronizes back to `dev`.

## 3. Strict CI/CD quality gate

- Every Pull Request MUST wait for all automated CI/CD checks (unit tests, integration tests, linting, typechecks, security scans) to pass with 100% green status before merging.
- Never merge a Pull Request while CI/CD checks are pending, failing, or skipped without explicit documented justification.
- Never bypass branch protection rules or force-push to `main` or `dev`.

## 4. Task branch isolation and standard naming

- When starting work on a task that does not belong to the current branch, developers and agents MUST create and switch to a new dedicated branch off the latest `dev` (`git checkout dev && git pull && git checkout -b <type>/<description>`).
- Branch names must follow standard conventional categories:
  - `feature/<short-description>`: New functional capabilities or enhancements (e.g. `feature/realtime-alerts`).
  - `fix/<short-description>`: Bug fixes, UI/UX repairs, or regression corrections (e.g. `fix/auth-redirect`, `fix/UX`).
  - `chore/<short-description>`: Tooling, dependency maintenance, build scripts, or repo hygiene.
  - `docs/<short-description>`: Documentation, architecture records, or agent memory updates.
  - `refactor/<short-description>`: Code structure improvements without external behavioral changes.
- Keep branches scoped: do not combine unrelated changes or multiple orthogonal tasks into a single branch.

## 5. Immediate remote synchronization (No local-only commits)

- Commits must NEVER exist solely on a local machine.
- Immediately after completing any commit, push the branch to the remote repository:
  ```bash
  git push -u origin <branch-name>
  ```
- Leaving commits local-only risks work loss, breaks collaboration, and delays automated CI/CD verification.
