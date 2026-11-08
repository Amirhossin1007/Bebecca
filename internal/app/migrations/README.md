# Migrations

This package owns Rebecca's Go database migration runtime.

It provides goose-based migrations, dialect-aware schema helpers, legacy
Alembic detection, migration status/version helpers, and startup migration
execution.

Downgrades are intentionally unsupported. Migration code should be idempotent
and safe across SQLite, MySQL, and MariaDB.

Schema changes are forward-only and run once. Updates never drop and recreate
tables. A migration that drops, renames or merges an object copies the data
first, checks the live schema before each step, and can be re-run safely.
