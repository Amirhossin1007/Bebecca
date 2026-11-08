---
title: "Errors and diagnostics"
weight: 9
description: "Read panel problems by severity, open the section that controls each one, and understand which problems appear on the dashboard."
adminOnly: true
---

The **Errors** page lists the current problems of the panel and its nodes, grouped by severity. Check it first when something stops working. It is more complete than the dashboard, which shows only critical failures that stop a service.

<p class="rb-panel-actions"><a class="rb-panel-button" data-primary="true" href="#" data-panel-route="/errors">Open Errors</a></p>

## Severity levels

| Level | Meaning |
| --- | --- |
| **Critical** | A failure that stops a service. Critical problems also appear on the dashboard. |
| **Error** | A failed operation or broken component that needs action. |
| **Warning** | A condition that can cause a problem later. |

Use **Filter by severity** to show one level or all levels. Click **Refresh** to load the current state.

## Sources

Each problem names its source, so you know which section to open:

- **Inbound** and **Host** cover inbound and host problems. For example, a host can point to an inbound that is missing from the saved Xray configuration.
- **Xray configuration** and **Outbound / proxy service** cover configuration and proxy failures.
- **Node**, **Node synchronization**, and **Native node service** cover node connectivity, pending operations, and services running on a node.
- **Server resources** covers problems with the server's resources.
- **TLS certificate** covers certificates that are expired or misconfigured. See [SSL certificates](../ssl-certificates/).
- **HAProxy**, **Hosted application / bot**, **Outbound subscription**, **Telegram**, **Backup**, **Webhook**, and **Database** cover their own components.
- **Recent runtime warning** and **Recent runtime error** list messages from the last 15 minutes.

## Work through the problems

1. Filter to **Critical** first and fix those before anything else.
2. Click **Open section** on a problem to go directly to the page that controls it.
3. Change one thing at a time, then click **Refresh** to confirm the problem is gone.
4. Use **Show all problems** to expand a long list, and **Show fewer** to collapse it.

Failed requests from your current browser session are listed when the filter is set to all levels or to **Error**. They come from the panel's own requests, not from the system.

{{< callout type="info" >}}
A problem that returns after a fix often has a second cause. Check related sources, such as the node that serves the inbound, and refresh again.
{{< /callout >}}
