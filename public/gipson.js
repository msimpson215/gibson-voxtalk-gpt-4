const navTry = document.getElementById("navTry");
const drop = document.getElementById("drop");
const micBtn = document.getElementById("micBtn");
const micState = document.getElementById("micState");
const cardsEl = document.getElementById("cards");
const logEl = document.getElementById("log");

function log(msg) {
  const t = new Date().toLocaleTimeString();
  logEl.textContent = `[${t}] ${msg}\n` + logEl.textContent;
}

// ---------------- CSV parsing ----------------
function parseCSV(text) {
  // Handles quoted fields and commas
  const rows = [];
  let row = [];
  let cur = "";
  let inQ = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const n = text[i + 1];

    if (c === '"' && inQ && n === '"') { cur += '"'; i++; continue; }
    if (c === '"') { inQ = !inQ; continue; }

    if (!inQ && (c === "\n" || c === "\r")) {
      if (cur.length || row.length) { row.push(cur); rows.push(row); }
      row = []; cur = "";
      continue;
    }

    if (!inQ && c === ",") { row.push(cur); cur = ""; continue; }

    cur += c;
  }
  if (cur.length || row.length) { row.push(cur); rows.push(row); }

  return rows.filter(r => r.some(v => String(v).trim().length));
}

function buildRowObject(headers, cols) {
  const o = {};
  headers.forEach((h, i) => (o[h] = (cols[i] ?? "").trim()));
  return o;
}

function normKey(k) {
  return String(k || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\w\s-]/g, "");
}

function getAny(row, candidates) {
  // row: original keys
  // candidates: possible original headers
  // also tries normalized match
  const normMap = row.__normMap || (() => {
    const m = new Map();
    for (const [k, v] of Object.entries(row)) {
      m.set(normKey(k), v);
    }
    row.__normMap = m;
    return m;
  })();

  for (const c of candidates) {
    const direct = row[c];
    if (direct != null && String(direct).trim()) return String(direct).trim();

    const viaNorm = normMap.get(normKey(c));
    if (viaNorm != null && String(viaNorm).trim()) return String(viaNorm).trim();
  }
  return "";
}

function forceHttps(u) {
  return u ? u.replace(/^http:\/\//i, "https://") : "";
}

// Your CSV (from the file you uploaded) uses these headers:
// - image: "motion-reduce src"
// - url:   "full-unstyled-link href"
// - title: "full-unstyled-link"
// - price: "price-item"
// - vendor:"vendor-name"
function normalizeRow(row) {
  const title = getAny(row, [
    "full-unstyled-link",
    "title",
    "name"
  ]);

  const url = getAny(row, [
    "full-unstyled-link href",
    "product url",
    "url",
    "link"
  ]);

  const image = getAny(row, [
    "motion-reduce src",
    "image url",
    "image",
    "img"
  ]);

  const price = getAny(row, [
    "price-item",
    "price",
    "Price"
  ]);

  const vendor = getAny(row, [
    "vendor-name",
    "vendor",
    "brand"
  ]);

  // SKU isn’t clean in your scrape; we’ll attempt a few, otherwise blank.
  const sku = getAny(row, [
    "sku",
    "SKU",
    "data-sku",
    "product-sku"
  ]);

  return {
    title,
    url,
    image: forceHttps(image),
    price,
    vendor,
    sku,
    raw: row
  };
}

let PRODUCTS = [];

async function loadProducts() {
  const url = `/data/gibson.csv?v=${Date.now()}`;
  log(`Loading CSV: ${url}`);

  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`CSV fetch failed: ${r.status}`);

  const text = await r.text();
  const rows = parseCSV(text);
  if (!rows.length) throw new Error("CSV empty");

  const headers = rows[0].map(h => String(h).trim());
  log(`CSV headers loaded (${headers.length}): ${headers.slice(0, 6).join(" | ")} ...`);

  const dataRows = rows.slice(1);
  PRODUCTS = dataRows
    .map(cols => buildRowObject(headers, cols))
    .map(o => normalizeRow(o))
    .filter(p => p.title);

  log(`Loaded ${PRODUCTS.length} products`);
}

