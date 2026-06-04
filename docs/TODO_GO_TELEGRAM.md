# TODO: Go Telegram Handling

Telegram/report notification handling is intentionally out of scope for the
current Go migration phase. Admin authentication, admin mutations, permissions,
roles, and admin limits should be migrated first without coupling the new Go
admin API to Telegram delivery.

## Current Decision

- Do not send Telegram/report notifications from Go during the admin/auth
  migration.
- Do not keep Python Telegram handlers as a dependency for Go admin mutation
  correctness.
- Preserve the business mutations first; notification delivery can be restored
  in a later phase.

## Future Go Scope

- Add a Go notification/event abstraction for admin, user, node, and service
  events.
- Decide whether events are delivered synchronously, through an outbox table, or
  through a background worker.
- Implement Telegram settings lookup in Go, including per-topic enable flags and
  chat/thread routing.
- Port report formatting currently implemented in Python to Go templates.
- Add rate-limit handling and retry behavior for Telegram API calls.
- Add tests for notification opt-in/opt-out, formatting, retry, and disabled
  Telegram behavior.

## Events To Revisit

- Admin created, updated, deleted.
- Admin enabled/disabled.
- Admin user disable/activate actions.
- Admin usage and deleted-users usage reset.
- User created, updated, deleted, reset, revoked, next-plan changes.
- Service mutation notifications, if required by the product behavior.

## Rollout Notes

- The Go admin/auth migration should not depend on this file being completed.
- Once Go-native admin/user/service mutation paths are stable, revisit this TODO
  and implement Telegram delivery as a separate migration.
