import { createServer } from "node:http";
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import { createReadStream } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";
import tls from "node:tls";
import net from "node:net";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT, "Data");
const INVOICE_DIR = path.join(ROOT, "Invoices");
const PUBLIC_DIR = path.join(__dirname, "public");
const DB_PATH = path.join(DATA_DIR, "invoices.db");
const CREDENTIAL_SCRIPT = path.join(__dirname, "credential-manager.ps1");
const PORT = Number(process.env.PORT || 8787);
const MAX_BODY = 80 * 1024 * 1024;
const SUPPORTED_EXT = new Set([".pdf", ".ofd", ".xml", ".png", ".jpg", ".jpeg"]);

await fs.mkdir(DATA_DIR, { recursive: true });
await fs.mkdir(INVOICE_DIR, { recursive: true });

const db = new DatabaseSync(DB_PATH);
db.exec(`
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_date TEXT,
  amount REAL,
  buyer TEXT,
  seller TEXT,
  invoice_number TEXT,
  file_path TEXT NOT NULL,
  file_hash TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL CHECK (source IN ('email','manual')),
  status TEXT NOT NULL DEFAULT 'unused' CHECK (status IN ('unused','used')),
  used_month TEXT,
  note TEXT,
  recognition_status TEXT NOT NULL DEFAULT 'incomplete' CHECK (recognition_status IN ('success','incomplete')),
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  CHECK ((status = 'used' AND used_month IS NOT NULL AND used_month <> '') OR (status = 'unused' AND (used_month IS NULL OR used_month = '')))
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_invoices_invoice_number
ON invoices(invoice_number)
WHERE invoice_number IS NOT NULL AND invoice_number <> '';

CREATE TABLE IF NOT EXISTS email_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  imap_host TEXT NOT NULL,
  imap_port INTEGER NOT NULL,
  ssl_enabled INTEGER NOT NULL DEFAULT 1,
  enabled INTEGER NOT NULL DEFAULT 1,
  credential_reference TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS scanned_emails (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email_account_id INTEGER NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
  message_uid TEXT NOT NULL,
  message_id TEXT,
  scanned_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  result TEXT NOT NULL,
  UNIQUE(email_account_id, message_uid)
);
`);

