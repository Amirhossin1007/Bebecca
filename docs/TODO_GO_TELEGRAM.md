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
- Python Telegram bot command handlers are disabled during the Go migration.
  The old handlers mutated users, nodes, templates, subscriptions, and runtime
  state through Python paths that are no longer the source of truth.
- Python Telegram report functions are intentionally no-op placeholders. They
  remain import-compatible while Go-native mutation/reporting is rebuilt.
- Telegram backup delivery remains enabled because it only uses the bot as a
  delivery transport and does not mutate Rebecca business state.

## Future Go Scope

- Add a Go notification/event abstraction for admin, user, node, and service
  events.
- Add a Go Telegram bot command layer only after the corresponding Go APIs are
  stable. Bot commands should call Go Admin/User/Node/Service APIs instead of
  direct database CRUD helpers.
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
- Node created (`node_created`).
- Node deleted (`node_deleted`).
- Node usage reset (`node_usage_reset`).
- Node status changes (`node_status_change`), including connected, connecting,
  error, disabled, and limited transitions.
- Service mutation notifications, if required by the product behavior.

## Node Report Notes

- Node mutation paths are now Go-native, so Python `report.node_*` wrappers and
  Telegram node formatting are intentionally not part of the active runtime.
- Go should emit node reports from the mutation/status-change boundary after a
  Go Telegram notifier exists.
- Notification delivery must not affect node transaction success. Prefer an
  outbox/background worker if Telegram delivery can fail or rate-limit.
- Message formatting should include the previous Python report content where it
  still makes product sense: node name, address, API port, data limit, usage
  coefficient, previous/current status, and actor username.

## Bot Command Notes

The removed Python bot handlers previously covered:

- Admin panel commands such as `/start`, system info, runtime restart, user
  search/list, user create/edit/delete, subscription links, and QR generation.
- User `/usage` lookup.
- Inline keyboards for user lifecycle changes and protocol/inbound selection.

When rebuilt in Go, command handlers should:

- Use the same Go auth/permission/limit core as HTTP APIs.
- Call Go-native User, Node, Service, and Subscription endpoints or internal
  services instead of reading/writing database state ad hoc.
- Avoid exposing runtime restart commands that conflict with the node-only
  master architecture.
- Reintroduce only product-approved commands; old Python commands should not be
  copied blindly.

## Legacy Bot Logic To Port

The Python bot used `pyTelegramBotAPI` with admin chat-id filtering from
`TelegramSettingsService.admin_chat_ids`. The Go implementation should preserve
the product behavior below only where it still fits the Go-native architecture.

### Admin Commands

- `/start` and `/help` showed the admin main menu.
- `/user <username>` searched a user and opened the user detail menu.
- System info showed CPU, RAM, disk, uptime/process information.
- Runtime restart triggered the old local/node runtime restart path. This must
  be redesigned around Go node runtime APIs; the master must not restart a local
  Xray core.

### User Detail And Lifecycle

- User menus displayed status, username, data limit, used traffic, expiry/on-hold
  information, online/subscription timestamps, note, owner admin, and
  subscription URL.
- Lifecycle callbacks:
  - `delete:{username}`
  - `suspend:{username}`
  - `activate:{username}`
  - `reset_usage:{username}`
  - `revoke_sub:{username}`
  - `edit:{username}`
  - `edit_note:{username}`
  - `links:{username}`
  - `genqr:{configs|sub}:{username}`
- All user mutations must call the Go User API/core and must enforce the same Go
  admin permissions and limits as HTTP APIs.
- Subscription links/configs must be generated by Go subscription/config logic.

### Bulk User Actions

- Edit-all menu supported:
  - delete expired users
  - delete limited users
  - add/reduce traffic for all selected users
  - add/reduce expiry time for all selected users
  - add/remove inbound from users
- Go implementation should map these to the Go bulk user action/service-scoped
  action APIs where possible. Every config/status-changing action must enqueue
  the same node operation(s) as the HTTP path.

### User Creation Flow

- The manual create flow collected:
  - username or random username
  - optional bulk count
  - data limit
  - status: `active` or `on_hold`
  - expire date, on-hold duration, or on-hold timeout
  - selected protocols and inbound tags
- Protocol/inbound selection was built from Xray config inbounds. The Go version
  must use Go config/inbound repository data and never import Python `runtime.xray`.
- Default VLESS flow came from Xray config. The Go version must derive this from
  Go config builder state.
- Bulk create generated suffixed usernames and created multiple users using the
  same selected plan.

### Removed Template Flow

User templates have been removed from the product and their tables are dropped
by migration. Do not rebuild the legacy template bot flow unless the product
explicitly reintroduces a new template concept.

### User `/usage`

- Public `/usage <username>` looked up a user and returned status, data limit,
  data used, expire date, and days left.
- If restored, this must use Go read-only user APIs and must follow the desired
  privacy policy for public Telegram chats.

### Keyboards And Callback State

- Legacy keyboards included:
  - main menu
  - edit-all menu
  - inbound selection
  - random username
  - user menu
  - status select
  - subscription/config QR actions
  - confirm/cancel actions
  - paginated user list
  - protocol/inbound selection
- Multi-step flows used in-memory bot state and registered next-step handlers.
  The Go version should prefer a small conversation-state table with expiry so
  deploy/restart does not strand users mid-flow.

### Legacy Dependencies That Must Not Return

- Direct Python `crud.*` calls.
- Direct Python `node_operations.*` calls.
- Direct `app.runtime.xray` / local Xray config reads.
- Direct Python subscription helpers.
- Direct runtime restart commands against the master host.

## Legacy Report Logic To Port

Python report functions are now no-op placeholders. When restoring reports in
Go, preserve useful event content but emit from Go mutation boundaries:

- User created: username, traffic limit, expire date, proxies/protocols, reset
  strategy, next-plan flag, owner admin, actor.
- User updated: same core fields plus owner/actor.
- User deleted: username, owner admin, actor.
- User status change: username, owner admin, new status.
- User usage reset: username, owner admin, actor.
- User auto reset / next plan: username, traffic limit, expire date.
- User auto-renew set/applied: username, rule count or resulting plan.
- Subscription revoked: username, owner admin, actor.
- Login: username, client IP, success/failure. Do not include raw password in
  the restored Go report.
- Admin created/updated/deleted/usage reset/limit reached: username, role/scope,
  users/data limits, changed fields, actor, current/limit values.

Delivery should honor Telegram settings, event enable flags, forum topics,
logs chat/admin chat fallback, proxy settings, API rate limits, and last-error
tracking for the dashboard.

## Backup Delivery Logic To Preserve

Telegram backup delivery remains active in Python for now. If moved to Go later,
preserve:

- Backup enabled/scope/interval settings.
- Logs chat or admin-chat fallback.
- Forum topic routing for `backup`.
- File splitting around the Telegram document size limit.
- Caption fields: filename, scope, Gregorian date, Jalali date, time, part
  number.
- Final completion message.
- Last sent/error status updates in Telegram settings.

## Rollout Notes

- The Go admin/auth migration should not depend on this file being completed.
- Once Go-native admin/user/service mutation paths are stable, revisit this TODO
  and implement Telegram delivery as a separate migration.
