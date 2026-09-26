# Project Structure Synchronization Rules

The repository layout is a maintained contract. Apply this rule whenever creating, deleting,
moving, or renaming a file or directory, or changing a module/service boundary.

## Required workflow

1. Before editing, search the repository for the old path, new path, directory name, and
   documented tree fragments. Exclude generated and dependency directories.
2. Make the structural change without overwriting unrelated existing files.
3. In the same change, update every file that describes or consumes the structure, including:
   - `README.md` and other developer documentation;
   - `.agents/memory/project.md` and `.agents/memory/architecture.md`;
   - root or nested `AGENTS.md` files and applicable rules/workflows;
   - imports, package/module metadata, path aliases, and test discovery configuration;
   - Docker, Compose, CI/CD, deployment scripts, migrations, and operational tooling;
   - tests, fixtures, and commands containing affected paths.
4. Search again for stale references to removed or renamed paths.
5. Verify the documented tree against the filesystem and run the checks affected by updated
   imports or configuration.

When adding, removing, or renaming a rule module, update the rule-routing table in the root
`AGENTS.md` in the same change so future agents can discover it.

Documentation synchronization is part of the structural change, not optional follow-up work.
Do not copy transient or generated directories into architecture documentation. If multiple
files describe the same structure at different levels of detail, keep all of them consistent and
use `.agents/memory/architecture.md` as the canonical architectural overview.
