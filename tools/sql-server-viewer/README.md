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
