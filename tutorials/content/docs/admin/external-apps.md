---
title: "External apps"
weight: 6
description: "Deploy isolated PHP or static web applications, such as MirzaBot or Faoxima, through Rebecca with their own domain certificate, database, and settings."
adminOnly: true
---

External apps let Rebecca host small PHP or static web applications without a separate web server. The available templates are **MirzaBot**, **Faoxima**, and a **custom PHP / HTML project** from a ZIP archive.

<p class="rb-panel-actions"><a class="rb-panel-button" data-primary="true" href="#" data-panel-route="/external-apps">Open External apps</a></p>

## Requirements

- A binary installation. External apps do not work with SQLite.
- A MySQL or MariaDB server. Each application gets its own database on that server.
- An active certificate for the application's domain, with SNI serving enabled. If you do not have one, open **SSL Manager** from the deploy dialog. See [SSL certificates](../ssl-certificates/).

## Deploy an application

1. Click **Deploy application** and enter an **Application name**.
2. Choose a **Template**:
   - **MirzaBot (latest version)** or **Faoxima (latest source)** for Telegram bot projects.
   - **Custom PHP / HTML project** to upload your own ZIP archive, or to start empty and add files later.
3. Select the **Domain and SSL certificate**.
4. For MirzaBot or Faoxima, enter the **Telegram bot token** and the **Telegram admin ID**.
5. Choose the database option:
   - **Create a dedicated MySQL / MariaDB database** gives the application its own database and user. Use **Generate all** to fill in the names and password automatically. Rebecca also gets access to this database.
   - If you have an existing SQL backup of the application, turn on the backup option and upload it. The backup can be up to 32 MiB. Rebecca imports it into the isolated database and runs `table.php` once to update an older schema.
6. Click **Deploy**.

{{< callout type="warning" >}}
Save the database password before you close the dialog. Rebecca does not store it for later display.
{{< /callout >}}

## Project ZIP rules

- The archive can be up to 32 MiB compressed and 256 MiB after extraction.
- `index.php` or `index.html` must be at the root of the archive.
- Rebecca detects the runtime, PHP or static HTML, from the uploaded ZIP. An empty project uses the static runtime.
- You can deploy without a ZIP and add files later with **Files**.

## How applications run

- Static applications do not run a background process.
- PHP applications start PHP-FPM workers when they receive requests and stop them after they are idle.
- Each application has its own Unix user and socket, so applications do not share their files or processes.
- Several Telegram bots can share one domain when each bot uses its own webhook path.

## Manage an application

Each application offers these actions:

- **Open** shows the application. For a Telegram bot application, **Open bot** opens the bot.
- **Enable** or **Disable** turns the application on or off without deleting its files.
- **Files** opens the file manager. Text files, such as PHP, HTML, CSS, JavaScript, JSON, and SQL, open in the editor. Folders cannot be downloaded.
- **PHP settings** adjust resource limits, timeouts, memory, and upload sizes within safe bounds. Security and isolation directives are locked. An invalid change is rolled back automatically.
- **Settings** control routing, errors, and performance:
  - **Default document** is the file served at the application's root, such as `index.php` or `public/index.php`. The file must already exist.
  - **Route missing paths to the default document** is for front-controller applications and single-page apps that handle paths such as `/users/42` themselves.
  - **Custom 404 document** is an optional HTML file, such as `errors/404.html`.
  - **Request body limit** sets the largest accepted request or upload, from 1 to 32 MiB.
  - **Static asset cache** sets how long browsers cache CSS, JavaScript, images, and other static files, in seconds. Use 0 to disable browser caching. HTML is always revalidated.
- **Download SQL backup** exports the application's database.
- **Update** is available for MirzaBot. It replaces the application files and keeps `config.php`, the database, and Rebecca's secrets. The pinned Composer dependencies and `table.php` run before the new files go live.
- **Delete** removes the application files. You can keep the dedicated database and database user. The SSL certificate is always kept.

{{< callout type="info" >}}
Download the application's SQL backup and take a panel backup from the Dashboard before you update or delete an application.
{{< /callout >}}
