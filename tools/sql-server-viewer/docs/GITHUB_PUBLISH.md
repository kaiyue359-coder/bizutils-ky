# Publish To GitHub

This checklist prepares SQL Server Viewer for a public or private GitHub repository.

## 1. Confirm Secrets Are Not Included

Check that `.env` is ignored:

```bash
git status --ignored
```

Only `.env.example` should be committed.

## 2. Initialize Git

```bash
git init
git add .
git status
```

Review the staged files carefully. The following should not appear:

- `.env`
- `node_modules/`
- `dist/`
- `logs/`
- AI Workstation metadata such as `PROJECT_STATE.md`

## 3. Commit

```bash
git commit -m "Initial SQL Server Viewer release"
```

## 4. Create GitHub Repository

Create an empty repository on GitHub, then connect it:

```bash
git branch -M main
git remote add origin https://github.com/<your-name>/<repo-name>.git
git push -u origin main
```

## 5. Other Users Install

Other users can download or clone the repository:

```bash
git clone https://github.com/<your-name>/<repo-name>.git
cd <repo-name>
npm install
copy .env.example .env
npm run dev
```

They must fill their own `.env` using their own SQL Server read-only account.

## 6. License

If this is intended as open source, add a license before publishing. For a permissive project, MIT is usually a simple option.
