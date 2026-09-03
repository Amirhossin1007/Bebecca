---
title: "HAProxy shared ports"
weight: 4
description: "Route several Xray inbounds, TCP services, and lightweight websites through shared public ports on selected nodes."
adminOnly: true
---

<span id="section-haproxy-admin"></span>

Rebecca can run HAProxy on selected nodes and use one public TCP port for several destinations. HAProxy reads the beginning of each connection, matches an SNI, HTTP Host, or HTTP Path, then passes the original TCP stream to the correct Xray inbound, external service, or website. It does not decrypt Xray traffic.

<p class="rb-panel-actions"><a class="rb-panel-button" data-primary="true" href="#" data-panel-route="/haproxy">Open HAProxy</a><a class="rb-panel-button" href="#eligible-inbounds">Check inbound eligibility</a><a class="rb-panel-button" href="#troubleshooting">Troubleshooting</a></p>

{{< callout type="warning" >}}
The public port belongs to HAProxy after the configuration is enabled. Do not leave Xray, Nginx, Apache, OpenVPN, or another process listening on the same address and port. Every selected Xray inbound also needs its own different backend port.
{{< /callout >}}

## What Rebecca manages

A configuration has four levels:

1. A **configuration** contains shared advanced settings and one or more target nodes.
2. A **target** is a Rebecca node that will run this configuration.
3. A **listener** is one public TCP address and port on that target, such as `0.0.0.0:443`.
4. A listener contains **routes** and optional **websites**. Routes point to Xray inbounds or external TCP services. Websites handle ordinary HTTP or TLS traffic.

You can create several HAProxy configurations in the panel. A node can belong to only one of them at a time, but one configuration can contain many nodes. Each target can have up to 16 listeners, so a node can use ports `443`, `550`, and any other valid TCP port in the same configuration. Each port has its own routes and websites.

Rebecca Node validates the generated file with `haproxy -c` before replacing the active configuration. Node installation and node update install HAProxy automatically. The Rebecca Node Docker image also contains HAProxy. If an older node reports that HAProxy is missing, update that node before enabling the configuration.

## Before you start

- Update the master panel and every target node to a build that includes HAProxy support.
- Check that the intended public ports are free with `ss -lntp` on each target node.
- Open the public TCP ports in the node firewall and provider firewall.
- Give every Xray inbound a private backend port different from the HAProxy public port.
- Decide how each connection can be recognized. Use a unique SNI, HTTP Host, or HTTP Path whenever possible.
- Keep one working management path to the node. A wrong listener or firewall rule should not lock you out of SSH.
- Save the configuration disabled first, inspect the **Editor** output, then enable it.

## Quick setup: several services on port 443

This example sends three kinds of traffic through `443`:

| Incoming traffic | Detection | Destination |
| --- | --- | --- |
| VLESS Reality | SNI `edge.example.com` | Xray inbound on `127.0.0.1:5424` |
| VLESS WebSocket | HTTP Path `/ws-main` | Xray inbound on `127.0.0.1:5425` |
| Ordinary HTTPS | SNI `www.example.com` | A website with a managed panel certificate |

1. Prepare the two Xray inbounds on the target node. Give them different ports, tags, and detection values.
2. Open **HAProxy** and select **Create HAProxy**.
3. Enter a configuration name. Leave **Enabled** off while building the first draft.
4. Select the target node and press **Add target**.
5. In `listener-1`, keep **Listen address** at `0.0.0.0` and set **Public port** to `443`.
6. Select the Reality inbound from **Compatible Xray inbound**. Choose its SNI matcher and press **Add inbound**.
7. Select the WebSocket inbound with the `/ws-main` matcher and add it.
8. Press **Add website**, enable it, enter `www.example.com`, choose **Certificate from panel SSL**, and select the matching active certificate.
9. Pick a built-in, TemplateMo, or uploaded static template.
10. Open **Editor**. Rebecca validates the draft and shows the exact HAProxy file for the target node.
11. Return to **Form**, enable the configuration, and press **Save**.

