---
title: "SSL certificates"
weight: 7
description: "Issue, import, renew, and serve TLS certificates for panel domains, hosts, HAProxy, and hosted applications from the SSL tab."
adminOnly: true
---

The **SSL** tab in Settings lists every certificate the panel can serve. Each certificate covers one or more domains. Enabled certificates are selected by domain using SNI, so one panel can serve several domains.

<p class="rb-panel-actions"><a class="rb-panel-button" data-primary="true" href="#" data-panel-route="/settings#ssl">Open SSL tab</a></p>

## Get a certificate

1. Click **Get new SSL**.
2. Choose a provider:
   - **Let's Encrypt** or **ZeroSSL** issues a certificate for the domains you enter. Enter a contact email and one or more domains.
   - **Manual PEM** imports an existing certificate. Enter the domain, the `fullchain.pem` file, and the `privkey.pem` file.
3. Optionally attach the certificate to one admin.
4. Submit the request and follow its status in the list.

{{< callout type="info" >}}
Let's Encrypt and ZeroSSL issuance needs public port 80 on this server. Point the domain's DNS record to this server before you request the certificate.
{{< /callout >}}

ZeroSSL free issuance registers the ACME account with the email you enter. No access key is required, and none is stored.

## Serve and find certificates

- Search by domain, provider, or status. Use the expiry filter to see certificates that expire within seven days.
- Turn on **TLS serving** to make a certificate available for SNI. The certificate set through ENV stays as the fallback for domains that have no enabled certificate.
- Hosts, HAProxy, and hosted applications use this list. For example, [External apps](../external-apps/) lists only active certificates with SNI serving enabled.

## Renew, revoke, and delete

- **Renew** sends a renewal request for a certificate that is eligible for renewal.
- **Revoke** and **Delete** can interrupt TLS access for clients that use the domain. They do not change DNS.
- Before you revoke or delete a certificate, check which hosts, inbounds, and hosted applications use its domain, and make sure a replacement is ready.

## Troubleshooting

- **The request fails**: confirm the domain points to this server, that port 80 is reachable from the internet, and that no other service is using the port.
- **Clients still see the old certificate**: confirm the new certificate has TLS serving turned on, and that the domain matches the server name the client sends.
- **Manual import fails**: confirm the files belong to the same domain, and that the private key matches the certificate.
