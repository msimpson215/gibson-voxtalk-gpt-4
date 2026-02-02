// public/gipson.js
// Hard-diagnostic CSV -> product cards
// - Works with header CSV OR positional CSV
// - Forces local image filenames to /assets/<file>
// - Always shows name/price even if image fails
// - Logs mapped items and exposes window.CATALOG for debugging

const grid = document.getElementById("prodGrid");
const catalogState = document.getElementById("catalogState");

let CATALOG = [];
let READY = false;

function setState(msg){
  if (catalogState) catalogState.textContent = msg;
}

function log(...args){
  console.log("[gipson.js]", ...args);
}

function normalizeKey(s){
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function csvParseLine(line){
  const out = [];
  let cur = "";
  let inQ = false;

  for (let i = 0; i < line.length; i++){
    const ch = line[i];
    if (ch === '"'){
      if (inQ && line[i+1] === '"'){ cur += '"'; i++; }
      else inQ = !inQ;
    } else if (ch === "," && !inQ){
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map(s => (s ?? "").trim());
}

function parseCSV(text){
  const lines = text.split(/\r?\n/).filter(l => l.trim().length);
  if (lines.length < 2) return { headers: [], rows: [] };

  const headersRaw = csvParseLine(lines[0]);
  const headers = headersRaw.map(h => normalizeKey(h));

  const rows = [];
  for (let i = 1; i < lines.length; i++){
    rows.push(csvParseLine(lines[i]));
  }
  return { headers, rows };
}

function isUrl(s){
  return /^https?:\/\//i.test(s || "");
}

function looksLikePrice(s){
  if (!s) return false;
  const t = String(s).replace(/[, ]/g, "");
  return /^\$?\d+(\.\d{2})?$/.test(t) || /\bUSD\b/i.test(s);
}

function cleanPrice(s){
  if (!s) return "";
  const m = String(s).match(/\$?\s*([0-9]{1,3}(?:,[0-9]{3})*|[0-9]+)(\.[0-9]{2})?/);
  return m ? m[0].replace(/\s+/g, "") : String(s).trim();
}

function isImageLike(s){
  return /\.(png|jpg|jpeg|webp|gif)(\?.*)?$/i.test(s || "");
}

function forceImagePath(img){
  const v = (img || "").trim();
  if (!v) return "";

  // full URL
  if (isUrl(v)) return v;

  // already absolute path
  if (v.startsWith("/")) return v;

  // relative asset path like assets/foo.jpg
  if (/^(assets|images|img)\//i.test(v)) return "/" + v;

  // filename like sg-standard.jpg -> /assets/sg-standard.jpg
  if (isImageLike(v)) return "/assets/" + v;

  // unknown string; return as-is
  return v;
}

function pickByHeader(headers, cols, candidates){
  for (let i=0; i<headers.length; i++){
    const h = headers[i] || "";
    for (const c of candidates){
      if (h.includes(c)) return cols[i] || "";
    }
  }
  return "";
}

function mapRow(headers, cols){
  // 1) Try header-based mapping if headers look real
  const headerLooksReal = headers.some(h => h.includes("name") || h.includes("price") || h.includes("image") || h.includes("url") || h.includes("link"));

  let name = "";
  let price = "";
  let image = "";
  let url = "";

  if (headerLooksReal){
    name  = pickByHeader(headers, cols, ["name","title","model","product"]);
    price = pickByHeader(headers, cols, ["price","msrp","cost","amount"]);
    image = pickByHeader(headers, cols, ["image","img","photo","picture","thumb"]);
    url   = pickByHeader(headers, cols, ["url","link","href","page"]);
  }

  // 2) Fallback auto-detect if missing
  if (!name){
    // longest non-url non-price cell
    let best = "";
    for (const v of cols){
      if (!v) continue;
      if (isUrl(v)) continue;
      if (looksLikePrice(v)) continue;
      if (String(v).length > best.length) best = String(v);
    }
    name = best || (cols[0] || "");
  }

  if (!price){
    const p = cols.find(v => looksLikePrice(v));
    price = cleanPrice(p || "");
  } else {
    price = cleanPrice(price);
  }

  if (!image){
    // first image-like cell
    const imgCell = cols.find(v => isImageLike(v)) || "";
    image = imgCell;
  }
  image = forceImagePath(image);

  if (!url){
    // first non-image URL
    const u = cols.find(v => isUrl(v) && !isImageLike(v)) || "";
    url = u;
  }

  return { name: String(name || "").trim(), price: String(price || "").trim(), image: String(image || "").trim(), url: String(url || "").trim() };
}

function buildCard(p){
  const card = document.createElement("div");
  card.className = "card";

  const thumb = document.createElement("div");
  thumb.className = "thumb";

  const img = document.createElement("img");
  img.alt = p.name || "Guitar";
  img.loading = "lazy";
  img.referrerPolicy = "no-referrer";

  if (p.image){
    img.src = p.image;
  } else {
    img.style.display = "none";
    const ph = document.createElement("div");
    ph.style.padding = "10px";
    ph.style.opacity = ".9";
    ph.style.fontWeight = "900";
    ph.style.textAlign = "center";
    ph.style.color = "#b8c3df";
    ph.textContent = "No image (image field empty)";
    thumb.appendChild(ph);
  }

  img.onerror = () => {
    img.style.display = "none";
    const ph = document.createElement("div");
    ph.style.padding = "10px";
    ph.style.opacity = ".9";
    ph.style.fontWeight = "900";
    ph.style.textAlign = "center";
    ph.style.color = "#b8c3df";
    ph.textContent = `Image failed: ${p.image || "(none)"}`;
    thumb.appendChild(ph);
  };

  thumb.appendChild(img);

  const meta = document.createElement("div");
  meta.className = "meta";

  const name = document.createElement("div");
  name.className = "name";
  name.textContent = p.name || "(no name)";

  const price = document.createElement("div");
  price.className = "price";
  price.textContent = p.price || "(no price found)";

  const link = document.createElement("div");
  link.className = "link";
  const a = document.createElement("a");
  a.href = p.url || "#";
  a.target = "_blank";
  a.rel = "noreferrer";
  a.textContent = p.url ? "View →" : "";
  link.appendChild(a);

  meta.appendChild(name);
  meta.appendChild(price);
  if (p.url) meta.appendChild(link);

  card.appendChild(thumb);
  card.appendChild(meta);
  return card;
}

function render(list, note=""){
  grid.innerHTML = "";
  if (!list.length){
    const d = document.createElement("div");
    d.style.opacity = "0.92";
    d.style.padding = "12px";
    d.innerHTML = `
      <div style="font-weight:900;margin-bottom:6px">No matches</div>
      <div style="color:#b8c3df;font-size:13px;line-height:1.35">${note || ""}</div>
    `;
    grid.appendChild(d);
    return;
  }
  list.slice(0, 12).forEach(p => grid.appendChild(buildCard(p)));
}

function extractQuery(raw){
  let q = (raw || "").trim();
  q = q.replace(/^show\s+/i, "");
  q = q.replace(/^find\s+/i, "");
  return q.trim();
}

function showProducts(rawQuery){
  if (!READY) return render([], "Catalog not ready.");

  const q = extractQuery(rawQuery);
  const term = q.toLowerCase();

  if (!term){
    return render(CATALOG.slice(0, 8), "Type a model like SG, ES-335, Les Paul Custom.");
  }

  const res = CATALOG.filter(p => (p.name || "").toLowerCase().includes(term));
  render(res, `Heard: "${q}"`);
}

window.showProducts = showProducts;

async function loadCatalog(){
  try{
    setState("loading /data/gibson.csv…");
    const r = await fetch("/data/gibson.csv", { cache: "no-store" });
    if (!r.ok) throw new Error("CSV fetch failed: " + r.status);

    const text = await r.text();
    const { headers, rows } = parseCSV(text);

    CATALOG = rows.map(cols => mapRow(headers, cols)).filter(p => p.name);

    READY = true;
    setState(`ready (${CATALOG.length} guitars)`);
    window.CATALOG = CATALOG; // ✅ so you can type CATALOG in console

    log("HEADERS:", headers);
    log("CSV MAPPED SAMPLE (first 10):", CATALOG.slice(0, 10));

    // show a few on load
    render(CATALOG.slice(0, 6), "Loaded from /data/gibson.csv");
  } catch (err){
    READY = false;
    setState("catalog error");
    console.error(err);
    render([], String(err?.message || err));
  }
}

loadCatalog();
