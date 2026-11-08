---
title: "Subscription placeholders"
weight: 12
description: "Show a clear message instead of connection details when a subscription is expired, has used its traffic, or is disabled."
adminOnly: true
---

Subscription placeholders replace the real connection details with a short message when a subscription can no longer be used: it has expired, it has reached its traffic limit, or it was disabled manually. The client still receives a valid subscription, and the message explains why it has stopped.

<p class="rb-panel-actions"><a class="rb-panel-button" href="#" data-panel-route="/placeholders">Open Placeholders</a></p>

## How the settings are organized

- **Service defaults** apply to a service for every admin that uses it.
- Each admin can keep **Use the service default**, or turn it off to set different messages for that admin and service.
- Placeholders affect only inactive users owned by that admin in that service. Active users are not changed.
- Assign at least one service to the admin before you configure placeholders.

## Messages

Each state has its own message:

- **Expired subscription message** is shown after the expiry date has passed.
- **Traffic limit message** is shown when the subscription has used all its traffic.
- **Disabled subscription message** is shown when the subscription was disabled manually.

Turn on **Use placeholders for this service** to activate the messages for that service.

## Variables

These variables are replaced with the user's current values when the subscription is opened:

| Variable | Replaced with |
| --- | --- |
| `{USERNAME}` | The user's username. |
| `{STATUS_TEXT}` | The current status, as text. |
| `{DATA_USAGE}` | The traffic the user has used. |
| `{DATA_LIMIT}` | The user's traffic limit. |
| `{EXPIRE_DATE}` | The user's expiry date. |

Click **Save changes** after each change. To check the result, open an affected user's subscription link in a browser or client.