Test every branch separately. A successful website response proves only the website branch. It does not prove the VLESS routes.

## How HAProxy recognizes a connection

All generated listeners use TCP mode. HAProxy waits for the configured inspection delay and checks the bytes that are visible before forwarding the stream.

| Detection method | What HAProxy reads | Typical use |
| --- | --- | --- |
| `sni` | The hostname in a TLS ClientHello | TLS, Reality, HTTPS websites, and TLS based external services |
| `http_host` | The HTTP `Host` header | Plain HTTP transports that use different hostnames |
| `http_path` | The beginning of the HTTP request path | WebSocket, HTTPUpgrade, SplitHTTP, or another HTTP transport with a unique path |
| `default` | No signature. It receives traffic not matched earlier | One raw encrypted protocol or one fallback service |

SNI inspection does not terminate TLS for Xray and external routes. HAProxy reads the ClientHello and passes the untouched connection to the backend. A website is different: the node website server terminates TLS using the certificate selected for that website.

Matchers must be unique inside one listener. The same listener may have only one `default` route. A TLS website hostname cannot equal an SNI route on that listener because both would match the same connection.

## Eligible Xray inbounds {#eligible-inbounds}

The inbound selector is generated from the selected node's actual Xray configuration. An inbound needs a nonempty tag, a valid port, and a usable matcher. Rebecca derives the matcher from `streamSettings`.

| Inbound transport or security | Matcher shown by Rebecca | Requirement |
| --- | --- | --- |
| Plain WebSocket, HTTPUpgrade, SplitHTTP, or another HTTP transport | `http_path` | A nonempty path in the transport settings |
| Plain HTTP transport with a Host value or `headers.Host` | `http_host` | A valid and unique hostname |
| TLS transport with a transport Host | `sni` | A valid and unique hostname |
| TLS with `tlsSettings.serverName` | `sni` | A valid and unique server name |
| Reality with `realitySettings.serverNames` | One `sni` choice for each server name | Select one SNI that the client really sends |
| Non-Shadowsocks inbound without any value above | `default` | It must be the only default route on this listener |
| Shadowsocks | Path based matcher | A nonempty transport path is required. Without it, the inbound is hidden from the selector. |

{{< callout type="info" >}}
An inbound without a Path or SNI is not always rejected. Non-Shadowsocks inbounds can appear as a `default` candidate, but only one default destination can exist on a listener. Shadowsocks is stricter and must have a transport Path before it becomes selectable.
{{< /callout >}}

Encrypted raw connections with no visible SNI, Host, or Path look identical to HAProxy. They cannot share one port as separate routes. Put one of them on a different listener, or use one as the default route. Changing the route name does not make the traffic distinguishable.

### Why an inbound is missing from the selector

Check these items on the same target node:

1. The inbound has a nonempty `tag`.
2. Its port is between `1` and `65535` and differs from the public listener port.
3. A Shadowsocks inbound has a transport Path.
4. The SNI, Host, or Path is present in the generated Xray configuration for this node, not only in a host or service draft.
5. The inbound has not already been added to this listener.
6. The target card is open. Candidate data is loaded when **Show settings** is enabled.

## Form tab field reference

### Configuration fields

| Field | Meaning |
| --- | --- |
| **Configuration name** | Internal panel name. It does not change a hostname, Xray tag, or HAProxy frontend name. Maximum length is 128 characters. |
| **Enabled** | Applies the generated configuration to every selected target. Turn it off to keep the draft without running HAProxy for it. |
| **Target node** | Selects a node for this configuration. Disabled nodes are labeled and cannot be selected. A node already owned by another HAProxy configuration is unavailable. |
| **Add target** | Creates a target card with one initial listener. A configuration requires at least one target and supports up to 256 targets. |
| **Template name**, **ZIP**, **Upload** | Adds a reusable static template to the panel. The ZIP must contain `index.html`, contain only safe static files, and be no larger than 32 MiB. Extracted content is limited to 128 MiB. |

