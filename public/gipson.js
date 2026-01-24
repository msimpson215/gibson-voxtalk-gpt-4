// public/gipson.js
// CSV catalog loader + search + cards + paging
// Scoped to avoid global collisions.

(() => {
  let catalog = null;
  let lastQuery = "";
  let lastResults = [];
  let pageSize = 6;   // cards per page (minimal, quick)
  let pageIndex = 0;  // paging cursor

  const CSV_URLS = [
    "/data/gibson.csv",
    "/data/guitars.csv",
    "/gibson.csv",
    "/guitars.csv"
  ];

  function $(id){ return document.getElementById(id); }

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

  /**
   * CSV parser (quoted commas supported)
   * Assumes no embedded newlines inside a field.
   */
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

  // Scored search, handles messy queries like: "show me a red les paul custom"
  function searchRank(items, query){
    const q = String(query || "").toLowerCase().trim();
    if (!q) return items.slice();

    // strip common filler words
    const cleaned = q
      .replace(/\b(show|me|a|an|the|please|can|you|pull|up|bring|see|some|of|are|there|hello)\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const tokens = cleaned.split(/\s+/).filter(Boolean);

    return items
      .map(it => {
        const hay = `${it.title} ${it.desc} ${it.sku}`.toLowerCase();
        let score = 0;

        // strong matches
        if (cleaned && hay.includes(cleaned)) score += 120;

        // token matches
        for (const t of tokens){
          if (!t) continue;
          if (hay.includes(t)) score += 18;
        }

        // prefer Les Paul if asked
        if (tokens.includes("les") && tokens.includes("paul") && hay.includes("les paul")) score += 40;
        if (tokens.includes("custom") && hay.includes("custom")) score += 30;

        return { it, score };
      })
      .sort((a,b) => b.score - a.score)
      .map(x => x.it);
  }

  function renderPage(){
    const productsWrap = $("products");
    const grid = $("prodGrid");
    if (!productsWrap || !grid) return;

    grid.innerHTML = "";

    const start = pageIndex * pageSize;
    const end = start + pageSize;
    const page = lastResults.slice(start, end);

    if (!page.length){
      productsWrap.classList.add("show");
      grid.innerHTML = `<div style="font-size:12px; color:#64748b;">No more matches.</div>`;
      return;
    }

    for (const it of page){
      const img = it.image_url
        ? `<img src="${escapeHtml(it.image_url)}" alt="">`
        : `<div style="font-size:11px;color:#64748b;">No image</div>`;

      const link = it.product_url
        ? `<a class="link" href="${escapeHtml(it.product_url)}" target="_blank" rel="noopener">Open</a>`
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
          <div class="actions">
            <button class="miniBtn dark" data-add="${escapeHtml(it.product_url || "")}">Add to cart</button>
            ${link ? link : ""}
          </div>
        </div>
      `;
      grid.appendChild(card);
    }

    // Add-to-cart stub (minimal)
    grid.querySelectorAll("button[data-add]").forEach(btn => {
      btn.addEventListener("click", () => {
        const url = btn.getAttribute("data-add");
        info("Added to cart (stub). Real cart integration comes later.");
        if (url) window.open(url, "_blank", "noopener");
      });
    });

    productsWrap.classList.add("show");
  }

  // Public hooks
  window.__gipson_loadCatalog = async () => {
    try { await loadCatalog(); }
    catch(e){ console.error(e); info(`Catalog error: ${String(e.message || e)}`); }
  };

  window.__gipson_showProducts = async_