const stmts = {
  listInvoices: db.prepare(`
    SELECT * FROM invoices
    WHERE
      (:status = '' OR status = :status)
      AND (:used_month = '' OR used_month = :used_month)
      AND (:buyer = '' OR buyer LIKE '%' || :buyer || '%')
      AND (
        :search = ''
        OR invoice_number LIKE '%' || :search || '%'
        OR buyer LIKE '%' || :search || '%'
        OR seller LIKE '%' || :search || '%'
        OR note LIKE '%' || :search || '%'
        OR invoice_date LIKE '%' || :search || '%'
        OR CAST(amount AS TEXT) LIKE '%' || :search || '%'
      )
    ORDER BY COALESCE(invoice_date, '') DESC, id DESC
  `),
  getInvoice: db.prepare("SELECT * FROM invoices WHERE id = ?"),
  findByHash: db.prepare("SELECT * FROM invoices WHERE file_hash = ?"),
  findByNumber: db.prepare("SELECT * FROM invoices WHERE invoice_number = ? AND invoice_number <> ''"),
  insertInvoice: db.prepare(`
    INSERT INTO invoices (invoice_date, amount, buyer, seller, invoice_number, file_path, file_hash, source, status, used_month, note, recognition_status)
    VALUES (:invoice_date, :amount, :buyer, :seller, :invoice_number, :file_path, :file_hash, :source, 'unused', NULL, '', :recognition_status)
  `),
  updateInvoiceFile: db.prepare(`
    UPDATE invoices
    SET invoice_date=:invoice_date, amount=:amount, buyer=:buyer, seller=:seller, invoice_number=:invoice_number,
        file_path=:file_path, recognition_status=:recognition_status, updated_at=datetime('now','localtime')
    WHERE id=:id
  `),
  editInvoice: db.prepare(`
    UPDATE invoices
    SET invoice_date=:invoice_date, amount=:amount, buyer=:buyer, seller=:seller, invoice_number=:invoice_number,
        note=:note, updated_at=datetime('now','localtime')
    WHERE id=:id
  `),
  markUsed: db.prepare("UPDATE invoices SET status='used', used_month=?, updated_at=datetime('now','localtime') WHERE id=?"),
  markUnused: db.prepare("UPDATE invoices SET status='unused', used_month=NULL, updated_at=datetime('now','localtime') WHERE id=?"),
  listAccounts: db.prepare("SELECT id,email,imap_host,imap_port,ssl_enabled,enabled,credential_reference,created_at,updated_at FROM email_accounts ORDER BY id DESC"),
  getAccount: db.prepare("SELECT * FROM email_accounts WHERE id = ?"),
  upsertAccount: db.prepare(`
    INSERT INTO email_accounts (email, imap_host, imap_port, ssl_enabled, enabled, credential_reference)
    VALUES (:email, :imap_host, :imap_port, :ssl_enabled, :enabled, :credential_reference)
    ON CONFLICT(email) DO UPDATE SET
      imap_host=excluded.imap_host,
      imap_port=excluded.imap_port,
      ssl_enabled=excluded.ssl_enabled,
      enabled=excluded.enabled,
      credential_reference=COALESCE(excluded.credential_reference, email_accounts.credential_reference),
      updated_at=datetime('now','localtime')
  `),
  scannedExists: db.prepare("SELECT id FROM scanned_emails WHERE email_account_id=? AND message_uid=?"),
  markScanned: db.prepare("INSERT OR IGNORE INTO scanned_emails (email_account_id, message_uid, message_id, result) VALUES (?, ?, ?, ?)")
};

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (req.method === "GET" && url.pathname === "/") return sendFile(res, path.join(PUBLIC_DIR, "index.html"), "text/html; charset=utf-8");
    if (req.method === "GET" && url.pathname.startsWith("/static/")) return sendFile(res, path.join(PUBLIC_DIR, url.pathname.slice(8)));

    if (req.method === "GET" && url.pathname === "/api/invoices") return json(res, listInvoices(url));
    if (req.method === "POST" && url.pathname === "/api/import") return json(res, await handleImport(req, "manual"));
    if (req.method === "GET" && url.pathname === "/api/email-accounts") return json(res, stmts.listAccounts.all());
    if (req.method === "POST" && url.pathname === "/api/email-accounts") return json(res, await saveEmailAccount(await readJson(req)));
    if (req.method === "POST" && url.pathname === "/api/sync-email") return json(res, await syncEnabledAccounts());

    const invoiceMatch = url.pathname.match(/^\/api\/invoices\/(\d+)\/(mark-used|mark-unused|recognize|open)$/);
    if (invoiceMatch && req.method === "POST") {
      const id = Number(invoiceMatch[1]);
      const action = invoiceMatch[2];
      if (action === "mark-used") return json(res, markUsed(id, await readJson(req)));
      if (action === "mark-unused") return json(res, markUnused(id));
      if (action === "recognize") return json(res, await reRecognize(id));
      if (action === "open") return json(res, openInvoiceFile(id));
    }

    const editMatch = url.pathname.match(/^\/api\/invoices\/(\d+)$/);
    if (editMatch && req.method === "PUT") return json(res, editInvoice(Number(editMatch[1]), await readJson(req)));

    const accountMatch = url.pathname.match(/^\/api\/email-accounts\/(\d+)\/test$/);
    if (accountMatch && req.method === "POST") return json(res, await testAccount(Number(accountMatch[1]), await readJson(req)));

    json(res, { error: "not_found" }, 404);
  } catch (error) {
    json(res, { error: error.message || String(error) }, 500);
  }
}).listen(PORT, () => {
  console.log(`个人发票池已启动：http://localhost:${PORT}`);
  console.log(`数据文件：${DB_PATH}`);
});

function listInvoices(url) {
  return stmts.listInvoices.all({
    search: url.searchParams.get("search") || "",
    status: url.searchParams.get("status") || "",
    used_month: url.searchParams.get("used_month") || "",
    buyer: url.searchParams.get("buyer") || ""
  });
}