### Target card controls

| Control | Meaning |
| --- | --- |
| **Show settings** | Expands or collapses this target. Collapsing changes only the UI and does not disable the node. Cloned targets start collapsed to keep a large configuration readable. |
| **Randomize TemplateMo websites** | Used by the clone action. When enabled, each cloned target receives different catalog choices for its TemplateMo websites where alternatives exist. Other settings stay unchanged. |
| **Clone to all available nodes** | Copies this target's listeners, routes, sites, and settings to every active node that is free for this configuration. |
| **Remove target** | Removes the node from this draft. The change reaches the node after you save. |

Clone is deliberately strict. For each Xray route, the destination node must have the same inbound tag and the same matcher type and value. Rebecca updates the backend port from that destination node's own Xray config. If any required inbound is missing, the whole destination target is skipped and the warning names the node and inbound. Disabled nodes are never cloned.

### Listener fields

| Field | Meaning |
| --- | --- |
| **Listener name** | An internal label, up to 64 characters. Listener names must be usable as single-line text. |
| **Listen address** | Local address HAProxy binds on the node. `0.0.0.0` listens on all IPv4 addresses. `::` listens on IPv6. A specific IP limits the listener to that node address. |
| **Public port** | TCP port clients connect to. Valid range is `1` to `65535`. The same address and port cannot be repeated on one target. |
| **Show port settings** | Expands or collapses this listener card. Collapsing it changes only the form layout; the port stays in the saved configuration. |
| **Accept incoming PROXY protocol** | Requires clients or an upstream load balancer to prepend a valid PROXY protocol header. Leave this off for direct internet clients. Turning it on for ordinary clients breaks their connections. |
| **Compatible Xray inbound** | Lists only candidates detected on this target node. Each choice shows the tag, protocol, network, and matcher. |
| **Add inbound** | Adds the selected Xray candidate as a route to `127.0.0.1` and the inbound's real port. Backend fields are locked to the node config. |
| **Add external service** | Adds a manually configured TCP backend for OpenConnect, OpenVPN TCP, a local service, or another non-Xray destination. |
| **Add port / listener** | Adds another independent public address and port to this target. Routes and websites are not copied from the previous listener. |
| **Remove listener** | Deletes this listener from the draft. Every target must keep at least one listener. |

A target supports up to 16 listeners. A listener supports up to 32 routes and 16 websites. It must contain at least one route or one enabled website.

### Xray route card

An Xray card is read only except for removal because its destination comes from the selected node configuration.

| Display | Meaning |
| --- | --- |
| Route name | The Xray inbound tag. |
| `sni`, `http_host`, `http_path`, or `default` | The exact matcher HAProxy will use. |
| `127.0.0.1:port` | The backend address and the actual inbound port on this target. |
| Protocol | The Xray protocol reported by this node. |

### External service fields

| Field | Meaning |
| --- | --- |
| **Route name** | A unique internal name, up to 64 characters. |
| **Backend host** | Destination IP or hostname reachable from the node. Use `127.0.0.1` for a service running on the same node. |
| **Backend port** | Destination TCP port. It cannot point back to the same loopback port as the listener. |
| **Detection method** | `sni`, `http_host`, `http_path`, or `default`. Choose only a value that the real client sends. |
| **Detection value** | Hostname or path to match. It is disabled for `default`. Paths must begin with `/` and are limited to 512 characters. |

Route names and matcher pairs must be unique inside a listener. A backend hostname must be valid, and every backend port must be between `1` and `65535`.

## Websites on a shared port

Websites are optional. They are useful when ordinary browser traffic should receive a real page while Xray or other TCP traffic continues to its own route. The node serves static files and HAProxy connects to that local site through a Unix socket, so no extra public website port is opened.

### Website fields

