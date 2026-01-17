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

function urlSlug(url){
  try{
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    return parts[parts.length-1] || "";
  } catch { return ""; }
}

function normalizeRows(rows){
  const get = (r, ...keys) => {
    for (const k of keys){
      if (k in r && String(r[k]).trim() !== "") return String(r[k]).trim();
    }
    return "";
  };

  // Prefer clean schema if present:
  // sku,title,price,product_url,image_url
  const hasClean = rows.length && (
    ("title" in rows[0]) || ("product_url" in rows[0]) || ("image_url" in rows[0]) || ("sku" in rows[0])
  );

  return rows.map(r => {
    if (hasClean){
      const title = get(r, "title");
      const product_url = get(r, "product_url");
      const image_url = get(r, "image_url");
      const price = normalizePrice(get(r, "price"));
      const sku = get(r, "sku") || urlSlug(product_url) || title || "unknown-item";
      return { title, product_url, image_url, price, sku, desc: "" };
    }

    // Fallback for older scraped columns
    const product_url = get(r, "full-unstyled-link href", "product-card-link");
    const title = get(r, "full-unstyled-link");
    const image_url = get(r, "motion-reduce src", "linked-product__image src");
    const price = normalizePrice(get(r, "price-item"));

    const sku = urlSlug(product_url) || title || "unknown-item";
    const vendor = get(r, "vendor-name");
    const flag1 = get(r, "product-flag");
    const flag2 = get(r, "product-flag 2");

    return {
      title,
      product_url,
      image_url,
      price,
      sku,
      desc: [vendor, flag1, flag2].filter(Boolean).join(" • ")
    };
  });
}

async function loadCatalog(){
  if (catalog) return catalog;

  const r = await fetch("/data/gibson.csv", { cache:"no-store" });
  if (!r.ok) throw new Error(`CSV fetch failed: ${r.status} ${r.statusText}`);
  const text = await r.text();
  const rows = parseCSV(text);
  catalog = normalizeRows(rows);
  return catalog;
}

function searchTop(items, query, n=3){
  const q = query.toLowerCase().trim();
  const tokens = q.split(/\s+/).filter(Boolean);

  return items
    .map(it => {
      const hay = `${it.title} ${it.desc} ${it.sku}`.toLowerCase();
      let score = 0;
      if (hay.includes(q)) score += 100;
      for (const t of tokens) if (hay.includes(t)) score += 20;
      return { it, score };
    })
    .filter(x => x.score > 0)
    .sort((a,b) => b.score - a.score)
    .slice(0, n)
    .map(x => x.it);
}

function renderProducts(items, query){
  grid.innerHTML = "";

  if (!items.length){
    if (window.__gipson_setResultsVisible) window.__gipson_setResultsVisible(true, query);
    grid.innerHTML = `<div style="padding:12px 14px; font-size:12px; color:rgba(15,23,42,.62); font-weight:800;">No matches for "${escapeHtml(query)}"</div>`;
    return;
  }

  for (const it of items){
    const img = it.image_url
      ? `<img src="${escapeHtml(it.image_url)}" alt="">`
      : `<div style="font-size:11px;color:rgba(15,23,42,.55); font-weight:800;">No image</div>`;

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
        ${it.desc ? `<p class="meta">${escapeHtml(it.desc)}</p>` : ``}
        <div class="price">${escapeHtml(price)}</div>
      </div>
    `;
    grid.appendChild(card);
  }

  if (window.__gipson_setResultsVisible) window.__gipson_setResultsVisible(true, query);
}

window.__gipson_loadCatalog = async () => {
  try { await loadCatalog(); }
  catch(e){ console.error(e); }
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
