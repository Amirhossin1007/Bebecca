# Contributing to Rebecca

Thanks for considering a contribution to Rebecca.

## Questions

Please avoid opening issues for support questions. Use one of these channels instead:

- Telegram channel: [@rebeccapanel_rebecca](https://t.me/rebeccapanel_rebecca)
- GitHub Discussions for longer-term design or operational questions.

## Reporting Issues

When reporting a bug, include:

- What you expected to happen.
- What actually happened.
- Relevant server logs, browser console errors, or API responses.
- Rebecca version, install mode, database type, node version, and Xray version.
- Sanitized `.env`, node settings, and Xray config snippets when the issue depends on configuration.

## Branches

Use `dev` for normal development branches unless a maintainer asks you to target a feature branch such as `go-usage-bridge`.

Keep pull requests focused. Avoid mixing formatting, documentation moves, and behavior changes unless the cleanup is required for the feature.

## Project Layout

```text
.
|-- app/                 # Python FastAPI code that is still active or transitional
|-- go/                  # Go gateway, master API, node controller, usage, admin, user flows
|-- dashboard/           # React dashboard. npm package files live here.
|-- cli/                 # Python CLI entrypoints still used by packaged commands
|-- docs/                # Project docs, translated READMEs, CLI docs, contributor docs
|-- scripts/             # Install/build/deployment scripts
|-- tests/               # Python tests for active Python or transitional behavior
```

## Architecture Notes

Rebecca is being migrated from Python runtime paths to Go-owned services in phases.

- Go owns the gateway, Go Master API sidecar, node communication, admin/auth, and the Go-native user/subscription paths that have already been migrated.
- Python still owns parts that have not been migrated yet and may also expose transitional wrappers while a feature is moving to Go.
- New node, admin, user, and subscription runtime behavior should be implemented in Go unless there is an explicit reason to keep it transitional.
- If a Python route has been intentionally retired because a Go route owns it, tests should target the Go package or the gateway path rather than re-enabling Python behavior.

## Backend Development

Python backend:

```bash
python -m compileall -q app tests
ruff check app tests
python -m pytest
```

Go backend:

```bash
cd go
go test ./...
```

Use database transactions for mutations that also enqueue node operations. If a DB write succeeds but the matching operation cannot be enqueued, the transaction should roll back.

## Dashboard Development

The dashboard is the only npm package in this repository. Run all npm commands from `dashboard/`.

```bash
cd dashboard
npm ci
npm run build
```

The root repository does not keep a `package.json` or `package-lock.json`. Dashboard dependencies and lockfiles belong in `dashboard/`.

## Documentation

The root `README.md` is the main project README. Other README files and contributor documentation live under `docs/`.

CLI docs can be regenerated from the repository root with:

```bash
PYTHONPATH=$(pwd) typer rebecca-cli.py utils docs --name "" --output ./docs/cli/README.md
```

## Debug Mode

For local Python development, set `DEBUG=true` and run `main.py`.

For dashboard development, run the Vite dev server from `dashboard/` and set `VITE_BASE_API` in `dashboard/.env` if the API address is not the default.

## Pull Request Checklist

- Keep the change scoped to one concern.
- Update docs when paths, commands, or runtime ownership changes.
- Run the relevant Python, Go, and dashboard checks.
- Do not commit generated build output unless the repository already tracks that exact artifact for a release flow.
- Do not include secrets, real server credentials, database dumps, or local test databases.
