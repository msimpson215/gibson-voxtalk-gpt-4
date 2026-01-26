(() => {
  let catalog = null;

  const productsWrap = document.getElementById("products");
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
    // strip weird spaces; keep $ if present
    return s.replace(/\s+/g," ").trim();
  }

  function splitCSVLine(line){
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

  function parseCSV(text){
    const lines = text.replace(/\r/g,"").split("\n").filter(l => l.trim().length);
    if (!lines.length) return { rows: [], header: [] };

    const header = splitCSVLine(lines[0]).map(h => h.trim());
    const rows = [];

    for (let i=1;i<lines.length;i++){
      const cols = splitCSVLine(lines[i]);
      const row = {};
      for (let j=0;j<header.length;j++){
        row[header[j]] = (cols[j] ?? "").trim();
      }
      rows.push(row);
    }
    return { rows, header };
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

    return rows.map(r => {
      const product_url = get(r, "full-unstyled-link href", "product-card-link");
      const title = get(r, "full-unstyled-link", "title", "name");
      const image_url = get(r, "motion-reduce src", "linked-product__image src", "image_url", "image");
      const price = normalizePrice(get(r, "price-item", "price"));

      const sku = urlSlug(product_url) || title || "unknown-item";
      const vendor = get(r, "vendor-name", "vendor");

      return { title, product_url, image_url, price, sku, vendor };
    });
  }

  async function loadCatalog(){
    if (catalog) return catalog;
    const bust = `v=${Date.now()}`;
    const r = await fetch(`/data/gibson.csv?${bust}`, { cache:"no-store" });
    if (!r.ok) throw new Error(`CSV fetch failed: ${r.status}`);
    const text = await r.text();
    const parsed = parseCSV(text);
    catalog = normalizeRows(parsed.rows);
    return catalog;
  }

  function searchTop(items, query, limit){
    const q = String(query || "").toLowerCase().trim();
    if(!q) return [];

    const tokens = q.split(/\s+/).filter(Boolean);

    const scored = items.map(it => {
      const hay = `${it.title} ${it.vendor} ${it.sku}`.toLowerCase();
      let score = 0;

      // if user literally says "show ___", strip show
      const q2 = q.replace(/^\s*show\s+/,"").trim();
      if (q2 && hay.includes(q2)) score += 120;

      for (const t of tokens) if (hay.includes(t)) score += 22;

      return { it, score };
    }).filter(x => x.score > 0);

    scored.sort((a,b)=>b.score-a.score);
    return scored.slice(0, limit).map(x=>x.it);
  }

  function renderProducts(items, query){
    if (!grid) return;

    grid.innerHTML = "";
    if (!items.length){
      productsWrap?.classList.add("show");
      grid.innerHTML = `<div style="font-size:12px; color:#64748b;">No matches for "${escapeHtml(query)}"</div>`;
      return;
    }

    for (const it of items){
      const img = it.image_url
        ? `<img src="${escapeHtml(it.image_url)}" alt="">`
        : `<div style="font-size:11px;color:#64748b;">No image</div>`;

      const link = it.product_url
        ? `<a class="linkBtn" href="${escapeHtml(it.product_url)}" target="_blank" rel="noopener">Open</a>`
        : "";

      const price = it.price ? it.price : "—";

      const card = document.createElement("div");
      card.className = "prodCard";
      card.innerHTML = `
        <div class="thumb">${img}</div>
        <div>
          <h4>${escapeHtml(it.title || "(Untitled)")}</h4>
          <div class="meta">SKU: ${escapeHtml(it.sku || "—")}${it.vendor ? ` • ${escapeHtml(it.vendor)}` : ""}</div>
          <div class="priceRow">
            <div class="price">${escapeHtml(price)}</div>
            <div class="cardBtns">
              ${link}
            </div>
          </div>
        </div>
      `;
      grid.appendChild(card);
    }

    productsWrap?.classList.add("show");
  }

  // Exposed hooks called by index.html voice stream
  window.__gipson_loadCatalog = async () => {
    try { await loadCatalog(); }
    catch(e){ console.error(e); }
  };

  window.__gipson_showProducts = async (query) => {
    try{
      const items = await loadCatalog();
      const top = searchTop(items, query, 6);
      renderProducts(top, query);
    } catch(e){
      console.error(e);
    }
  };
})();
