# Security Policy

SQL Server Viewer is intended to be used with read-only SQL Server accounts.

## Do Not Commit Secrets

Never commit:

- `.env`
- SQL Server passwords
- API keys
- tokens
- cookies
- private keys
- production connection strings

Only `.env.example` should be committed.

## Recommended SQL Server Permission

Use a dedicated account with the minimum required read-only permissions.

At minimum, the account should only be able to read metadata and selected table data required by the viewer.

Avoid using:

- administrator accounts
- owner accounts
- accounts with write permissions
- accounts that can execute stored procedures with side effects

## Application Boundary

The app does not expose an arbitrary SQL execution endpoint.

The backend should continue to accept only structured query parameters and generate read-only queries from metadata-validated database/table/column names.

## Reporting Issues

If you find a security issue, do not include secrets or private database details in public issues. Share only the minimum reproduction details needed to understand the problem.

