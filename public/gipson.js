(() => {
  const CSV_URL = "/data/gibson.csv";
  const REALTIME_MODEL = "gpt-realtime";

  const cardsEl = document.getElementById("cards");
  const countLabel = document.getElementById("countLabel");
  const logEl = document.getElementById("log");
  const micBtn = document.getElementById("micBtn");
  const micState = document.getElementById("micState");
  const searchInput = document.getElementById("searchInput");
  const remoteAudio = document.getElementById("remoteAudio");

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

  // Your CSV mapping
  // 0 URL, 1 main image, 2 name, 3 vendor, 10 color, 11 price
  function mapRow(r) {
    const url = normalizeUrl(r[0]);
    const img = normalizeUrl(r[1] || r[4] || r[6] || r[8]);
    const name = String(r[2] || "").trim();
    const vendor = String(r[3] || "").trim();
    const color = String(r[10] || "").trim();
    const price = String(r[11] || "").trim();
    const blob = [name, vendor, color, price, url].join(" ").toLowerCase();
    return { url, img, name, vendor, color, price, blob };
  }

  let catalog = [];

  function render(list) {
    if (!cardsEl) return;

    cardsEl.innerHTML = "";

    const grid = document.createElement("div");
    grid.style.cssText = "display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px;";

    for (const p of list) {
      const card = document.createElement("div");
      card.style.cssText =
        "border:1px solid rgba(255,255,255,.12);border-radius:14px;overflow:hidden;background:rgba(2,6,23,.55);";

      const top = document.createElement("div");
      top.style.cssText =
        "height:160px;background:rgba(255,255,255,.06);display:flex;align-items:center;justify-content:center;overflow:hidden;";

      if (p.img) {
        const img = document.createElement("img");
        img.src = p.img;
        img.alt = p.name || "Guitar";
        img.loading = "lazy";
        img.style.cssText = "width:100%;height:100%;object-fit:cover;display:block;";
        top.appendChild(img);
      } else {
        top.textContent = "No image";
        top.style.cssText += "color:rgba(229,231,235,.6);font:13px system-ui;";
      }

      const body = document.createElement("div");
      body.style.cssText =
        "padding:10px 12px;font:14px system-ui;color:rgba(229,231,235,.92);display:flex;flex-direction:column;gap:6px;";

      const title = document.createElement("div");
      title.style.cssText = "font-weight:800;line-height:1.2;";
      title.textContent = p.name || "(untitled)";

      const meta = document.createElement("div");
      meta.style.cssText =
        "display:flex;justify-content:space-between;gap:10px;color:rgba(229,231,235,.65);font-size:12px;";
      meta.innerHTML = `<span>${p.vendor || ""}${p.color ? " • " + p.color : ""}</span><span>${p.price || ""}</span>`;

      const link = document.createElement("a");
      link.href = p.url || "#";
      link.target = "_blank";
      link.rel = "noopener";
      link.textContent = p.url ? "View on Gibson" : "No link";
      link.style.cssText =
        "margin-top:6px;text-decoration:none;display:inline-flex;justify-content:center;padding:8px 10px;border-radius:12px;border:1px solid rgba(255,255,255,.14);color:rgba(229,231,235,.92);background:rgba(17,24,39,.55);";
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

    // If the model returns JSON, extract .query
    if (s.startsWith("{") && s.endsWith("}")) {
      try {
        const obj = JSON.parse(s);
        if (obj && typeof obj.query === "string") s = obj.query;
      } catch {}
    }

    // Remove quotes / punctuation noise
    s = s.replace(/^"+|"+$/g, "");
    s = s.replace(/[^\w\s'-]/g, " ");
    s = s.replace(/\s+/g, " ").trim();

    // Strip common junk words that hurt matching
    const stop = new Set(["gibson", "guitar", "guitars", "show", "me", "a", "an", "the"]);
    const parts = s.split(" ").filter(w => !stop.has(w.toLowerCase()));
    return parts.join(" ").trim() || s.trim();
  }

  function applyFilter(q) {
    const raw = String(q || "");
    const cleaned = cleanQuery(raw);
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

  // ===== REALTIME =====
  let pc = null;
  let stream = null;
  let dc = null;

  async function getKey() {
    const r = await fetch("/token", { cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j?.error || `Token HTTP ${r.status}`);
    if (!j.value) throw new Error("No ephemeral key returned from /token");
    return j.value;
  }

  function stopRealtime() {
    try { if (dc) dc.close(); } catch {}
    try { if (pc) pc.close(); } catch {}
    try { if (stream) stream.getTracks().forEach(t => t.stop()); } catch {}
    dc = null; pc = null; stream = null;
    if (micState) micState.textContent = "Click to talk";
  }

  async function startRealtime() {
    stopRealtime();
    log("Starting realtime…");
    if (micState) micState.textContent = "Listening…";

    try {
      const key = await getKey();

      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });

      pc = new RTCPeerConnection();
      pc.addTrack(stream.getTracks()[0], stream);

      pc.ontrack = (e) => {
        const s = e.streams && e.streams[0];
        if (s && remoteAudio) remoteAudio.srcObject = s;
      };

      dc = pc.createDataChannel("oai-events");

      dc.onopen = () => {
        // Force English + short text only (NOT JSON, NOT Spanish)
        dc.send(JSON.stringify({
          type: "session.update",
          session: {
            instructions:
              "Return ONLY a short ENGLISH search phrase (2 to 6 words). " +
              "No Spanish. No JSON. No punctuation. No sentences. " +
              "Examples: SG Standard, Les Paul Custom, Pelham Blue, Explorer 80s."
          }
        }));

        // Request a text response for each click-to-talk session
        dc.send(JSON.stringify({
          type: "response.create",
          response: { modalities: ["text"] }
        }));
      };

      dc.onmessage = (e) => {
        let m;
        try { m = JSON.parse(e.data); } catch { return; }

        if (m.type === "response.output_text.done" && m.text) {
          const text = String(m.text).trim();
          log("VOICE QUERY: " + text);
          applyFilter(text);
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const sdpResp = await fetch(
        `https://api.openai.com/v1/realtime/calls?model=${encodeURIComponent(REALTIME_MODEL)}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/sdp" },
          body: offer.sdp
        }
      );

      if (!sdpResp.ok) {
        const t = await sdpResp.text().catch(() => "");
        throw new Error(`Realtime calls failed: ${sdpResp.status} ${t}`);
      }

      const answer = await sdpResp.text();
      await pc.setRemoteDescription({ type: "answer", sdp: answer });

      log("Connected.");
      if (micState) micState.textContent = "Connected";
    } catch (err) {
      log("ERROR: " + (err?.message || String(err)));
      stopRealtime();
    }
  }

  if (searchInput) searchInput.addEventListener("input", (e) => applyFilter(e.target.value));
  if (micBtn) micBtn.addEventListener("click", startRealtime);

  loadCSV().catch(err => log("CSV ERROR: " + (err?.message || String(err))));
})();
