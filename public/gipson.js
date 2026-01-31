// public/gipson.js
// Uses /data/gibson.csv AS-IS (any headers, any column order) and auto-detects fields.
// If your CSV contains commas inside names WITHOUT quotes, no parser on earth can guess the columns.
// But if it's normal CSV (quoted when needed), this will work.

const grid = document.getElementById("prodGrid");
const catalogState = document.getElementById("catalogState");

let CATALOG = [];
let READY = false;

// If image values are filenames (e.g. "sg.jpg"), we'll try these prefixes:
const LOCAL_IMAGE_PREFIXES = ["/assets/", "/images/", "/img/"];

function setState(msg){
  if (catalogState) catalogState.textContent = msg;
}

function normalize(s){
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s\-'/.:?=&%]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function csvParseLine(line){
  const out = [];
  let cur = "";
  let inQ = false;

  for (let i = 0; i < line.length; i++){
    const ch = line[i];
    if (ch === '"'){
      // doubled quote inside quoted text => literal quote
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
  const headers = headersRaw.map(h => normalize(h) || "");

  const rows = [];
  for (let i=1; i<lines.length; i++){
    const cols = csvParseLine(lines[i]);
    const obj = { __cols: cols };

    // map by header name if possible (even if blank use col#)
    for (let c=0; c<cols.length; c++){
      const key = headers[c] || `col${c}`;
      obj[key] = (cols[c] ?? "").trim();
    }

    rows.push(obj);
  }
  return { headers, rows };
}

function isUrl(s){
  return /^https?:\/\/\S+/i.test(s || "");
}

function isImageUrl(s){
  return /^https?:\/\/\S+\.(png|jpg|jpeg|webp|gif)(\?.*)?$/i.test(s || "");
}

function isFileImage(s){
  return /^[^\/\\]+\.(png|jpg|jpeg|webp|gif)$/i.test(s || "");
}

function looksLikePrice(s){
  if (!s) return false;
  const t = String(s).replace(/[, ]/g, "");
  // $1999, 1999, 1999.00, USD 1999
  return /^\$?\d+(\.\d{2})?$/.test(t) || /\bUSD\b/i.test(s);
}

function cleanPrice(s){
  if (!s) return "";
  // pull first number-ish
  const m = String(s).match(/(\$?\s*[0-9]{1,3}(?:,[0-9]{3})*|[0-9]+)(\.[0-9]{2})?/);
  return m ? m[0].replace(/\s+/g, "") : "";
}

function firstImageCandidate(cols){
  // prefer full image URLs
  for (const v of cols){
    if (isImageUrl(v)) return v;
  }
  // then file image names like "sg.jpg"
  for (const v of cols){
    if (isFileImage(v)) return v;
  }
  // sometimes images are URLs without extension (CDN). If a cell has "image" in it, use it.
  for (const v of cols){
    if (isUrl(v) && /img|image|photo|cdn/i.test(v)) return v;
  }
  return "";
}

function firstPageUrl(cols){
  // first non-image URL
  for (const v of cols){
    if (isUrl(v) && !isImageUrl(v)) return v;
  }
  return "";
}

function bestNameCandidate(cols){
  // longest non-url non-price text
  let best = "";
  for (const v of cols){
    if (!v) continue;
    if (isUrl(v)) continue;
    if (looksLikePrice(v)) continue;
    const t = String(v).trim();
    if (t.length > best.length) best = t;
  }
  // fallback: first non-empty cell
  if (!best){
    for (const v of cols){
      if (String(v || "").trim()) return String(v).trim();
    }
  }
  return best;
}

function bestPriceCandidate(cols){
  for (const v of cols){
    if (looksLikePrice(v)) return cleanPrice(v);
  }
  return "";
}

function resolveImage(img){
  if (!img) return "";
  if (isImageUrl(img)) return img;
  if (isUrl(img)) return img; // allow non-ext cdn links
  if (isFileImage(img)){
    // try local prefixes
    for (const p of LOCAL_IMAGE_PREFIXES){
      return p + img;
    }
  }
  // maybe it's already a relative path like "assets/sg.jpg"
  if (/^(assets|images|img)\//i.test(img)) return "/" + img.replace(/^\/+/, "");
  return img;
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
  img.src = p.image || "";
  img.onerror = () => {
    // if image fails, show a simple placeholder instead of a blank box
    img.style.display = "none";
    const ph = document.createElement("div");
    ph.style.padding = "10px";
    ph.style.opacity = ".9";
    ph.style.fontWeight = "900";
    ph.style.textAlign = "center";
    ph.style.color = "#b8c3df";
    ph.textContent = "No image";
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
  price.textContent = p.price ? (String(p.price).startsWith("$") ? p.price : `$${p.price}`) : "";

  const link = document.createElement("div");
  link.className = "link";
  const a = document.createElement("a");
  a.href = p.url || "#";
  a.target = "_blank";
  a.rel = "noreferrer";
  a.textContent = p.url ? "View →" : "";
  link.appendChild(a);

  meta.appendChild(name);
  if (p.price) meta.appendChild(price);
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
      <div style="color:#b8c3df;font-size:13px;line-height:1.35">
        Try: <code style="background:rgba(255,255,255,.07);padding:2px 6px;border-radius:8px;border:1px solid rgba(255,255,255,.10)">show SG</code>
        or <code style="background:rgba(255,255,255,.07);padding:2px 6px;border-radius:8px;border:1px solid rgba(255,255,255,.10)">Les Paul Custom</code>
      </div>
      ${note ? `<div style="margin-top:10px;color:#9fb0d9;font-size:12px">${note}</div>` : ""}
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
  q = q.replace(/^pull up\s+/i, "");
  q = q.replace(/^i want\s+/i, "");
  q = q.replace(/^give me\s+/i, "");
  return q.trim();
}

function score(p, tokens){
  const hay = normalize([p.name, p.tags].filter(Boolean).join(" "));
  let s = 0;
  for (const t of tokens){
    if (!t) continue;
    if (hay.includes(t)) s += 2;
  }
  const n = normalize(p.name);
  for (const t of tokens){
    if (n.startsWith(t)) s += 2;
  }
  return s;
}

function mapRowAsIs(row){
  const cols = (row.__cols || []).map(v => (v ?? "").trim()).filter(v => v.length);

  const name = bestNameCandidate(cols);
  const price = bestPriceCandidate(cols);
  const rawImg = firstImageCandidate(cols);
  const image = resolveImage(rawImg);
  const url = firstPageUrl(cols);

  // tags: everything except name/price/urls
  const tags = cols
    .filter(v => v !== name)
    .filter(v => !looksLikePrice(v))
    .filter(v => !isUrl(v))
    .slice(0, 6)
    .join(" ");

  return { name, price, image, url, tags };
}

async function loadCatalog(){
  try{
    setState("loading /data/gibson.csv…");
    const r = await fetch("/data/gibson.csv", { cache: "no-store" });
    if (!r.ok) throw new Error("CSV fetch failed: " + r.status);

    const text = await r.text();
    const { rows } = parseCSV(text);

    CATALOG = rows
      .map(mapRowAsIs)
      .filter(p => p.name);

    READY = true;
    setState(`ready (${CATALOG.length} guitars)`);

    // Debug: show first 3 mapped results in console
    console.log("CSV MAPPED SAMPLE (first 3):", CATALOG.slice(0, 3));

    render(CATALOG.slice(0, 6), "Catalog loaded. Type or speak a model to filter.");
  } catch(err){
    READY = false;
    setState("catalog error");
    render([], "Could not load /data/gibson.csv (must be public/data/gibson.csv).");
    console.error(err);
  }
}

function showProducts(rawQuery){
  if (!READY) return render([], "Catalog not ready.");

  const q = extractQuery(rawQuery);
  const tokens = normalize(q).split(" ").filter(Boolean);

  if (!tokens.length){
    return render(CATALOG.slice(0, 8), "Say/type a model like SG, ES-335, Les Paul Custom.");
  }

  const ranked = CATALOG
    .map(p => ({ p, s: score(p, tokens) }))
    .filter(x => x.s > 0)
    .sort((a,b) => b.s - a.s)
    .map(x => x.p);

  render(ranked, `Heard: "${q}"`);
}

window.showProducts = showProducts;

loadCatalog();
