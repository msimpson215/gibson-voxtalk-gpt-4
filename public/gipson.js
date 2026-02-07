(() => {
  const CSV_URL = "/data/gibson.csv";

  const cardsEl = document.getElementById("cards");
  const countLabel = document.getElementById("countLabel");
  const logEl = document.getElementById("log");
  const micBtn = document.getElementById("micBtn");
  const micState = document.getElementById("micState");
  const searchInput = document.getElementById("searchInput");

  function log(msg) {
    if (logEl) {
      logEl.textContent += msg + "\n";
      logEl.scrollTop = logEl.scrollHeight;
    }
    console.log(msg);
  }

  function parseCSV(text) {
    const rows = [];
    let row = [];
    let cur = "";
    let q = false;

    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      const n = text[i + 1];

      if (c === '"' && q && n === '"') { cur += '"'; i++; continue; }
      if (c === '"') { q = !q; continue; }

      if (!q && c === ",") { row.push(cur); cur = ""; continue; }

      if (!q && (c === "\n" || c === "\r")) {
        if (c === "\r" && n === "\n") i++;
        row.push(cur);
        cur = "";
        if (row.some(x => String(x).trim() !== "")) rows.push(row);
        row = [];
        continue;
      }

      cur += c;
    }

    if (cur.length || row.length) {
      row.push(cur);
      if (row.some(x => String(x).trim() !== "")) rows.push(row);
    }

    return rows;
  }

  function normalizeUrl(u) {
    const s = String(u || "").trim();
    if (!s) return "";
    if (s.startsWith("http://") || s.startsWith("https://")) return s;
    if (s.startsWith("//")) return `https:${s}`;
    if (s.startsWith("/")) return `https://www.gibson.com${s}`;
    return s;
  }

  function proxiedImageUrl(raw) {
    const u = normalizeUrl(raw);
    return u ? `/img?url=${encodeURIComponent(u)}` : "";
  }

  // Your scrape layout matches:
  // 0 = product url
  // 1 = big image url (cdn.shopify…)
  // 2 = title
  // 3 = vendor
  // 10 = color / variant
  // 11 = price
  function mapRow(r) {
    const url = normalizeUrl(r[0]);
    const img = proxiedImageUrl(r[1] || r[4] || r[6] || r[8]);
    const name = String(r[2] || "").trim();
    const vendor = String(r[3] || "").trim();
    const color = String(r[10] || "").trim();
    const price = String(r[11] || "").trim();
    const blob = [name, vendor, color, price, url].join(" ").toLowerCase();
    return { url, img, name, vendor, color, price, blob };
  }

  let catalog = [];

  function render(list) {
    cardsEl.innerHTML = "";

    const grid = document.createElement("div");
    grid.style.cssText =
      "display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px;";

    for (const p of list) {
      const card = document.createElement("div");
      card.style.cssText =
        "border:1px solid rgba(255,255,255,.12);border-radius:14px;overflow:hidden;background:rgba(255,255,255,.06);";

      const top = document.createElement("div");
      top.style.cssText =
        "height:160px;background:rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center;overflow:hidden;";

      if (p.img) {
        const img = document.createElement("img");
        img.src = p.img;
        img.alt = p.name || "Guitar";
        img.loading = "lazy";
        img.style.cssText = "width:100%;height:100%;object-fit:cover;display:block;";
        img.onerror = () => log(`IMG FAIL: ${p.img}`);
        top.appendChild(img);
      } else {
        top.textContent = "No image";
        top.style.cssText += "color:rgba(255,255,255,.6);font:12px system-ui;";
      }

      const body = document.createElement("div");
      body.style.cssText =
        "padding:10px 12px;font:14px system-ui;color:rgba(255,255,255,.92);display:flex;flex-direction:column;gap:6px;";

      const title = document.createElement("div");
      title.style.cssText = "font-weight:800;line-height:1.2;";
      title.textContent = p.name || "(untitled)";

      const meta = document.createElement("div");
      meta.style.cssText =
        "display:flex;justify-content:space-between;gap:10px;color:rgba(255,255,255,.65);font-size:12px;";
      meta.innerHTML = `<span>${p.vendor || ""}${p.color ? " • " + p.color : ""}</span><span>${p.price || ""}</span>`;

      const link = document.createElement("a");
      link.href = p.url || "#";
      link.target = "_blank";
      link.rel = "noopener";
      link.textContent = p.url ? "View on Gibson" : "No link";
      link.style.cssText =
        "margin-top:6px;text-decoration:none;display:inline-flex;justify-content:center;padding:8px 10px;border-radius:12px;border:1px solid rgba(255,255,255,.14);color:rgba(255,255,255,.92);background:rgba(0,0,0,.25);";
      if (!p.url) link.onclick = (e) => e.preventDefault();

      body.appendChild(title);
      body.appendChild(meta);
      body.appendChild(link);

      card.appendChild(top);
      card.appendChild(body);

      grid.appendChild(card);
    }

    cardsEl.appendChild(grid);
    if (countLabel) countLabel.textContent = `${list.length} shown / ${catalog.length} total`;
  }

  function cleanQuery(q) {
    let s = String(q || "").trim();
    s = s.replace(/[^\w\s'-]/g, " ");
    s = s.replace(/\s+/g, " ").trim();

    const stop = new Set(["gibson","guitar","guitars","show","me","a","an","the","please"]);
    const parts = s.split(" ").filter(w => !stop.has(w.toLowerCase()));
    return parts.join(" ").trim() || s.trim();
  }

  function applyFilter(q) {
    const cleaned = cleanQuery(q);
    const s = cleaned.toLowerCase();

    log(`FILTER: ${cleaned}`);
    if (searchInput) searchInput.value = cleaned;

    if (!s) return render(catalog);
    render(catalog.filter(p => p.blob.includes(s)));
  }

  async function loadCSV() {
    const r = await fetch(CSV_URL, { cache: "no-store" });
    const text = await r.text();
    const rows = parseCSV(text);
    const data = rows.slice(1);

    catalog = data
      .filter(rw => rw.some(x => String(x).trim() !== ""))
      .map(mapRow);

    log(`CSV loaded: ${catalog.length}`);
    render(catalog);
  }

  // Speech-to-text filter (English only)
  let recog = null;

  function startSpeechToText() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      log("SpeechRecognition not available in this browser.");
      return;
    }

    try { if (recog) recog.stop(); } catch {}
    recog = new SR();
    recog.lang = "en-US";
    recog.interimResults = false;
    recog.maxAlternatives = 1;

    recog.onstart = () => { if (micState) micState.textContent = "Listening…"; };
    recog.onerror = (e) => {
      log("Speech error: " + (e?.error || "unknown"));
      if (micState) micState.textContent = "Click to talk";
    };
    recog.onresult = (e) => {
      const txt = e?.results?.[0]?.[0]?.transcript || "";
      log("SPEECH: " + txt);
      applyFilter(txt);
      if (micState) micState.textContent = "Click to talk";
    };
    recog.onend = () => { if (micState) micState.textContent = "Click to talk"; };

    recog.start();
  }

  if (searchInput) searchInput.addEventListener("input", (e) => applyFilter(e.target.value));
  if (micBtn) micBtn.addEventListener("click", startSpeechToText);

  loadCSV().catch(err => log("CSV ERROR: " + (err?.message || String(err))));
})();
