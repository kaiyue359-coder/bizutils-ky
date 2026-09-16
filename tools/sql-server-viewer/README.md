# SQL Server Viewer

A lightweight read-only SQL Server data viewer.

SQL Server Viewer is designed for people who need to browse SQL Server data like a spreadsheet, without exposing database management features.

## What It Does

- Browse multiple SQL Server databases.
- Show a simple `Database -> Table` tree.
- View table data in a data grid.
- Server-side pagination, search, sorting, and filtering.
- Show/hide columns and resize columns.
- Display total row count and configurable page size.
- Display SQL Server `MS_Description` as secondary helper text.

## What It Does Not Do

- No create, edit, delete, or batch operations.
- No SQL editor.
- No arbitrary SQL execution endpoint.
- No DDL, schema management, index management, ER diagrams, import tools, dashboards, or low-code features.

This is a viewer, not a database manager.

## Safety Model

- Use a SQL Server read-only account.
- Keep credentials in local `.env` only.
- Do not commit `.env`.
- The backend accepts structured parameters such as database, table, page, search, filters, and sorting.
- The backend validates database/table/column names against SQL Server metadata before generating queries.
- Query values are parameterized.
- The app only generates read-only `SELECT` and `COUNT` queries.

## Requirements

- Windows, macOS, or Linux
- Node.js 20+
- A SQL Server account with read-only access

## Quick Start

Enter this tool directory after cloning the repository:

```bash
cd tools/sql-server-viewer
```

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

Do not commit `.env`. It is your private local configuration file. The repository only includes `.env.example` as a template.

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
启动 SQL Server Viewer.bat
```

The window must stay open while using the viewer. Closing the window stops the app.

## Configuration

Each user must create their own `.env` file from `.env.example`.

| Key | Required | Description |
| --- | --- | --- |
| `SQLSV_DEMO_MODE` | Yes | `true` uses demo data. `false` connects to SQL Server. |
| `SQLSV_HOST` | Yes | SQL Server host name or IP address. |
| `SQLSV_PORT` | Yes | SQL Server port, usually `1433`. |
| `SQLSV_USER` | Yes | SQL Server read-only user name. |
| `SQLSV_PASSWORD` | Yes | Password for the read-only user. Keep it only in local `.env`. |
| `SQLSV_ENCRYPT` | Yes | Whether to use encrypted SQL Server connection. |
| `SQLSV_TRUST_SERVER_CERTIFICATE` | Yes | Set to `true` for self-signed/internal certificates when needed. |
| `SQLSV_DATABASE_ALLOWLIST` | No | Optional comma-separated database allowlist. Empty means visible non-system databases. |
| `SQLSV_TABLE_ALLOWLIST` | No | Optional comma-separated table allowlist. Empty means visible tables. |
| `SQLSV_DEFAULT_PAGE_SIZE` | Yes | Default grid page size. |
| `SQLSV_MAX_PAGE_SIZE` | Yes | Maximum allowed page size. |
| `SQLSV_API_PORT` | Yes | Local backend port. |
| `SQLSV_WEB_PORT` | Yes | Local web app port. |

### `SQLSV_DEMO_MODE`

Use demo data instead of a real SQL Server connection.

```text
SQLSV_DEMO_MODE=true
```

For real SQL Server usage:

```text
SQLSV_DEMO_MODE=false
```

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
```