| Field | Meaning |
| --- | --- |
| Website switch | Enables or disables this website without deleting its fields. Disabled websites are not generated. |
| **Default HTTP/HTTPS website** | Available on the first website only. Unmatched HTTP and HTTPS traffic goes to this site after all route and hostname rules. It cannot be enabled while the listener has a `default` Xray or external route. |
| **Show settings** | Expands or collapses this website card without enabling or disabling the site. |
| **Website name** | Internal label, up to 64 characters. If empty, Rebecca uses the hostname. |
| **Hostname / SNI** | Host used for HTTP Host matching or TLS SNI matching. It is optional for the default website and required for other TLS websites. Other websites also need a hostname when a default website is enabled. |
| **TLS certificate** | Selects plain HTTP, an automatic self-signed certificate, a managed panel certificate, or certificate files already on the node. |
| **Template source** | Selects the lightweight built-in page, TemplateMo, or an uploaded ZIP. |
| **Template selection** | For TemplateMo, choose either the panel catalog or one TemplateMo page URL. These modes are exclusive. |
| **Template** | Chooses a catalog or uploaded template. |
| **TemplateMo page URL** | Accepts a page URL such as `https://templatemo.com/tm-632-machina`. Rebecca converts it to the matching download, and the node downloads and caches the ZIP. |
| **Open template preview** | Opens the TemplateMo page or available preview. It does not publish or save the configuration. |
| **Custom 404 HTML** | Replaces the not-found response for this website only. Maximum size is 64 KiB. Leave it empty to use the normal static file response. |

TemplateMo URLs must use HTTPS, the `templatemo.com` host, and the `/tm-NNN-name` page format. Uploaded archives must have an `index.html`. PHP, WordPress, databases, and other server-side code are not run; this website feature serves static files only.

### TLS certificate modes

| Mode | Behavior and use |
| --- | --- |
| **No TLS (plain HTTP)** | Serves ordinary HTTP. A hostname is optional. Without a hostname, the first matching plain HTTP site can receive general HTTP traffic not claimed by an earlier route. |
| **Automatic self-signed certificate** | The node creates and caches a certificate for the hostname. Browsers will warn because the certificate is not signed by a trusted public CA. Useful for tests, not a normal public site. |
| **Certificate from panel SSL** | Select an active certificate already managed by Rebecca. The certificate must cover the website hostname. The panel securely sends its PEM data to the selected node during sync. |
| **Certificate paths on node** | Enter absolute paths to the fullchain and private key on that node, for example `/etc/ssl/example/fullchain.pem` and `/etc/ssl/example/privkey.pem`. The node process must be able to read them. |

Use a separate website entry for every hostname. The default website automatically serves plain HTTP and unmatched HTTPS; when no TLS mode is selected, its HTTPS side uses a cached self-signed certificate. Several named TLS websites can share the same port because HAProxy selects them by SNI before the fallback. A certificate path is local to each node, so verify that the same paths exist before cloning a custom-certificate site.

## Advanced tab field reference

The defaults work for ordinary deployments. Change one value at a time and verify the generated configuration and live traffic afterward.

