---
title: "Hosts"
weight: 8
description: "Create host entries that turn an inbound into the address, port, SNI, and transport options that clients receive."
adminOnly: true
---

A host decides what each client receives for an inbound. The inbound defines the protocol and transport. The host defines the public address and port, plus optional overrides. One inbound can have several hosts, for example for different domains or CDN addresses.

<p class="rb-panel-actions"><a class="rb-panel-button" data-primary="true" href="#" data-panel-route="/hosts">Open Hosts</a></p>

The Hosts page has two tabs:

- **Hosts** controls the host overrides, their order, and their routing for each inbound.
- **Inbounds** manages every inbound, with its transport and security options in one place.

## Add a host

1. Open **Hosts** and click **Add host**.
2. Choose the **Inbound**. The host inherits its protocol and transport from it.
3. Enter the **Remark**, which is the name users see in their client.
4. Enter one or more **Address** values. Several addresses are rotated.
5. Leave **Port** empty to use the inbound port, or set a port when this host is a different server.
6. Keep **Active host** turned on, then save.

Use **Clone** to copy an existing host when you only need to change its address or remark.

## Routing and TLS

Only the fields that the selected inbound supports are shown. An empty field inherits the inbound value.

- **SNI** is the server name. Set it when the host's server presents a different certificate name.
- **Request Host** is the HTTP host. Separate several values with commas. Use `*` to generate a random string for wildcard domains.
- **Path** should stay `/` unless a reverse proxy expects a different path.
- **Security layer** changes only when this host uses a different layer than the inbound.
- **ALPN** and **Fingerprint** are client TLS settings.
- **Allow Insecure** skips certificate checks. Use it only when the destination certificate cannot be verified.
- **Verify peer certificate by name** and **Certificate fingerprint (SHA-256)** pin the expected certificate. **Generate automatically** creates the fingerprint.

## Advanced options

- **FinalMask** must be empty or a valid JSON object. The field is checked before it is saved.
- **Fragment pattern** uses `length,interval,packets`, and **Noise pattern** uses `packets,delay`. Client support is limited, so check your client before you rely on them.
- **Enable MUX** asks supported clients to multiplex connections.
- **Use random user agent** generates a common User-Agent for exported configurations.
- **Per-host client settings** change client behavior for this host only.

## Remark variables

The remark can include variables that are filled in for each user when the subscription is generated:

`{DATA_LEFT}`, `{DATA_LIMIT}`, `{DATA_USAGE}`, `{DAYS_LEFT}`, `{EXPIRE_DATE}`, `{JALALI_EXPIRE_DATE}`, `{PROTOCOL}`, `{SERVER_IP}`, `{STATUS_EMOJI}`

## Changes affect every subscription

A host change applies to every subscription that uses the host. Disable a host instead of deleting it when you may need it again. Bulk actions can enable, disable, or delete several hosts at once.

{{< callout type="info" >}}
If the Errors page reports that a host's inbound does not exist in the saved Xray configuration, either restore the inbound or change the host to an existing inbound.
{{< /callout >}}
