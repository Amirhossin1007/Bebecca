---
title: "Telegram bot and notifications"
weight: 1
description: "Connect the admin bot, limit who can use it, send events to the right chats or forum topics, and use the bot commands."
adminOnly: true
---

Rebecca's Telegram bot gives administrators quick access to users, usage, and system status. It can also send operational notifications to the chats you choose. Scheduled backups are configured separately in [Telegram backup activation](../telegram-backup/).

<p class="rb-panel-actions"><a class="rb-panel-button" data-primary="true" href="#" data-panel-route="/settings#telegram">Open Telegram tab</a></p>

## Before you start

- Create a bot with BotFather and keep its token private. Anyone with the token can control the bot.
- Get the numeric ID of every chat that should use the bot. Group and channel IDs are usually negative numbers.
- The bot answers only the chats listed in **Admin Chat IDs**. Messages and button presses from other chats are ignored.

## Connect the bot

1. Paste the **Bot API Token** into the Telegram tab.
2. Enter one or more numeric **Admin Chat IDs**, separated by commas.
3. Turn on **Enable Telegram bot**. You can turn it off later without clearing the token.
4. Set a **Proxy URL** only when the panel host cannot reach Telegram directly.
5. Click the shared **Save Settings** button, then click **Send test message**.

{{< callout type="info" >}}
Every tab uses the same **Save Settings** button. Save your changes before you send a test, so the test uses the current token and chat IDs.
{{< /callout >}}

## Send events to the right place

- **Logs Chat ID** receives error and report messages. Use the numeric ID of the target group or channel. Leave it empty to use the admin chats.
- If the destination is a forum, turn on **Logs chat is a forum** and set a **Topic ID**. Leave the topic ID empty to let the bot create the topic.
- Backup messages have the same forum options in the backup settings.

## Choose events

The Telegram tab groups notifications so you can enable only the events that need attention:

| Group | Examples |
| --- | --- |
| User events | User created, updated, or deleted; status change; usage reset; subscription revoked; auto renew set or applied. |
| Admin events | Admin created, updated, or deleted; admin usage reset; admin data limit or users limit reached. |
| Node events | Node created or deleted; node connected, connecting, disabled, limited, or in error; node usage reset; node error logs. |
| Login events | Administrator login attempts. |
| Error events | Errors reported by the system. |

Sending every event to one chat makes real alerts easy to miss. Keep routine user activity in one chat, and send node and error alerts to a chat that someone checks often.

## Bot commands

Send these commands from an allowed chat:

| Command | Result |
| --- | --- |
| `/user <username>` | Shows a user and offers actions to manage it. |
| `/usage <username>` | Shows a user's usage. |
| `/system` | Shows the system status. |
| `/help` | Lists the commands. `/start` shows the same help. |

The bot also shows a main menu, and some actions ask a follow-up question. Button presses are checked against the same allowlist as messages.

## Troubleshooting

- **No reply**: check that the chat ID is in **Admin Chat IDs**. Group IDs are negative, so copy the full value including the minus sign.
- **Test message fails**: check the token, the proxy URL, and whether the bot is a member of the group and allowed to post.
- **Messages land in the wrong place**: check the forum option and the topic ID for that destination.