async function handleImport(req, source) {
  const body = await readBody(req);
  const contentType = req.headers["content-type"] || "";
  const boundary = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/)?.[1] || contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/)?.[2];
  if (!boundary) throw new Error("missing multipart boundary");
  const parts = parseMultipart(body, boundary).filter((p) => p.filename);
  const results = [];
  for (const part of parts) {
    results.push(await importBuffer(part.data, part.filename, source));
  }
  return { imported: results.filter((r) => r.result === "imported").length, results };
}

async function importBuffer(buffer, originalName, source) {
  const ext = path.extname(originalName).toLowerCase();
  if (!SUPPORTED_EXT.has(ext)) return { file: originalName, result: "unsupported" };
  const integrity = validateInvoiceBuffer(buffer, ext);
  if (!integrity.ok) return { file: originalName, result: "invalid_attachment", reason: integrity.reason };
  const fileHash = createHash("sha256").update(buffer).digest("hex");
  const byHash = stmts.findByHash.get(fileHash);
  if (byHash) return { file: originalName, result: "duplicate_hash", id: byHash.id };

  const tmp = path.join(DATA_DIR, `tmp_${Date.now()}_${Math.random().toString(16).slice(2)}${ext}`);
  await fs.writeFile(tmp, buffer);
  try {
    const recognition = await recognizeFile(tmp, ext);
    if (recognition.invoice_number) {
      const byNumber = stmts.findByNumber.get(recognition.invoice_number);
      if (byNumber) return { file: originalName, result: "duplicate_invoice_number", id: byNumber.id };
    }
    const finalPath = await uniqueInvoicePath(recognition, ext);
    await fs.copyFile(tmp, finalPath);
    const record = normalizeRecord({ ...recognition, file_path: finalPath, file_hash: fileHash, source });
    const inserted = stmts.insertInvoice.run({
      invoice_date: record.invoice_date,
      amount: record.amount,
      buyer: record.buyer,
      seller: record.seller,
      invoice_number: record.invoice_number,
      file_path: record.file_path,
      file_hash: record.file_hash,
      source: record.source,
      recognition_status: record.recognition_status
    });
    return { file: originalName, result: "imported", id: inserted.lastInsertRowid, recognition_status: record.recognition_status };
  } finally {
    await fs.rm(tmp, { force: true });
  }
}

async function reRecognize(id) {
  const invoice = stmts.getInvoice.get(id);
  if (!invoice) throw new Error("invoice_not_found");
  const oldPath = invoice.file_path;
  const ext = path.extname(oldPath).toLowerCase();
  const recognition = await recognizeFile(oldPath, ext);
  if (recognition.invoice_number) {
    const existing = stmts.findByNumber.get(recognition.invoice_number);
    if (existing && existing.id !== id) {
      return { result: "duplicate_invoice_number", existing_id: existing.id, message: "识别到相同发票号码，已保留当前记录和原附件，未覆盖或合并。" };
    }
  }
  const targetPath = await uniqueInvoicePath(recognition, ext, id);
  if (path.resolve(targetPath) !== path.resolve(oldPath)) await fs.rename(oldPath, targetPath);
  const record = normalizeRecord({ ...invoice, ...recognition, file_path: targetPath, id });
  stmts.updateInvoiceFile.run({
    id: record.id,
    invoice_date: record.invoice_date,
    amount: record.amount,
    buyer: record.buyer,
    seller: record.seller,
    invoice_number: record.invoice_number,
    file_path: record.file_path,
    recognition_status: record.recognition_status
  });
  const updated = stmts.getInvoice.get(id);
  const missing = missingInvoiceFields(updated);
  return {
    result: "updated",
    invoice: updated,
    missing_fields: missing,
    message: missing.length ? `重新识别完成，仍缺少：${missing.join(" / ")}` : "重新识别成功"
  };
}

function normalizeRecord(input) {
  const amount = input.amount === "" || input.amount == null ? null : Number(input.amount);
  const full = Boolean(input.invoice_date && amount != null && input.buyer && input.seller && input.invoice_number);
  return {
    id: input.id,
    invoice_date: input.invoice_date || null,
    amount,
    buyer: input.buyer || "",
    seller: input.seller || "",
    invoice_number: input.invoice_number || null,
    file_path: input.file_path,
    file_hash: input.file_hash,
    source: input.source,
    note: input.note || "",
    recognition_status: full ? "success" : "incomplete"
  };
}