function clearCards() {
  cardsEl.innerHTML = "";
}

function renderCards(list) {
  clearCards();

  if (!list.length) {
    cardsEl.innerHTML = `<div style="color:#5b6476;font-size:12px;">No matches.</div>`;
    return;
  }

  for (const p of list) {
    const card = document.createElement("div");
    card.className = "card";

    const img = document.createElement("img");
    img.className = "cardImg";
    img.alt = p.title || "Guitar";
    img.loading = "lazy";
    img.src = p.image || "";

    // If hotlink fails, hide the image cleanly
    img.onerror = () => { img.style.display = "none"; };

    const body = document.createElement("div");
    body.className = "cardBody";

    const title = document.createElement("div");
    title.className = "cardTitle";
    title.textContent = p.title || "Unknown";

    const meta = document.createElement("div");
    meta.className = "cardMeta";
    meta.innerHTML = `
      ${p.price ? `<span><b>Price:</b> ${p.price}</span>` : ""}
      ${p.vendor ? `<span><b>Vendor:</b> ${p.vendor}</span>` : ""}
      ${p.sku ? `<span><b>SKU:</b> ${p.sku}</span>` : ""}
    `;

    const link = document.createElement("a");
    link.className = "cardLink";
    link.href = p.url || "#";
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = p.url ? "View product" : "No link";

    body.appendChild(title);
    body.appendChild(meta);
    body.appendChild(link);

    card.appendChild(img);
    card.appendChild(body);

    cardsEl.appendChild(card);
  }
}

function searchProducts(query) {
  const q = String(query || "").toLowerCase().trim();
  if (!q) return [];

  const scored = PRODUCTS.map(p => {
    const hay = `${p.title} ${p.vendor} ${p.price} ${p.url}`.toLowerCase();
    let score = 0;

    if (hay.includes(q)) score += 12;
    for (const part of q.split(/\s+/)) {
      if (part.length > 2 && hay.includes(part)) score += 2;
    }
    return { p, score };
  })
  .filter(x => x.score > 0)
  .sort((a, b) => b.score - a.score)
  .slice(0, 6)
  .map(x => x.p);

  return scored;
}

function showProducts(q) {
  const hits = searchProducts(q);
  log(`SHOW "${q}" => ${hits.length} hits`);
  renderCards(hits);
}

// Console helper for manual test:
window.showProducts = showProducts;

// ---------------- UI toggle ----------------
navTry.addEventListener("click", async (e) => {
  e.preventDefault();
  drop.classList.toggle("hidden");

  if (!PRODUCTS.length) {
    try {
      await loadProducts();
      // Quick sanity check:
      // showProducts("sunburst");
    } catch (err) {
      log(`CSV ERROR: ${err.message}`);
    }
  }
});

// ---------------- Voice (WebRTC) restart-safe ----------------
let isActive = false;
let pc = null;
let dc = null;
let localStream = null;

// Accumulate assistant text to detect [[SHOW: ...]]
let textBuffer = "";

function setMicState(on) {
  micState.textContent = on ? "ON" : "OFF";
  micBtn.disabled = false;
  micBtn.style.pointerEvents = "auto";
}

function ensureAssistantAudioEl() {
  let audio = document.getElementById("assistantAudio");
  if (!audio) {
    audio = document.createElement("audio");
    audio.id = "assistantAudio";
    audio.autoplay = true;
    document.body.appendChild(audio);
  }
  return audio;
}

function tryExtractShowCommand(s) {
  // Example: [[SHOW: les paul sunburst]]
  const m = s.match(/\[\[\s*SHOW\s*:\s*([^\]]+?)\s*\]\]/i);
  return m ? m[1].trim() : "";
}

