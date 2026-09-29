# SQL Server Viewer

A lightweight read-only SQL Server and MySQL data viewer.

SQL Server Viewer is designed for people who need to browse SQL Server data like a spreadsheet, without exposing database management features.

## What It Does

- Browse multiple SQL Server or MySQL databases.
- Show a simple `Database -> Table` tree.
- View table data in a data grid.
- Server-side pagination, search, sorting, and filtering.
- Show/hide columns and resize columns.
- Display total row count and configurable page size.
- Display SQL Server `MS_Description` or MySQL table/column comments as secondary helper text.
- Switch between locally configured SQL Server and MySQL sources from the page header.

## What It Does Not Do

- No create, edit, delete, or batch operations.
- No SQL editor.
- No arbitrary SQL execution endpoint.
- No DDL, schema management, index management, ER diagrams, import tools, dashboards, or low-code features.

This is a viewer, not a database manager.

## Safety Model

- Use a dedicated read-only database account.
- Keep credentials in local `.env` only.
- Do not commit `.env`.
- The backend accepts structured parameters such as database, table, page, search, filters, and sorting.
- The backend validates database/table/column names against database metadata before generating queries.
- Query values are parameterized.
- The app only generates read-only `SELECT` and `COUNT` queries.

## Requirements

- Windows, macOS, or Linux
- Node.js 20+
- A SQL Server or MySQL account with read-only access

## Quick Start

Install dependencies:

```bash
npm install
```

Create a local `.env`:

```bash
cp .env.example .env
```

For Windows PowerShell:

```powershell
copy .env.example .env
```

Edit `.env`:

```text
SQLSV_DEMO_MODE=false
SQLSV_HOST=your-sql-server-host
SQLSV_PORT=1433
SQLSV_USER=readonly_user
SQLSV_PASSWORD=your_password
SQLSV_ENCRYPT=true
SQLSV_TRUST_SERVER_CERTIFICATE=true
SQLSV_DATABASE_ALLOWLIST=
SQLSV_TABLE_ALLOWLIST=
SQLSV_DEFAULT_PAGE_SIZE=100
SQLSV_MAX_PAGE_SIZE=500
SQLSV_API_PORT=3001
SQLSV_WEB_PORT=5173
```

Check SQL Server connectivity:

```bash
npm run check:sql
```

Start the app:

```bash
npm run dev
```

Open:

```text
http://127.0.0.1:5173/
```

## Windows Double-Click Start

On Windows, double-click:

```text
start-sql-server-viewer.bat
```

The window must stay open while using the viewer. Closing the window stops the app.

The Chinese launcher `启动 SQL Server Viewer.bat` is also included. If a downloaded copy closes immediately or has filename encoding issues, use `start-sql-server-viewer.bat`.

## Configuration

### `SQLSV_DEMO_MODE`

Use demo data instead of a real SQL Server connection.

```text
SQLSV_DEMO_MODE=true
```

For real SQL Server usage:

```text
SQLSV_DEMO_MODE=false
```

### `SQLSV_DB_CLIENT`

Choose the database engine. The current version supports `sqlserver` and `mysql`.

```text
SQLSV_DB_CLIENT=sqlserver
```

For MySQL:

```text
SQLSV_DB_CLIENT=mysql
MYSQL_HOST=192.168.1.20
MYSQL_PORT=3306
MYSQL_USER=viewer_readonly
MYSQL_PASSWORD=your_password
MYSQL_DATABASE_ALLOWLIST=
MYSQL_TABLE_ALLOWLIST=
```

When `SQLSV_DB_CLIENT=mysql`, the app reads database names, table names, table comments, and column comments from MySQL `information_schema`. MySQL uses its database name as the internal schema value; the interface still only shows the intended `Database -> Table` tree.

## Switching Data Sources in the Viewer

When both SQL Server and MySQL credentials are configured in local `.env`, the header shows a data-source menu. Select `SQL Server` or `MySQL` to switch immediately without editing configuration or restarting the app.

- The page shows only configured local sources; it never sends hosts, usernames, or passwords to the browser.
- The backend checks that the selected source can load metadata before completing the switch. A failed check keeps the previous source active.
- Switching clears the current table, search, filters, sorting, and column visibility so values cannot carry across databases.
- After restarting the app, the default source is still controlled by `SQLSV_DB_CLIENT`.

For a MySQL server on another computer, that computer must allow network access to port `3306`, MySQL must listen on a reachable address, and the MySQL user must be granted access from this computer's LAN IP. Prefer a dedicated read-only user:

```sql
CREATE USER 'viewer_readonly'@'YOUR_PC_LAN_IP' IDENTIFIED BY 'your_password';
GRANT SELECT, SHOW VIEW ON your_database.* TO 'viewer_readonly'@'YOUR_PC_LAN_IP';
FLUSH PRIVILEGES;
```

Use `%` only when you understand the wider network access it grants. Keep the credentials in local `.env`; never commit them.

### `SQLSV_DATABASE_ALLOWLIST`

Optional comma-separated database allowlist.

Empty means: show all non-system databases visible to the SQL Server account.

```text
SQLSV_DATABASE_ALLOWLIST=
```

Limit to selected databases:

```text
SQLSV_DATABASE_ALLOWLIST=order_data,device_management
```

### `SQLSV_TABLE_ALLOWLIST`

Optional comma-separated table allowlist.

Empty means: show all visible tables in allowed databases.

```text
SQLSV_TABLE_ALLOWLIST=
```

Limit to selected tables:

```text
SQLSV_TABLE_ALLOWLIST=orders,order_items,dbo.store_info
```

## GitHub Sharing Notes

Before pushing to GitHub:

- Confirm `.env` is not committed.
- Do not commit database passwords, tokens, cookies, or private keys.
- Do not commit `node_modules`, `dist`, or `logs`.
- Keep only `.env.example` as the public configuration template.
- Choose a license before publishing if you want others to legally reuse or modify the project.

## Scripts

```bash
npm run dev
npm run typecheck
npm run build
npm run check:sql
npm run check:connection
```
