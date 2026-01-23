// public/gipson.js
// Catalog loader + search + card render (scoped so it won't redeclare globals)

(() => {
  let catalog = null;

  const CSV_URLS = [
    "/data/gibson.csv",
    "/data/guitars.csv",
    "/gibson.csv",
    "/guitars.csv"
  ];

  function $(id){ return document.getElementById(id); }

  function addLine(who, msg){
    const log = $("log");
    if (!log) return;
    const p = document.createElement("p");
    p.innerHTML = `<span class="who">${escapeHtml(who)}:</span> ${escapeHtml(String(msg))}`;
    log.appendChild(p);
    log.scrollTop = log.scrollHeight;
  }

  function info(msg){
    const log = $("log");
    if (!log) return;
    const p = document.createElement("p");
    p.className = "muted";
    p.textContent = String(msg);
    log.appendChild(p);
    log.scrollTop = log.scrollHeight;
  }

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
    if (!lines.length) return { header: [], rows: [] };

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
    return { header, rows: out };

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

    return rows.map(r => {
      const product_url = get(r, "full-unstyled-link href", "product-card-link", "url", "product_url");
      const title = get(r, "full-unstyled-link", "title", "name");
      const image_url = get(r, "motion-reduce src", "linked-product__image src", "image_url", "image");
      const price = normalizePrice(get(r, "price-item", "price"));
      const sku = urlSlug(product_url) || title || "unknown-item";
      const vendor = get(r, "vendor-name", "vendor");
      const flag1 = get(r, "product-flag", "flag");
      const flag2 = get(r, "product-flag 2", "flag2");

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

  async function fetchFirstWorkingCSV(){
    const bust = `v=${Date.now()}`;
    let lastErr = null;

    for (const url of CSV_URLS){
      try{
        const r = await fetch(`${url}?${bust}`, { cache:"no-store" });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const text = await r.text();
        if (!text || !text.trim()) throw new Error("Empty CSV");
        return { url, text };
      } catch (e){
        lastErr = e;
        info(`CSV not at ${url} (${String(e.message || e)})`);
      }
    }
    throw lastErr || new Error("CSV fetch failed");
  }

  async function loadCatalog(){
    if (catalog) return catalog;

    info("Loading catalog…");
    const { url, text } = await fetchFirstWorkingCSV();
    const parsed = parseCSV(text);

    info(`CSV loaded from: ${url}`);
    info(`Rows parsed: ${parsed.rows.length}`);

    catalog = normalizeRows(parsed.rows);
    return catalog;
  }

  function searchTop(items, query, n=12){
    const q = String(query || "").toLowerCase().trim();
    if (!q) return items.slice(0, n);
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
    const productsWrap = $("products");
    const grid = $("prodGrid");
    if (!productsWrap || !grid) return;

    grid.innerHTML = "";

    if (!items.length){
      productsWrap.classList.add("show");
      grid.innerHTML = `<div style="font-size:12px; color:#64748b;">No matches for "${escapeHtml(query)}"</div>`;
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
          <p class="meta">SKU: ${escapeHtml(it.sku || "—")}${link ? " • " + link : ""}</p>
          <p class="meta">${escapeHtml(it.desc || "")}</p>
          <div class="price">${escapeHtml(price)}</div>
        </div>
      `;
      grid.appendChild(card);
    }

    productsWrap.classList.add("show");
  }

  // ---- Expose ONLY these hooks (no global const collisions) ----
  window.__gipson_addLine = addLine;

  window.__gipson_loadCatalog = async () => {
    try { await loadCatalog(); }
    catch (e){ console.error(e); info(`Catalog error: ${String(e.message || e)}`); }
  };

  window.__gipson_showProducts = async (query) => {
    try{
      const items = await loadCatalog();
      const top = searchTop(items, query, 12);
      renderProducts(top, query || "");
    } catch (e){
      console.error(e);
      info(`Show error: ${String(e.message || e)}`);
    }
  };
})();