| Field | Default | Allowed range | Meaning |
| --- | ---: | ---: | --- |
| **Maximum connections** | `8192` | `128` to `1,000,000` | HAProxy `maxconn` limit for this configuration. Raising it also requires enough file descriptors, memory, and kernel capacity on every target. |
| **Inspection delay (ms)** | `5000` | `100` to `30000` | Maximum time HAProxy waits for enough ClientHello or HTTP bytes to choose a route. Too short can miss slow clients; too long delays ambiguous connections. |
| **Connect timeout (ms)** | `5000` | `100` to `60000` | Time allowed to establish a connection to the selected backend. |
| **Client timeout (seconds)** | `3600` | `1` to `86400` | Inactivity timeout on the client side of the proxied TCP stream. |
| **Server timeout (seconds)** | `3600` | `1` to `86400` | Inactivity timeout on the backend side. Long-lived tunnels may need a longer value. |
| **Connection retries** | `3` | `0` to `10` | Number of backend connection retries. It does not replay an established user session. |
| **Enable TCP health checks** | On | On or off | Adds TCP checks to route backends. A successful TCP connect marks the destination reachable; it does not perform a protocol login. |
| **Check interval (ms)** | `2000` | `100` to `60000` | Time between backend TCP checks. |
| **Healthy after successes** | `2` | `1` to `10` | Consecutive successful checks required before a backend is considered healthy again. |
| **Down after failures** | `3` | `1` to `10` | Consecutive failed checks required before a backend is marked down. |
| **Log level** | `info` | `silent`, `emerg`, `alert`, `crit`, `err`, `warning`, `notice`, `info`, `debug` | Amount of HAProxy output written to the Rebecca Node service logs. Use `debug` only while investigating because it can be noisy. |
| **TCP keepalive** | On | On or off | Enables client-side and server-side TCP keepalive in HAProxy. |
| **Do not log empty connections** | On | On or off | Suppresses connections that close without sending useful data. Turn it off temporarily when investigating scans or early disconnects. |

## Editor tab and saving

Opening **Editor** sends the draft to the backend for validation and generation. The editor is read only and shows one final HAProxy configuration per target node. Use **Refresh** after changing the form.

Review these lines before enabling a draft:

- Each `bind` address and port is correct.
- Each `acl` contains the intended SNI, Host, or Path.
- Each `use_backend` points to the expected route.
- The `default_backend` is present only when you intentionally added a default route.
- Each Xray `server target` uses the destination node's correct backend port.

**Save** stores the draft and queues it for node synchronization. An enabled configuration is applied when the node receives the new runtime state. Disabling and saving stops the HAProxy runtime and its local website servers for that configuration on the target.

## Cloning one target to many nodes

Configure and test one source target first. Then:

1. Expand that target with **Show settings**.
2. Turn on **Randomize TemplateMo websites** if each destination should use a different catalog template.
3. Press **Clone to all available nodes**.
4. Read the notification. It reports how many nodes were added and lists skipped nodes.
5. Expand a few cloned targets and check their ports, routes, certificates, and websites before saving.

The clone copies every listener. If the source has ports `443` and `550`, both appear on each accepted destination. Template randomization changes only TemplateMo choices. Built-in and uploaded templates stay unchanged. A direct TemplateMo URL is replaced with a catalog choice when randomization is enabled.

Rebecca skips a destination if it is disabled, already belongs to another configuration, cannot be inspected, or lacks any required Xray tag and matcher. Generated target cards start collapsed.

## Non-Xray protocol support

This feature routes TCP. Protocol support depends on whether the traffic uses TCP and exposes a reliable matcher.

| Protocol or service | Supported here? | Recommended setup |
| --- | --- | --- |
| OpenVPN TCP | Yes | Use a dedicated listener or the single `default` external route. Standard OpenVPN traffic usually has no HTTP Path or useful SNI. |
| OpenVPN UDP | No | HAProxy TCP listeners cannot receive or split UDP. |
| WireGuard | No | WireGuard uses UDP. Keep its UDP port outside this HAProxy configuration. |
| L2TP/IPsec | No | L2TP/IPsec depends on UDP ports such as `1701`, `500`, and `4500`. |
| OpenConnect or Cisco AnyConnect TCP/TLS | Usually | Add it as an external service. Use SNI only if the client really sends a distinct hostname; otherwise use a dedicated listener or default route. UDP acceleration is outside this feature. |
| SSH, database, or another raw TCP service | Yes | Use a dedicated listener or default route unless the protocol exposes a supported SNI or HTTP signature. |
| HTTP or HTTPS service | Yes | Use `http_host`, `http_path`, `sni`, or the built-in website feature. |

HAProxy cannot infer a protocol merely from its route name or backend port. Two opaque encrypted streams without distinct visible bytes need different public ports.

