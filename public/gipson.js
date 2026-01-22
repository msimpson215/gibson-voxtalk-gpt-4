const navTry = document.getElementById("navTry");
const micBtn = document.getElementById("micBtn");
const micState = document.getElementById("micState");
const cardsEl = document.getElementById("cards");
const logEl = document.getElementById("log");

function log(msg) {
  const t = new Date().toLocaleTimeString();
  logEl.textContent = `[${t}] ${msg}\n` + logEl.textContent;
}

/* ---------------- CSV parsing ---------------- */

function parseCSV(text) {
  const rows = [];
  let row = [];
  let cur = "";
  let inQ = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const n = text[i + 1];

    if (c === '"' && inQ && n === '"') { cur += '"'; i++; continue; }
    if (c === '"') { inQ = !inQ; continue; }

    if (!inQ && (c === "\n" || c === "\r")) {
      if (cur.length || row.length) { row.push(cur); rows.push(row); }
      row = []; cur = "";
      continue;
    }

    if (!inQ && c === ",") { row.push(cur); cur = ""; continue; }

    cur += c;
  }
  if (cur.length || row.length) { row.push(cur); rows.push(row); }

  return rows.filter(r => r.some(v => String(v).trim().length));
}

function buildRowObject(headers, cols) {
  const o = {};
  headers.forEach((h, i) => (o[h] = (cols[i] ?? "").trim()));
  return o;
}

function forceHttps(u) {
  return u ? u.replace(/^http:\/\//i, "https://") : "";
}

function normKey(k) {
  return String(k || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\w\s-]/g, "");
}

function getAny(row, candidates) {
  if (!row.__normMap) {
    const m = new Map();
    for (const [k, v] of Object.entries(row)) m.set(normKey(k), v);
    row.__normMap = m;
  }

  for (const c of candidates) {
    const direct = row[c];
    if (direct != null && String(direct).trim()) return String(direct).trim();

    const viaNorm = row.__normMap.get(normKey(c));
    if (viaNorm != null && String(viaNorm).trim()) return String(viaNorm).trim();
  }
  return "";
}

function normalizeRow(row) {
  const title = getAny(row, ["full-unstyled-link", "title", "name"]);
  const url   = getAny(row, ["full-unstyled-link href", "href", "url", "link"]);
  const image = getAny(row, ["motion-reduce src", "img src", "image url", "image"]);
  const price = getAny(row, ["price-item", "price"]);
  const vendor = getAny(row, ["vendor-name", "vendor", "brand"]);
  const sku = getAny(row, ["sku", "SKU", "data-sku"]);

  return { title, url, image: forceHttps(image), price, vendor, sku };
}

let PRODUCTS = [];

async function loadProducts() {
  const url = `/data/gibson.csv?v=${Date.now()}`;
  log(`Loading CSV: ${url}`);

  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`CSV fetch failed: ${r.status}`);

  const text = await r.text();
  const sniff = text.slice(0, 80).replace(/\s+/g, " ");
  log(`CSV first chars: ${sniff}`);

  if (text.trim().startsWith("<!doctype") || text.trim().startsWith("<html")) {
    throw new Error("CSV response looks like HTML (wrong file/path/static config)");
  }

  const rows = parseCSV(text);
  if (!rows.length) throw new Error("CSV empty after parse");

  const headers = rows[0].map(h => String(h).trim());
  log(`CSV headers (${headers.length}): ${headers.slice(0, 8).join(" | ")} ...`);

  const normalized = rows.slice(1)
    .map(cols => buildRowObject(headers, cols))
    .map(o => normalizeRow(o));

  PRODUCTS = normalized.filter(p => p.title && p.title.trim());
  log(`Rows parsed: ${normalized.length} | With title: ${PRODUCTS.length}`);
}

function renderCards(list) {
  cardsEl.innerHTML = "";
  if (!list.length) {
    cardsEl.innerHTML = `<div style="color:#5b6476;font-size:12px;">No matches.</div>`;
    return;
  }

  for (const p of list) {
    const card = document.createElement("div");
    card.className = "card";

    const img = document.createElement("img");
    img.className = "cardImg";
    img.alt = p.title || "Guitar";
    img.loading = "lazy";
    img.src = p.image || "";
    img.onerror = () => { img.style.display = "none"; };

    const body = document.createElement("div");
    body.className = "cardBody";

    const title = document.createElement("div");
    title.className = "cardTitle";
    title.textContent = p.title || "Unknown";

    const meta = document.createElement("div");
    meta.className = "cardMeta";
    meta.innerHTML = `
      ${p.price ? `<span><b>Price:</b> ${p.price}</span>` : ""}
      ${p.vendor ? `<span><b>Vendor:</b> ${p.vendor}</span>` : ""}
      ${p.sku ? `<span><b>SKU:</b> ${p.sku}</span>` : ""}
    `;

    const link = document.createElement("a");
    link.className = "cardLink";
    link.href = p.url || "#";
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = p.url ? "View product" : "No link";

    body.appendChild(title);
    body.appendChild(meta);
    body.appendChild(link);

    card.appendChild(img);
    card.appendChild(body);
    cardsEl.appendChild(card);
  }
}

function searchProducts(query) {
  const q = String(query || "").toLowerCase().trim();
  if (!q) return [];

  return PRODUCTS
    .map(p => {
      const hay = `${p.title} ${p.vendor} ${p.price}`.toLowerCase();
      let score = 0;
      if (hay.includes(q)) score += 12;
      for (const part of q.split(/\s+/)) {
        if (part.length > 2 && hay.includes(part)) score += 2;
      }
      return { p, score };
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(x => x.p);
}

function showProducts(q) {
  const hits = searchProducts(q);
  log(`SHOW "${q}" => ${hits.length} hits`);
  renderCards(hits);
}

window.showProducts = showProducts;

// Clicking the nav text just scrolls you to the UI (doesn't hide/show anything)
navTry?.addEventListener("click", (e) => {
  e.preventDefault();
  document.getElementById("micBtn")?.scrollIntoView({ behavior: "smooth", block: "start" });
});

/* ---------------- Voice (leave as-is for now if yours is working) ---------------- */

// If your voice is already working, keep your existing voice code below this line.
// If you want me to include the full voice section too, paste your current gipson.js
// from "Voice" downward and I’ll return a single combined full file.
log("Page loaded. Loading catalog...");
loadProducts().catch(err => log(`CSV ERROR: ${err.message}`));