async function uniqueInvoicePath(recognition, ext, currentId = null) {
  const amount = Number.isFinite(Number(recognition.amount)) ? Number(recognition.amount).toFixed(2) : "0.00";
  const base = recognition.invoice_number
    ? `${safeName(recognition.invoice_number)}_${amount}${ext}`
    : `待识别_${timestamp()}_${amount}${ext}`;
  const target = path.join(INVOICE_DIR, base);
  try {
    const existing = await fs.stat(target);
    if (existing && currentId) {
      const invoice = stmts.getInvoice.get(currentId);
      if (invoice && path.resolve(invoice.file_path) === path.resolve(target)) return target;
    }
    if (recognition.invoice_number) throw new Error(`target_invoice_file_exists: ${target}`);
    return path.join(INVOICE_DIR, `待识别_${timestamp()}_${Math.random().toString(16).slice(2, 6)}_${amount}${ext}`);
  } catch (error) {
    if (error.code === "ENOENT") return target;
    if (error.message?.startsWith("target_invoice_file_exists")) throw error;
    throw error;
  }
}

async function recognizeFile(filePath, ext) {
  let text = "";
  if (ext === ".xml") text = await fs.readFile(filePath, "utf8").catch(() => "");
  else if (ext === ".pdf") text = await commandText("pdftotext", ["-layout", filePath, "-"]);
  else if (ext === ".png" || ext === ".jpg" || ext === ".jpeg") text = await ocrImage(filePath);
  else if (ext === ".ofd") text = await readOfdText(filePath);
  if (!text) text = await fs.readFile(filePath).then((b) => b.toString("utf8").replace(/\0/g, " ")).catch(() => "");
  return parseInvoiceText(text);
}

async function readOfdText(filePath) {
  const outDir = path.join(DATA_DIR, `ofd_${Date.now()}_${Math.random().toString(16).slice(2)}`);
  try {
    await fs.mkdir(outDir, { recursive: true });
    spawnSync("powershell", ["-NoProfile", "-Command", `Expand-Archive -LiteralPath '${filePath.replaceAll("'", "''")}' -DestinationPath '${outDir.replaceAll("'", "''")}' -Force`], { windowsHide: true });
    const files = await walk(outDir);
    let text = "";
    for (const file of files.filter((f) => f.toLowerCase().endsWith(".xml"))) {
      const xml = await fs.readFile(file, "utf8").catch(() => "");
      text += "\n" + xml + "\n" + extractOfdTextCodes(xml);
    }
    return text;
  } finally {
    await fs.rm(outDir, { recursive: true, force: true });
  }
}

async function ocrImage(filePath) {
  let text = await commandText("tesseract", [filePath, "stdout", "-l", "chi_sim+eng"]);
  if (!text) text = await commandText("tesseract", [filePath, "stdout", "-l", "eng"]);
  return text;
}

async function commandText(cmd, args) {
  return await new Promise((resolve) => {
    const child = spawn(cmd, args, { windowsHide: true });
    let out = "";
    child.stdout.on("data", (d) => out += d.toString("utf8"));
    child.on("error", () => resolve(""));
    child.on("close", (code) => resolve(code === 0 ? out : ""));
  });
}