## Practical layouts

### Two public ports on every target

- Listener `public-443`: `0.0.0.0:443`, Xray SNI and Path routes, plus HTTPS websites.
- Listener `vpn-550`: `0.0.0.0:550`, one OpenVPN TCP external route using `default`.

Press **Add port / listener** inside the target card to create the second listener. Do not type two ports into **Public port**; that field accepts one port because each listener has its own complete routing table.

### Several TLS websites on port 443

Create one listener on `443`. Add a website for each hostname and select a certificate mode for each one. HAProxy reads SNI and sends each connection to the matching local website. Hostnames must be unique and must not duplicate an Xray SNI route.

### VLESS WebSocket plus an ordinary website

Give the WebSocket inbound a unique path such as `/private-ws`. Add it as an `http_path` route. Add a plain HTTP website, optionally with a hostname. Route rules are evaluated before website handling, so `/private-ws` reaches Xray while other matching HTTP requests reach the site.

### One opaque TCP service as fallback

Add every detectable SNI, Host, and Path route first. Add the opaque service as one external `default` route. Unmatched traffic reaches that backend. This is safe only when sending all unknown TCP traffic to that service is intentional.

## Troubleshooting {#troubleshooting}

| Symptom | Checks |
| --- | --- |
| HAProxy page has no selectable node | The node may be disabled, deleted, already selected in this draft, or owned by another HAProxy configuration. |
| Xray inbound is missing | Check its tag, port, node assignment, and matcher. Shadowsocks needs a Path. Other raw inbounds may appear only as `default`. |
| Save reports a duplicate matcher | Two routes on the same listener use the same matcher type and value. Change the inbound transport setting or put one route on another listener. |
| Save reports more than one default | Keep either one default route or the first website as the default. Give every other destination a visible matcher or a separate public port. |
| Website hostname conflicts with a route | The same SNI is used by a TLS website and an Xray or external route. Give them different hostnames. |
| Managed certificate is rejected | The certificate must be active in panel SSL and cover the website hostname. Check both the selected domain and certificate files. |
| Custom certificate fails on one clone | Custom paths refer to files on each node. Copy the files to that node and check permissions, or use a managed certificate. |
| Uploaded template does not reach a node | The panel needs a usable `REBECCA_PUBLIC_URL`, and the node must have an enrolled certificate so it can fetch the archive. |
| TemplateMo download fails | Confirm the node has outbound HTTPS access and that the URL is a TemplateMo page in `/tm-NNN-name` format. |
| HAProxy is not installed | Update or reinstall Rebecca Node. Current binary installation, update, and Docker image include the package. |
| Port is already in use | Stop or move the process currently bound to that address and port. Also confirm no selected Xray inbound uses the public listener port. |
| Route works on one node but clone is skipped on another | The destination must contain the same inbound tag and exact matcher. Create or enable that inbound on the destination, then clone again. |
| Slow clients reach the wrong backend | Increase **Inspection delay** carefully and confirm the client sends the expected SNI, Host, or Path. |
| Connections close after an hour | Check client and server inactivity timeouts. Long-lived tunnels may need values above the `3600` second default. |

For node-side errors, inspect Rebecca Node service logs. HAProxy validation, missing package, template download, certificate, and bind failures are reported there. Temporarily use the `debug` log level only when the normal log does not show enough detail.

## Final checklist

- Every target is active and belongs to only this HAProxy configuration.
- Every public address and port is free before HAProxy starts.
- Every selected Xray inbound has a different backend port.
- SNI, Host, and Path values are unique inside each listener.
- Each listener has at most one fallback: either a default route or its first website marked as default.
- TLS website hostnames do not conflict with route SNI values.
- Managed certificates are active and cover their website hostnames.
- Custom certificate paths exist on every relevant node.
- The Editor output matches the intended routes on every target.
- Each traffic type has been tested independently after saving.
