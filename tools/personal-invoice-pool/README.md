# Personal Invoice Pool

A lightweight local-only web tool for tracking whether personal invoices are unused or used.

## Features

- Drag-and-drop import for PDF, OFD, XML, PNG, JPG, and JPEG invoice files.
- Local SQLite database stored under `Data/invoices.db`.
- Original invoice attachments copied into `Invoices/`.
- Local-first recognition using structured XML/OFD data, `pdftotext`, and optional local OCR.
- Duplicate protection by file hash and invoice number.
- Manual IMAP sync for invoice emails.
- Email passwords or app-specific authorization codes are stored in Windows Credential Manager, not in SQLite or source files.

## Requirements

- Node.js 24 or later.
- Windows for Credential Manager integration.
- Optional local tools:
  - `pdftotext` for PDF text extraction.
  - `tesseract` for image OCR.

No cloud AI service is used for invoice recognition.

## Start

```powershell
npm start
```

Open:

```text
http://localhost:8787
```

## Email Setup

Use the in-app "Email Settings" dialog to add an IMAP account.

For a typical SSL IMAP account:

- IMAP host: provider-specific host, for example `imap.example.com`
- IMAP port: `993`
- SSL: enabled
- Password: use an app password or authorization code if required by the provider

Secrets are saved through Windows Credential Manager.

## Data Safety

The repository intentionally ignores local data folders:

- `Data/`
- `Invoices/`

Do not commit real invoice files, local SQLite databases, email credentials, or runtime logs.

## Verification

```powershell
npm run verify
```

The verification script creates synthetic local sample data only.