function parseInvoiceText(input) {
  const text = decodeXmlEntities(`${input}\n${input.replace(/<[^>]+>/g, "\n")}`).replace(/\r/g, "\n");
  const pick = (...patterns) => {
    for (const pattern of patterns) {
      const value = text.match(pattern)?.[1]?.trim();
      if (value) return cleanField(value);
    }
    return "";
  };
  const names = pickNames(text);
  const invoiceNumber = pick(
    /发\s*票\s*号\s*码\s*[:：]\s*([A-Z0-9]{8,30})/i,
    /(?:ElectronicInvoice[^<]*Number|InvoiceNo|InvoiceNumber|Fphm)[^>]*>\s*([^<\s]+)/i,
    /<identifier[^>]*>\s*([A-Z0-9]{8,30})\s*<\/identifier>/i,
    /Invoice\s*No\.?[:：\s]*([A-Z0-9]{8,30})/i
  );
  const dateRaw = pick(
    /开\s*票\s*日\s*期\s*[:：]\s*(\d{4}[年\-\/.]\d{1,2}[月\-\/.]\d{1,2}日?)/,
    /(?:DateOfIssue|InvoiceDate|Kprq)[^>]*>\s*([^<\s]+)/i
  );
  const amountRaw = pick(
    /价税合计[\s\S]{0,120}?[（(]\s*小\s*写\s*[）)]\s*[¥￥]?\s*([0-9]+(?:\.[0-9]{1,2})?)/,
    /(?:TotalTax-includedAmount|TaxInclusiveAmount|AmountIncludingTax|Jshj)[^>]*>\s*([0-9]+(?:\.[0-9]{1,2})?)/i,
    /(?:Fare|TotalAmount)[^>]*>\s*([0-9]+(?:\.[0-9]{1,2})?)/i,
    /票价[:：]\s*[¥￥]?\s*([0-9]+(?:\.[0-9]{1,2})?)/
  );
  return {
    invoice_date: normalizeDate(dateRaw),
    amount: amountRaw ? Number(amountRaw).toFixed(2) : null,
    buyer: names.buyer || pick(/购买方名称[:：\s]*([^\n<]+)/, /购买方[\s\S]{0,80}?名称[:：\s]*([^\n<]+)/, /(?:NameOfPurchaser|BuyerName|Gfmc)[^>]*>\s*([^<]+)/i),
    seller: names.seller || pick(/销售方名称[:：\s]*([^\n<]+)/, /销售方[\s\S]{0,80}?名称[:：\s]*([^\n<]+)/, /(?:NameOfSeller|SellerName|Xfmc)[^>]*>\s*([^<]+)/i),
    invoice_number: invoiceNumber
  };
}

function pickNames(text) {
  for (const line of text.split("\n")) {
    const matches = [...line.matchAll(/名称[:：]\s*([^：:\n]+?)(?=\s{2,}|销\s*名称[:：]|$)/g)].map((m) => cleanName(m[1])).filter(Boolean);
    if (matches.length >= 2) return { buyer: matches[0], seller: matches[1] };
  }
  return { buyer: "", seller: "" };
}

function cleanField(value) {
  return cleanName(String(value).replace(/[ \t]+/g, " ").replace(/[，,。；;]+$/, ""));
}

function cleanName(value) {
  return String(value)
    .replace(/统一社会信用代码[\s\S]*$/g, "")
    .replace(/纳税人识别号[\s\S]*$/g, "")
    .replace(/[ \t]+$/g, "")
    .replace(/^[\s:：]+|[\s:：]+$/g, "")
    .replace(/[，,。；;]+$/g, "");
}

function extractOfdTextCodes(xml) {
  return [...xml.matchAll(/<ofd:TextCode\b[^>]*>([\s\S]*?)<\/ofd:TextCode>/g)]
    .map((m) => decodeXmlEntities(m[1]).trim())
    .filter(Boolean)
    .join("\n");
}

function decodeXmlEntities(value) {
  return String(value)
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function normalizeDate(value) {
  if (!value) return "";
  const m = value.match(/(\d{4})[年\-\/.](\d{1,2})[月\-\/.](\d{1,2})/);
  if (!m) return value;
  return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
}

function missingInvoiceFields(invoice) {
  const missing = [];
  if (!invoice.invoice_date) missing.push("开票日期");
  if (invoice.amount == null || !Number.isFinite(Number(invoice.amount))) missing.push("金额");
  if (!invoice.buyer) missing.push("购买方");
  if (!invoice.seller) missing.push("销售方");
  if (!invoice.invoice_number) missing.push("发票号码");
  return missing;
}

function validateInvoiceBuffer(buffer, ext) {
  if (!Buffer.isBuffer(buffer)) return { ok: false, reason: "not_buffer" };
  if (buffer.length < 16 && ext !== ".xml") return { ok: false, reason: "file_too_small" };
  if (ext === ".pdf" && !buffer.subarray(0, 5).equals(Buffer.from("%PDF-"))) return { ok: false, reason: "invalid_pdf_header" };
  if (ext === ".png" && !buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { ok: false, reason: "invalid_png_header" };
  if ((ext === ".jpg" || ext === ".jpeg") && !(buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[buffer.length - 2] === 0xff && buffer[buffer.length - 1] === 0xd9)) return { ok: false, reason: "invalid_jpeg_header" };
  if (ext === ".ofd" && !buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))) return { ok: false, reason: "invalid_ofd_zip_header" };
  return { ok: true };
}

