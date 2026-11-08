---
title: "Usage, live connections, and recent actions"
weight: 11
description: "Read usage by admin, node, and service, see which platforms connected users reach, and roll back recent administrator changes."
adminOnly: true
---

Three pages show how the panel is used and what changed recently: Usage, Live Connections, and Recent Actions.

## Usage

<p class="rb-panel-actions"><a class="rb-panel-button" href="#" data-panel-route="/usage">Open Usage</a></p>

- Switch between the **Admins**, **Nodes**, and **Services** tabs to see traffic for each group.
- **Selected range total** adds up the traffic in the period you choose.
- Usage depends on recording. If node or user recording is turned off in [Settings](../../settings/), the page says so and does not record new history.

## Live connections

<p class="rb-panel-actions"><a class="rb-panel-button" href="#" data-panel-route="/access-insights">Open Live Connections</a></p>

Live Connections lists active users across Xray, OpenVPN, WireGuard, L2TP, IKEv2, and Cisco AnyConnect. Recent connections are grouped with geosite and geoip data, so you can see which platforms users reach. Check this page before you change a user or a host that seems to be in use.

## Recent actions

<p class="rb-panel-actions"><a class="rb-panel-button" href="#" data-panel-route="/recent-actions">Open Recent Actions</a></p>

Recent Actions records administrator changes. Each entry shows who made the change, which resources it affected, and a change preview with the **Before** and **After** values.

Rollback restores the state from before an action. Each action has one of these statuses:

| Status | Meaning |
| --- | --- |
| **Rollback available** | The earlier state can be restored now. |
| **Rolled back** | The action was already undone. |
| **Expired** | The rollback snapshot is too old. Only the metadata remains. |
| **Conflict** | A newer change touched the same resources, so the rollback is stopped. |
| **History only** | The action is kept for history and cannot be rolled back. |

{{< callout type="warning" >}}
Review the change preview and the changed paths before you roll back. A conflict stops the rollback instead of overwriting a newer change.
{{< /callout >}}