function safeJsonParse(s) {
  try { return JSON.parse(s); } catch { return null; }
}

async function startVoice() {
  if (isActive) return;
  isActive = true;
  setMicState(true);
  textBuffer = "";
  log("Starting voice...");

  // 1) Get session secret
  const sess = await fetch("/session", { method: "POST" }).then(r => r.json());
  if (!sess?.client_secret?.value) {
    isActive = false;
    setMicState(false);
    throw new Error("Missing client_secret from /session");
  }

  // 2) Mic input
  localStream = await navigator.mediaDevices.getUserMedia({ audio: true });

  // 3) WebRTC peer connection
  pc = new RTCPeerConnection();

  // Send mic audio
  for (const track of localStream.getTracks()) {
    pc.addTrack(track, localStream);
  }

  // Receive assistant audio
  pc.ontrack = (event) => {
    const audio = ensureAssistantAudioEl();
    audio.srcObject = event.streams[0];
  };

  // Data channel (events)
  dc = pc.createDataChannel("oai-events");

  dc.onopen = () => {
    log("DataChannel open");

    // Optional: reinforce English-only at runtime too
    const msg = {
      type: "session.update",
      session: {
        instructions:
          "Respond ONLY in English. Never use Spanish. If user speaks Spanish, reply in English that you only speak English."
      }
    };
    dc.send(JSON.stringify(msg));
  };

  dc.onclose = () => log("DataChannel closed");

  dc.onmessage = (e) => {
    const raw = String(e.data || "");
    const obj = safeJsonParse(raw);

    // If it's JSON events, look for text deltas / completion.
    if (obj && obj.type) {
      // Common event types include text deltas like:
      // "response.output_text.delta" with { delta: "..." }
      if (obj.type === "response.output_text.delta" && obj.delta) {
        textBuffer += obj.delta;
        const q = tryExtractShowCommand(textBuffer);
        if (q) {
          showProducts(q);
          // clear so it doesn't re-trigger
          textBuffer = textBuffer.replace(/\[\[\s*SHOW[\s\S]*?\]\]/gi, "");
        }
      }

      if (obj.type === "response.completed") {
        const q = tryExtractShowCommand(textBuffer);
        if (q) showProducts(q);
        textBuffer = "";
      }

      return;
    }

    // Fallback: if it’s plain text, still scan for [[SHOW: ...]]
    textBuffer += raw;
    const q = tryExtractShowCommand(textBuffer);
    if (q) {
      showProducts(q);
      textBuffer = textBuffer.replace(/\[\[\s*SHOW[\s\S]*?\]\]/gi, "");
    }
  };

  // SDP exchange
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  const baseUrl = "https://api.openai.com/v1/realtime";
  const model = "gpt-4o-realtime-preview";

  const answerSDP = await fetch(`${baseUrl}?model=${encodeURIComponent(model)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sess.client_secret.value}`,
      "Content-Type": "application/sdp"
    },
    body: offer.sdp
  }).then(r => r.text());

  await pc.setRemoteDescription({ type: "answer", sdp: answerSDP });

  log("Voice connected. Click again to stop.");
}

async function stopVoice() {
  log("Stopping voice...");
  isActive = false;

  try { dc?.close(); } catch {}
  try { pc?.close(); } catch {}
  try { localStream?.getTracks()?.forEach(t => t.stop()); } catch {}

  dc = null;
  pc = null;
  localStream = null;

  setMicState(false);
  log("Voice stopped. You can click again.");
}

micBtn.addEventListener("click", async () => {
  micBtn.disabled = false;
  micBtn.style.pointerEvents = "auto";

  try {
    if (!isActive) await startVoice();
    else await stopVoice();
  } catch (err) {
    log(`VOICE ERROR: ${err.message}`);
    // Hard reset so it never gets stuck
    await stopVoice();
  }
});

window.addEventListener("beforeunload", () => {
  try { stopVoice(); } catch {}
});