function markUsed(id, body) {
  if (!/^\d{4}-\d{2}$/.test(body.used_month || "")) throw new Error("used_month_required");
  stmts.markUsed.run(body.used_month, id);
  return stmts.getInvoice.get(id);
}

function markUnused(id) {
  stmts.markUnused.run(id);
  return stmts.getInvoice.get(id);
}

function editInvoice(id, body) {
  const current = stmts.getInvoice.get(id);
  if (!current) throw new Error("invoice_not_found");
  const invoiceNumber = body.invoice_number || null;
  if (invoiceNumber) {
    const existing = stmts.findByNumber.get(invoiceNumber);
    if (existing && existing.id !== id) throw new Error("duplicate_invoice_number");
  }
  stmts.editInvoice.run({
    id,
    invoice_date: body.invoice_date || null,
    amount: body.amount === "" || body.amount == null ? null : Number(body.amount),
    buyer: body.buyer || "",
    seller: body.seller || "",
    invoice_number: invoiceNumber,
    note: body.note || ""
  });
  return stmts.getInvoice.get(id);
}

function openInvoiceFile(id) {
  const invoice = stmts.getInvoice.get(id);
  if (!invoice) throw new Error("invoice_not_found");
  spawn("cmd", ["/c", "start", "", invoice.file_path], { detached: true, stdio: "ignore", windowsHide: true }).unref();
  return { result: "opened" };
}

async function saveEmailAccount(body) {
  const email = String(body.email || "").trim();
  if (!email) throw new Error("email_required");
  const target = `personal-invoice-pool:${email}`;
  let credentialReference = body.password ? `wincred:${target}` : null;
  if (body.password) await credentialSet(target, email, body.password);
  stmts.upsertAccount.run({
    email,
    imap_host: body.imap_host || "",
    imap_port: Number(body.imap_port || 993),
    ssl_enabled: body.ssl_enabled ? 1 : 0,
    enabled: body.enabled ? 1 : 0,
    credential_reference: credentialReference
  });
  return { result: "saved", accounts: stmts.listAccounts.all() };
}

async function testAccount(id, body = {}) {
  const account = stmts.getAccount.get(id);
  if (!account) throw new Error("account_not_found");
  const password = body.password || await credentialGet(account.credential_reference);
  await imapConnect(account, password, true);
  return { result: "ok" };
}

async function syncEnabledAccounts() {
  const accounts = stmts.listAccounts.all().filter((a) => a.enabled);
  const result = [];
  for (const account of accounts) {
    try {
      const password = await credentialGet(account.credential_reference);
      const imap = await imapConnect(account, password, false);
      const uids = await imap.searchSinceUids();
      let checked = 0, invoiceMail = 0, normalMail = 0, processed = 0, alreadyProcessed = 0, imported = 0, failed = 0;
      for (const uid of uids) {
        checked++;
        try {
          const raw = await imap.fetchRaw(uid);
          const message = parseEmail(raw);
          if (!message.subject.includes("发票")) {
            normalMail++;
            stmts.markScanned.run(account.id, uid, message.messageId || "", "subject_not_invoice");
            continue;
          }
          invoiceMail++;
          if (stmts.scannedExists.get(account.id, uid)) { alreadyProcessed++; continue; }
          const attachments = message.attachments.filter((a) => SUPPORTED_EXT.has(path.extname(a.filename).toLowerCase()));
          for (const attachment of attachments) {
            const item = await importBuffer(attachment.data, attachment.filename, "email");
            if (item.result === "invalid_attachment") throw new Error(`attachment_decode_failed:${attachment.filename}:${item.reason}`);
            if (item.result === "imported") imported++;
          }
          stmts.markScanned.run(account.id, uid, message.messageId || "", attachments.length ? `attachments:${attachments.length}` : "no_supported_attachment");
          processed++;
        } catch (error) {
          failed++;
        }
      }
      await imap.close();
      result.push({ account: account.email, result: "ok", checked, invoiceMail, normalMail, processed, alreadyProcessed, imported, failed });
    } catch (error) {
      result.push({ account: account.email, result: "error", error: error.message || String(error) });
    }
  }
  return { result };
}

