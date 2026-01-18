let catalog = null;

const grid = document.getElementById("prodGrid");

function escapeHtml(s){
  return String(s)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;");
}

function normalizePrice(p){
  const s = String(p || "").trim();
  if (!s) return "";
  const n = s.replace(/[$,]/g, "");
  const num = Number(n);
  if (Number.isFinite(num)) return num.toFixed(2);
  return s;
}

function parseCSV(text){
  const lines = text.replace(/\r/g,"").split("\n").filter(l => l.trim().length);
  if (!lines.length) return [];
  const header = split(lines[0]).map(h => h.trim());
  const out = [];

  for (let i=1;i<lines.length;i++){
    const cols = split(lines[i]);
    const row = {};
    for (let j=0;j<header.length;j++){
      row[header[j]] = (cols[j] ?? "").trim();
    }
    out.push(row);
  }
  return out;

  function split(line){
    const res = [];
    let cur="", inQ=false;
    for (let i=0;i<line.length;i++){
      const ch=line[i];
      if (ch === '"'){
        if (inQ && line[i+1] === '"'){ cur+='"'; i++; }
        else inQ = !inQ;
      } else if (ch === "," && !inQ){
        res.push(cur); cur="";
      } else cur += ch;
    }
    res.push(cur);
    return res;
  }
}

async function loadCatalog(){
  if (catalog) return catalog;

  const url = "/data/gibson.csv";
  const r = await fetch(url, { cache:"no-store" });

  if (!r.ok){
    console.error(`[gipson.js] Missing CSV: ${url} (status ${r.status}).`);
    console.error(`[gipson.js] You must have: public/data/gibson.csv in your repo.`);
    catalog = [];
    return catalog;
  }

  const text = await r.text();
  const rows = parseCSV(text);

  catalog = rows.map(r => ({
    sku: String(r.sku || "").trim(),
    title: String(r.title || "").trim(),
    price: normalizePrice(r.price),
    product_url: String(r.product_url || "").trim(),
    image_url: String(r.image_url || "").trim()
  })).filter(x => x.title);

  console.log(`[gipson.js] Loaded ${catalog.length} rows from ${url}`);
  return catalog;
}

function searchTop(items, query, n=3){
  const q = query.toLowerCase().trim();
  const tokens = q.split(/\s+/).filter(Boolean);

  return items.map(it => {
    const hay = `${it.title} ${it.sku}`.toLowerCase();
    let score = 0;
    if (hay.includes(q)) score += 100;
    for (const t of tokens) if (hay.includes(t)) score += 20;
    return { it, score };
  }).filter(x => x.score > 0)
    .sort((a,b) => b.score - a.score)
    .slice(0, n)
    .map(x => x.it);
}

function renderProducts(items, query){
  if (!grid) return;
  grid.innerHTML = "";

  if (!items.length){
    grid.innerHTML = `<div style="font-size:12px; color:#64748b; padding:6px 2px;">No matches for "${escapeHtml(query)}"</div>`;
    if (window.__gipson_setResultsVisible) window.__gipson_setResultsVisible(true, query);
    return;
  }

  for (const it of items){
    const img = it.image_url
      ? `<img src="${escapeHtml(it.image_url)}" alt="">`
      : `<div style="font-size:11px;color:#64748b;">No image</div>`;

    const link = it.product_url
      ? `<a href="${escapeHtml(it.product_url)}" target="_blank" rel="noopener">Open</a>`
      : "";

    const price = it.price ? `$${it.price}` : "—";

    const card = document.createElement("div");
    card.className = "prodCard";
    card.innerHTML = `
      <div class="thumb">${img}</div>
      <div>
        <h4>${escapeHtml(it.title || "(Untitled)")}</h4>
        <p class="meta">SKU: ${escapeHtml(it.sku || "—")} ${link ? " • " + link : ""}</p>
        <div class="price">${escapeHtml(price)}</div>
      </div>
    `;
    grid.appendChild(card);
  }

  if (window.__gipson_setResultsVisible) window.__gipson_setResultsVisible(true, query);
}

window.__gipson_loadCatalog = async () => {
  try { await loadCatalog(); } catch(e){ console.error(e); }
};

window.__gipson_showProducts = async (query) => {
  try{
    const items = await loadCatalog();
    const top = searchTop(items, query, 3);
    renderProducts(top, query);
  } catch(e){
    console.error(e);
  }
};
