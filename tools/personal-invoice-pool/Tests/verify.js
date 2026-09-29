import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const PORT = Number(process.env.PORT || 8787);
const BASE_URL = `http://localhost:${PORT}`;
const sample = path.join(ROOT, "Data", "verify-invoice.xml");
const invoiceNo = `255020${Date.now()}`;
const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice>
  <InvoiceNo>${invoiceNo}</InvoiceNo>
  <InvoiceDate>2026-09-18</InvoiceDate>
  <TotalAmount>128.00</TotalAmount>
  <BuyerName>测试购买方</BuyerName>
  <SellerName>测试销售方</SellerName>
</Invoice>`;

await fs.mkdir(path.join(ROOT, "Data"), { recursive: true });
await fs.writeFile(sample, xml, "utf8");

const server = spawn("node", ["App/server.js"], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) }, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
await wait(1000);
try {
  const form = new FormData();
  form.append("files", new Blob([xml], { type: "text/xml" }), "verify-invoice.xml");
  let res = await fetch(`${BASE_URL}/api/import`, { method: "POST", body: form }).then(r => r.json());
  assert(res.results?.[0]?.result === "imported" || res.results?.[0]?.result === "duplicate_hash", "import or duplicate hash");

  res = await fetch(`${BASE_URL}/api/import`, { method: "POST", body: form }).then(r => r.json());
  assert(["duplicate_hash", "duplicate_invoice_number"].includes(res.results?.[0]?.result), "dedupe works");

  const invoices = await fetch(`${BASE_URL}/api/invoices?search=${invoiceNo}`).then(r => r.json());
  assert(invoices.length >= 1, "search finds invoice");
  const id = invoices[0].id;

  let updated = await fetch(`${BASE_URL}/api/invoices/${id}/mark-used`, {
    method: "POST",
    body: JSON.stringify({ used_month: "2026-09" })
  }).then(r => r.json());
  assert(updated.status === "used" && updated.used_month === "2026-09", "mark used");

  updated = await fetch(`${BASE_URL}/api/invoices/${id}/mark-unused`, { method: "POST" }).then(r => r.json());
  assert(updated.status === "unused" && !updated.used_month, "mark unused clears month");

  updated = await fetch(`${BASE_URL}/api/invoices/${id}/recognize`, { method: "POST" }).then(r => r.json());
  assert(updated.result === "updated" || updated.result === "duplicate_invoice_number", "recognize route");

  const account = await fetch(`${BASE_URL}/api/email-accounts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "user@example.com", imap_host: "imap.example.com", imap_port: 993, ssl_enabled: true, enabled: false, password: "" })
  }).then(r => r.json());
  assert(account.result === "saved", "email account config saved without plaintext password");

  console.log("verification passed");
} finally {
  server.kill();
}

function wait(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function assert(value, label) {
  if (!value) throw new Error(`verification failed: ${label}`);
  console.log(`ok: ${label}`);
}