async function imapConnect(account, password, testOnly) {
  if (!password) throw new Error("missing_credential");
  const socket = account.ssl_enabled ? tls.connect(account.imap_port, account.imap_host) : net.connect(account.imap_port, account.imap_host);
  socket.setEncoding("latin1");
  let buffer = "";
  let seq = 0;
  const waitLine = () => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("imap_timeout")), 20000);
    const onData = (chunk) => {
      buffer += chunk;
      if (buffer.includes("\r\n")) {
        clearTimeout(timer);
        socket.off("data", onData);
        resolve(buffer);
      }
    };
    socket.on("data", onData);
    socket.once("error", reject);
  });
  await waitLine();
  const command = async (text) => {
    const tag = `A${++seq}`;
    socket.write(`${tag} ${text}\r\n`);
    return await new Promise((resolve, reject) => {
      let out = "";
      const timer = setTimeout(() => reject(new Error(`imap_timeout:${text}`)), 30000);
      const onData = (chunk) => {
        out += chunk;
        if (out.includes(`${tag} OK`) || out.includes(`${tag} NO`) || out.includes(`${tag} BAD`)) {
          clearTimeout(timer);
          socket.off("data", onData);
          if (!out.includes(`${tag} OK`)) reject(new Error(out.split(/\r?\n/).find((l) => l.startsWith(tag)) || "imap_error"));
          else resolve(out);
        }
      };
      socket.on("data", onData);
      socket.once("error", reject);
    });
  };
  await command(`LOGIN "${escapeImap(account.email)}" "${escapeImap(password)}"`);
  if (testOnly) {
    await command("LOGOUT").catch(() => {});
    socket.end();
    return true;
  }
  await command("SELECT INBOX");
  return {
    async searchSinceUids() {
      const out = await command("UID SEARCH SINCE 01-Jan-2026");
      const line = out.split(/\r?\n/).find((l) => l.startsWith("* SEARCH")) || "* SEARCH";
      return line.replace("* SEARCH", "").trim().split(/\s+/).filter(Boolean);
    },
    async fetchRaw(uid) {
      const out = await command(`UID FETCH ${uid} BODY.PEEK[]`);
      return out.replace(/^.*?\r\n/s, "").replace(/\r\nA\d+ OK[\s\S]*$/s, "");
    },
    async close() {
      await command("LOGOUT").catch(() => {});
      socket.end();
    }
  };
}

function parseEmail(raw) {
  const messageId = raw.match(/^Message-ID:\s*(.+)$/im)?.[1]?.trim() || "";
  const subject = decodeMime(raw.match(/^Subject:\s*(.+)$/im)?.[1]?.trim() || "");
  const attachments = [];
  parseMimePart(raw, attachments);
  return { messageId, subject, attachments };
}

function decodeMime(value) {
  const raw = String(value || "").replace(/^"|"$/g, "");
  const decodedWords = raw.replace(/=\?([^?]+)\?([BQ])\?([^?]+)\?=/gi, (_, charset, mode, body) => {
    const bytes = mode.toUpperCase() === "B"
      ? Buffer.from(body, "base64")
      : decodeQuotedPrintableToBuffer(body.replace(/_/g, " "));
    return bytes.toString(/^gb/i.test(charset) ? "utf8" : "utf8");
  });
  try {
    return decodeURIComponent(decodedWords);
  } catch {
    return decodedWords;
  }
}

