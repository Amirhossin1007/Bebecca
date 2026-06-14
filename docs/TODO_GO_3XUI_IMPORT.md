# TODO: Go-Native 3x-ui Import

The 3x-ui database import flow is temporarily disabled.

## Why

The old importer was implemented in Python and wrote users, proxies, service links,
traffic fields, and runtime sync side effects through legacy CRUD paths. Those
paths are being removed as Rebecca moves user/service/config handling to Go.

## Current Runtime Behavior

- The Integration Settings page renders the existing 3x-ui import panel as `Coming soon`.
- Preview/import actions are disabled in the frontend.
- `POST /api/settings/database/3xui/preview` returns `410 Gone`.
- `POST /api/settings/database/3xui/import` returns `410 Gone`.
- `GET /api/settings/database/3xui/jobs/{job_id}` returns `410 Gone`.

## 3x-ui SQLite Database Notes

The previous importer read a 3x-ui SQLite database directly. The Go version
should keep this behavior and avoid depending on the old Python script.

### Source Tables

- `inbounds`
  - `id`: source inbound id.
  - `enable`: inbound enabled flag. Disabled inbounds should not create active users.
  - `remark`: human-readable inbound name.
  - `protocol`: source protocol. Previously supported: `vmess`, `vless`, `trojan`, `shadowsocks`.
  - `settings`: JSON object containing protocol settings and `clients`.
- `client_traffics`
  - Optional table.
  - `email`: client identifier used to join traffic to clients.
  - `up`, `down`: bytes uploaded/downloaded.

### Source Client JSON

Each `inbounds.settings.clients[]` item can contain:

- `email`: preferred Rebecca username source.
- `id`: VMess/VLESS UUID.
- `password`: Trojan/Shadowsocks credential.
- `enable`: client enabled flag.
- `subId`: legacy subscription subaddress. Rebecca stores this in `users.subadress`.
- `comment`: user note source.
- `limitIp`: maps to Rebecca `users.ip_limit`.
- `totalGB`: byte data limit. `0` means unlimited.
- `expiryTime`: millisecond timestamp in 3x-ui. Negative values may represent relative expiry in old 3x-ui data and must be normalized.
- `flow`: VLESS flow. Must be normalized with Rebecca flow rules.
- `tgId`: optional Telegram id.
- `created_at` / `updated_at`: millisecond timestamps where present.

### Credential Mapping

- VMess/VLESS:
  - Parse `client.id` as UUID.
  - Store proxy settings with the same UUID.
  - Derive Rebecca `credential_key` using the same UUID mask/key logic used by current Go user code.
- Trojan:
  - Use `client.password`.
  - Store as Trojan proxy settings.
- Shadowsocks:
  - Read method from inbound-level `settings.method`.
  - Read password from client-level `password`.
  - Preserve `ivCheck`/`iv_check` when present.
  - Shadowsocks 2022 methods were previously skipped; the Go importer should either support them deliberately or keep the skip with a clear warning.

### Status Mapping

The Go importer should resolve Rebecca user status from both inbound and client state:

- disabled inbound or disabled client -> `disabled`
- expired timestamp -> `expired`
- `used_traffic >= data_limit` when data limit exists -> `limited`
- otherwise -> `active`

### Username And Conflict Rules

The old flow supported a preview step and per-inbound conflict policy:

- Username source priority:
  - `email`
  - `subId`
  - `comment`
  - fallback: `{protocol}-{inbound_id}`
- Sanitize usernames:
  - allow `a-z`, `A-Z`, `0-9`, `_`, `.`, `@`, `-`
  - collapse invalid characters to `_`
  - max length: 32
  - min length: 3
- Username conflict modes:
  - `rename`: append numeric suffix.
  - `skip`: skip conflicting imported users.
  - `overwrite`: update the existing Rebecca user.
- Source duplicate subaddress modes:
  - `keep_first`: import first occurrence and skip later source duplicates.
  - `skip_all`: skip every occurrence in a duplicate source group.
- Existing Rebecca subaddress modes:
  - `overwrite`: update the matching Rebecca user.
  - `skip`: skip the imported user.

### Rebecca Writes

The Go importer should write the same logical fields as the current Go user mutation layer:

- `users.username`
- `users.credential_key`
- `users.subadress`
- `users.flow`
- `users.status`
- `users.used_traffic`
- `users.data_limit`
- `users.data_limit_reset_strategy = no_reset`
- `users.expire`
- `users.admin_id`
- `users.service_id`
- `users.note`
- `users.telegram_id`
- `users.ip_limit`
- `users.sub_updated_at`
- `users.edit_at`
- proxy rows with protocol-specific settings
- excluded inbound links, if a service assignment requires them

The importer must not bypass Go-native admin/service/user validation. It should
reuse the Go user mutation repository/core where possible instead of duplicating
limit logic.

### Preview Response

The preview endpoint should be restored before import. It should report:

- source inbound count
- supported inbound count
- source client count
- importable client count
- skipped unsupported/invalid clients
- per-inbound metadata:
  - inbound id
  - remark
  - protocol
  - source tag/port/network/security where present
  - raw client count
  - importable client count
  - username conflicts
- duplicate subaddress groups
- available owner admins
- available services with assigned admin ids and supported protocols

### Job/Progress Model

The old Python importer used in-memory jobs. The Go version should use persistent
progress storage so restarts do not lose state. Recommended fields:

- job id
- preview id
- status: `pending`, `running`, `completed`, `failed`
- progress current/total
- message
- result counters
- warnings
- created_at/updated_at

The job store can be a new DB table or a generic operations table, but it must not
depend on Python memory.

## Go Rebuild Requirements

- Parse 3x-ui SQLite backups in Go.
- Preview supported inbounds and clients without writing DB state.
- Preserve username/subaddress conflict policies.
- Support owner admin and service assignment.
- Enforce Go-native admin and per-service limits before import.
- Write users, proxies, service assignment, traffic fields, and subscription metadata in one transaction.
- Enqueue the required `node_operations` in the same transaction.
- Roll back the full import batch when DB writes or operation enqueue fails.
- Provide progress reporting without Python in-memory jobs.
- Add Telegram/report hooks only after Go Telegram handling is implemented.

## Cleanup Follow-up

After the Go importer exists, add new Go tests and remove this TODO file.
