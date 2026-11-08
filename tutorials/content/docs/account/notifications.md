---
title: "Notifications"
weight: 2
description: "Read messages from other admins and automatic alerts, send messages to admins, and understand the thresholds for automatic alerts."
---

The bell in the header shows your recent notifications. The **Notifications** page has three tabs: **Inbox**, **Send message**, and **Automatic alerts**.

<p class="rb-panel-actions"><a class="rb-panel-button" href="#" data-panel-route="/notifications">Open Notifications</a></p>

## Inbox

- New messages are marked **New** until you read them.
- **Mark as read** marks one message. **Mark all as read** clears the whole inbox.
- Each message shows the admin who sent it.

## Send a message

1. Enter a **Title** and a **Message**.
2. Choose the **Recipients**: **All other admins**, or **Selected admins**.
3. Click **Send**.

**Sent messages** lists your past messages and how many recipients have read each one.

## Automatic alerts

Automatic alerts are sent to admins automatically. Each alert is sent once when its condition starts. It is sent again only after the condition clears and then happens again. You can enable or disable each rule, change its threshold, or reset it to the default.

| Alert | Who receives it |
| --- | --- |
| Traffic usage reaches the threshold | The admin the rule applies to |
| Admin account expires soon | The admin the rule applies to |
| Users reach the admin limit | The admin the rule applies to |
| Node enters an error state | Sudo and full access admins |

Keep thresholds low enough to act on in time. A threshold set too high can give you a warning after the limit has already been reached.
