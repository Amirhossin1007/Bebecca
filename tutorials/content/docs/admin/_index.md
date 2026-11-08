---
title: "Administration"
weight: 5
description: "Manage nodes, HAProxy, admins, roles, Telegram, SSL, hosts, external apps, Xray, monitoring, service automation, and scheduled backups."
adminOnly: true
---

Administration contains system-wide tasks. It is shown only to `sudo` and `full_access` administrators because these actions can change infrastructure, permissions, or shared services.

## Guides

- [Service inbound auto-assign](service-auto-inbound/) — select a service automatically from inbound tags.
- [Telegram backup activation](telegram-backup/) — connect the bot and schedule panel backups.
- [Nodes](nodes/) — create the node in the panel first, copy its install bundle, and connect the node host.
- [HAProxy shared ports](haproxy/) — route several Xray inbounds, TCP services, and websites through shared public ports on selected nodes.
- [Admins](admins/) — create administrators and apply limits.
- [Admin roles](roles/) — understand the access level behind each role.
- [Telegram bot and notifications](telegram-bot/) — connect the admin bot, choose events, and use its commands.
- [External apps](external-apps/) — deploy PHP or static applications such as MirzaBot or Faoxima with their own certificate and database.
- [SSL certificates](ssl-certificates/) — issue, import, renew, and serve TLS certificates by domain.
- [Hosts](hosts/) — turn each inbound into the addresses and options clients receive.
- [Errors and diagnostics](errors-and-diagnostics/) — read problems by severity and open the section that fixes each one.
- [Xray core settings and logs](xray-core/) — edit the core configuration, routing, and logs with care.
- [Usage, live connections, and recent actions](monitoring/) — track traffic, see connected platforms, and roll back recent changes.
- [Subscription placeholders](subscription-placeholders/) — show clear messages for expired, limited, or disabled subscriptions.

{{< callout type="warning" >}}
Confirm the target and keep a current backup before changing nodes, roles, or shared integration settings.
{{< /callout >}}