function parseMimePart(raw, attachments) {
  const separator = raw.match(/\r?\n\r?\n/);
  if (!separator) return;
  const headerText = raw.slice(0, separator.index);
  const body = raw.slice(separator.index + separator[0].length);
  const headers = parseHeaders(headerText);
  const boundary = getHeaderParam(headers["content-type"], "boundary");
  if (boundary) {
    for (const child of splitMimeBody(body, boundary)) parseMimePart(child, attachments);
    return;
  }
  const disposition = (headers["content-disposition"] || "").toLowerCase();
  const filename = decodeMime(getHeaderParam(headers["content-disposition"], "filename") || getHeaderParam(headers["content-type"], "name") || "");
  if (!filename || !disposition.includes("attachment")) return;
  const encoding = (headers["content-transfer-encoding"] || "").trim().toLowerCase();
  const payload = body.replace(/\r?\n--$/, "").trim();
  let data;
  if (encoding === "base64") data = Buffer.from(payload.replace(/\s/g, ""), "base64");
  else if (encoding === "quoted-printable") data = decodeQuotedPrintableToBuffer(payload);
  else data = Buffer.from(payload, "latin1");
  attachments.push({ filename, data });
}

function parseHeaders(headerText) {
  const unfolded = headerText.replace(/\r?\n[ \t]+/g, " ");
  const headers = {};
  for (const line of unfolded.split(/\r?\n/)) {
    const i = line.indexOf(":");
    if (i > 0) headers[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim();
  }
  return headers;
}

function getHeaderParam(value = "", name) {
  const pattern = new RegExp(`${name}\\*?=(?:UTF-8''|")?([^";\\r\\n]+)"?`, "i");
  return value.match(pattern)?.[1]?.trim() || "";
}

function splitMimeBody(body, boundary) {
  const marker = `--${boundary}`;
  return body.split(marker).slice(1).filter((part) => !part.startsWith("--")).map((part) => part.replace(/^\r?\n/, "").replace(/\r?\n$/, ""));
}

function decodeQuotedPrintableToBuffer(value) {
  const cleaned = String(value).replace(/=\r?\n/g, "");
  const bytes = [];
  for (let i = 0; i < cleaned.length; i++) {
    if (cleaned[i] === "=" && /^[0-9A-Fa-f]{2}$/.test(cleaned.slice(i + 1, i + 3))) {
      bytes.push(parseInt(cleaned.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      bytes.push(cleaned.charCodeAt(i) & 0xff);
    }
  }
  return Buffer.from(bytes);
}

async function credentialSet(target, user, password) {
  await runCredential(["set", target, user], password);
}

async function credentialGet(reference) {
  if (!reference?.startsWith("wincred:")) return "";
  return await runCredential(["get", reference.slice(8)], "");
}

async function runCredential(args, stdin) {
  return await new Promise((resolve, reject) => {
    const child = spawn("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", CREDENTIAL_SCRIPT, ...args], { windowsHide: true });
    let out = "", err = "";
    child.stdout.on("data", (d) => out += d.toString("utf8"));
    child.stderr.on("data", (d) => err += d.toString("utf8"));
    child.on("close", (code) => code === 0 ? resolve(out.trim()) : reject(new Error(err.trim() || `credential_error_${code}`)));
    child.stdin.end(stdin || "");
  });
}

function parseMultipart(buffer, boundary) {
  const raw = buffer.toString("binary");
  return raw.split(`--${boundary}`).slice(1, -1).map((part) => {
    const [head, ...rest] = part.split("\r\n\r\n");
    const filename = head.match(/filename="([^"]*)"/)?.[1];
    let data = rest.join("\r\n\r\n");
    if (data.endsWith("\r\n")) data = data.slice(0, -2);
    return { filename, data: Buffer.from(data, "binary") };
  });
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw new Error("request_too_large");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function readJson(req) {
  const body = await readBody(req);
  return body.length ? JSON.parse(body.toString("utf8")) : {};
}

async function sendFile(res, file, type = "") {
  if (!path.resolve(file).startsWith(path.resolve(PUBLIC_DIR)) && path.resolve(file) !== path.resolve(path.join(PUBLIC_DIR, "index.html"))) {
    return json(res, { error: "forbidden" }, 403);
  }
  const ext = path.extname(file);
  const contentType = type || ({ ".js": "text/javascript", ".css": "text/css", ".html": "text/html; charset=utf-8" }[ext] || "application/octet-stream");
  res.writeHead(200, { "Content-Type": contentType });
  createReadStream(file).pipe(res);
}

function json(res, data, status = 200) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

function safeName(name) {
  return String(name).replace(/[\\/:*?"<>|]/g, "").slice(0, 80);
}

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function escapeImap(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full));
    else files.push(full);
  }
  return files;
}
