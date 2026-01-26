(() => {
  let catalog = null;

  let lastQuery = "";
  let lastMatches = [];
  let lastOffset = 0;

  const PAGE_SIZE = 6;
  const CSV_URL = "/data/gibson.csv";

  const productsWrap = document.getElementById("products");
  const grid = document.getElementById("prodGrid");

  function escapeHtml(s){
    return String(s)
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;");
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
    // Your headers typically:
    // "full-unstyled-link href", "motion-reduce src", "full-unstyled-link", "vendor-name", "price-item", etc.
    const get = (r, ...keys) => {
      for (const k of keys){
        if (k in r && String(r[k]).trim() !== "") return String(r[k]).trim();
      }
      return "";
    };

    return rows.map(r => {
      const product_url = get(r, "full-unstyled-link href", "url", "product_url");
      const title = get(r, "full-unstyled-link", "title", "name");
      const image_url = get(r, "motion-reduce src", "image_url", "image");
      const vendor = get(r, "vendor-name", "vendor");
      const price = get(r, "price-item", "price");
      const sku = urlSlug(product_url) || title || "unknown-item";

      return { title, product_url, image_url, vendor, price, sku };
    });
  }

  async function loadCatalog(){
    if (catalog) return catalog;
    const bust = `v=${Date.now()}`;
    const r = await fetch(`${CSV_URL}?${bust}`, { cache:"no-store" });
    if (!r.ok) throw new Error(`CSV fetch failed: ${r.status}`);
    const text = await r.text();
    const parsed = parseCSV(text);
    catalog = normalizeRows(parsed.rows);
    return catalog;
  }

  function searchAll(items, query){
    const q = String(query || "").toLowerCase().trim();
    if(!q) return items.slice();

    const tokens = q.split(/\s+/).filter(Boolean);

    return items
      .map(it => {
        const hay = `${it.title} ${it.vendor} ${it.sku}`.toLowerCase();
        let score = 0;
        if (hay.includes(q)) score += 120;
        for (const t of tokens) if (hay.includes(t)) score += 22;
        return { it, score };
      })
      .filter(x => x.score > 0)
      .sort((a,b) => b.score - a.score)
      .map(x => x.it);
  }

  function renderMessage(msg){
    if (!grid) return;
    grid.innerHTML = `<div style="font-size:12px; opacity:.86; padding:6px 2px;">${msg}</div>`;
    productsWrap?.classList.add("show");
  }

  function renderPage(matches, query, offset){
    if (!grid) return;

    grid.innerHTML = "";
    const slice = matches.slice(offset, offset + PAGE_SIZE);

    if (!slice.length){
      renderMessage(`No more results for “${escapeHtml(query)}”.`);
      return;
    }

    for (const it of slice){
      const img = it.image_url
        ? `<img src="${escapeHtml(it.image_url)}" alt="">`
        : `<div style="font-size:11px; opacity:.8;">No image</div>`;

      const link = it.product_url
        ? `<a class="linkBtn" href="${escapeHtml(it.product_url)}" target="_blank" rel="noopener">Open</a>`
        : "";

      const card = document.createElement("div");
      card.className = "prodCard";
      card.innerHTML = `
        <div class="thumb">${img}</div>
        <div>
          <h4>${escapeHtml(it.title || "(Untitled)")}</h4>
          <p class="meta">SKU: ${escapeHtml(it.sku || "—")}${it.vendor ? " • " + escapeHtml(it.vendor) : ""}</p>
          <div class="priceRow">
            <div class="price">${escapeHtml(it.price || "—")}</div>
            <div class="cardBtns">
              ${link}
              <button class="linkBtn" type="button" data-sku="${escapeHtml(it.sku)}">Add to cart</button>
            </div>
          </div>
        </div>
      `;

      card.querySelectorAll('button[data-sku]').forEach(btn => {
        btn.addEventListener("click", () => {
          const sku = btn.getAttribute("data-sku") || "";
          console.log("(stub) Add to cart:", sku);
        });
      });

      grid.appendChild(card);
    }

    productsWrap?.classList.add("show");
  }

  async function showProducts(rawQuery){
    const items = await loadCatalog();
    const q = String(rawQuery || "").trim();
    lastQuery = q;
    lastMatches = searchAll(items, q);
    lastOffset = 0;

    if (!lastMatches.length){
      renderMessage(`No matches for “${escapeHtml(q)}”. (Catalog loaded: ${items.length} items)`);
      return;
    }

    renderPage(lastMatches, lastQuery, lastOffset);
  }

  function moreResults(){
    if (!lastMatches.length) return;
    lastOffset += PAGE_SIZE;
    renderPage(lastMatches, lastQuery, lastOffset);
  }

  window.__gipson_loadCatalog = async () => { await loadCatalog(); };
  window.__gipson_showProducts = async (q) => { await showProducts(q); };
  window.__gipson_moreResults = () => { moreResults(); };
})();
