---
title: "Bulk actions"
weight: 6
description: "Create many users at once, change expiry or traffic for a filtered group, delete users by conditions, and update standard admin permissions in one controlled run."
---

Bulk actions apply one change to many users. Each run shows a preview of its targets and a result summary, so you can check the scope before it runs.

<p class="rb-panel-actions"><a class="rb-panel-button" data-primary="true" href="#" data-panel-route="/bulk-actions">Open Bulk Actions</a></p>

The page has four tabs: **Create**, **Edit**, **Delete**, and **Admin permissions**. You see only the tabs that your administrator permissions allow.

## Create users

1. Choose how to name the users:
   - **Numbered sequence** builds names from a prefix, a starting number, a count, a number width, and a suffix. For example, `customer-001` to `customer-050`.
   - **Username list** takes one username per line, or several separated by commas. Duplicates are removed before the run.
2. Set the shared settings for every user in the run: service, initial status, data limit, validity, IP limit, traffic reset, and auto-delete.
3. Optionally enter a **Note template**. Use `{username}` to insert each generated username.
4. Check the preview, then click **Create {count} users**.

A run creates up to 500 users. The page reports how many usernames are invalid, so you can fix them before you submit.

Use `0` in the data limit, validity, and IP limit fields for unlimited.

## Edit users

The Edit tab uses the same advanced actions as the Users page:

1. Choose a scope: **All users** or **My users**. You can also limit the scope to one service.
2. Narrow the targets with exact usernames, last connection, status age, or account age.
3. Choose the action:
   - **Expiration dates** adds or subtracts days from the expiry of every target.
   - **Usage and traffic** adds or subtracts gigabytes of traffic.
   - **Change users' service** moves the targets to another service.
   - **Cleanup** deletes users who have been expired or limited for the number of days you enter.

The status scope controls which statuses an expiry or traffic change affects.

{{< callout type="warning" >}}
These changes apply to every user in the scope and cannot be undone. Check the scope and the values before you confirm.
{{< /callout >}}

## Delete users

Deleted users cannot be restored. Choose the targets by exact usernames or by conditions. Conditions are combined, so a user must match all of them:

- **Last connection**: no connection for at least a number of days.
- **Status age**: in the current status for at least a number of days.
- **Account age**: created at least a number of days ago.
- **Statuses**: the statuses to include.

Click **Preview matching users** first. If too many users match, narrow the conditions. Tick the confirmation for the exact number of users, then click **Delete**.

## Admin permissions

The Admin permissions tab changes permissions for every standard admin at once. You can change the permission to create users, delete users, reset usage, revoke subscriptions, create on-hold users, use unlimited data or expiry, use the next plan, use advanced actions, set a flow, or use custom keys. **Restore defaults** returns these permissions to their default values.

Select the permissions to change, review the number of admins affected, then apply the change. Full access admins cannot be edited from this tab.
