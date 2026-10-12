---
title: "Xray core settings and logs"
weight: 10
description: "Edit the Xray configuration with care, manage routing, outbounds, DNS, and logs, restart the core, and read live Xray logs."
adminOnly: true
---

The Xray settings page controls the configuration that the core runs: inbounds, outbounds, routing, DNS, and logging. The Xray logs page shows live log output from the node you select.

<p class="rb-panel-actions"><a class="rb-panel-button" data-primary="true" href="#" data-panel-route="/xray-settings">Open Xray settings</a></p>

{{< callout type="warning" >}}
An invalid Xray configuration stops the core on every node that uses it. Keep a backup of the current configuration, change one section at a time, and restart the core only after the change passes validation.
{{< /callout >}}

## Edit the template

Choose the section you want to edit:

- **Basics** covers the common settings, such as logs, DNS, and the routing strategy.
- **Advanced** opens the JSON editor for the advanced settings.
- **Complete template** edits the full Xray configuration object.
- **Inbounds**, **Outbounds**, and **Routing rules** each edit only that array in JSON.

## Logs and DNS

- **Log level**, **Access Log**, **Error Log**, and **DNS Log** control what Xray writes.
- **Auto clear** removes old log content every 1, 3, 6, or 24 hours. It can also be disabled.
- The DNS settings include servers, domain and expected-IP rules, cache, fallback, parallel queries, the query strategy, and whether the system hosts file is used. A wrong DNS server can break every connection that depends on it.
- **Fake DNS** assigns addresses from a pool to matching domains.

## Routing, outbounds, and balancers

- **Routing rules** match inbound tags, source, network, protocol, domain, IP address, and ports, then send the traffic to an outbound or a balancer. Xray uses the first matching rule, so use the up and down controls to set the order.
- **Outbounds** can be added by hand or created by a managed integration, such as Tor, Windscribe, or Psiphon on a node. Those outbounds can be checked with **Check service health**.
- Outbound tests run latency, TCP, or ICMP checks. TCP and ICMP tests need an outbound address. **Test all** runs the tests for every outbound.
- **Balancers** choose among selected outbound tags, using a strategy and a fallback.
- **Reverse proxy** connects an internal device to a public server through a VLESS connection. The UUID and flow must match on both sides.

## Test a route

**Test route** asks the selected node which outbound Xray would choose for a synthetic connection. Set the destination, port, network, inbound, and user email to match the traffic you care about.

**Test routing rule** runs a real request through a temporary Xray instance on that node, using the test URL you enter.

## Restart and statistics

- **Restart Core** applies the saved configuration. Check the logs right after the restart.
- **Statistics** shows the upload and download counters for inbounds and outbounds.

## Xray logs

<p class="rb-panel-actions"><a class="rb-panel-button" href="#" data-panel-route="/xray-logs">Open Xray logs</a></p>

1. Choose the node whose logs you want to read.
2. Filter by inbound, or search by UUID, username, email, or inbound tag.
3. Watch the **Log stream**. The socket status shows whether the live connection is open.

You need permission to view Xray logs. Turn on auto-scroll to follow new lines, and turn it off to read older lines without the view jumping.
