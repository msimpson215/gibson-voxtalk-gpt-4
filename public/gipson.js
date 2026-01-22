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

/* ---------------- CSV parsing ---------------- */

function parseCSV(text) {
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

function forceHttps(u) {
  return u ? u.replace(/^http:\/\//i, "https://") : "";
}

/* -------- Robust header matching -------- */

function normKey(k) {
  return String(k || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\w\s-]/g, "");
}

function getAny(row, candidates) {
  if (!row.__normMap) {
    const m = new Map();
    for (const [k, v] of Object.entries(row)) {
      m.set(normKey(k), v);
    }
    row.__normMap = m;
  }

  for (const c of candidates) {
    const direct = row[c];
    if (direct != null && String(direct).trim()) return String(direct).trim();

    const viaNorm = row.__normMap.get(normKey(c));
    if (viaNorm != null && String(viaNorm).trim()) return String(viaNorm).trim();
  }
  return "";
}

function normalizeRow(row) {
  const title = getAny(row, ["full-unstyled-link", "title", "name"]);
  const url   = getAny(row, ["full-unstyled-link href", "href", "url", "link"]);
  const image = getAny(row, ["motion-reduce src", "img src", "image url", "image"]);
  const price = getAny(row, ["price-item", "price"]);
  const vendor = getAny(row, ["vendor-name", "vendor", "brand"]);
  const sku = getAny(row, ["sku", "SKU", "data-sku"]);

  return {
    title,
    url,
    image: forceHttps(image),
    price,
    vendor,
    sku
  };
}

let PRODUCTS = [];

async function loadProducts() {
  const url = `/data/gibson.csv?v=${Date.now()}`;
  log(`Loading CSV: ${url}`);

  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`CSV fetch failed: ${r.status}`);

  const text = await r.text();
  const sniff = text.slice(0, 80).replace(/\s+/g, " ");
  log(`CSV first chars: ${sniff}`);

  if (text.trim().startsWith("<!doctype") || text.trim().startsWith("<html")) {
    throw new Error("CSV response looks like HTML (wrong file/path/static config)");
  }

  const rows = parseCSV(text);
  if (!rows.length) throw new Error("CSV empty after parse");

  const headers = rows[0].map(h => String(h).trim());
  log(`CSV headers (${headers.length}): ${headers.slice(0, 8).join(" | ")} ...`);

  const normalized = rows.slice(1)
    .map(cols => buildRowObject(headers, cols))
    .map(o => normalizeRow(o));

  PRODUCTS = normalized.filter(p => p.title && p.title.trim());

  log(`Rows parsed: ${normalized.length} | With title: ${PRODUCTS.length}`);
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

  return PRODUCTS
    .map(p => {
      const hay = `${p.title} ${p.vendor} ${p.price}`.toLowerCase();
      let score = 0;
      if (hay.includes(q)) score += 12;
      for (const part of q.split(/\s+/)) {
        if (part.length > 2 && hay.includes(part)) score += 2;
      }
      return { p, score };
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(x => x.p); // ALL matches (no slice)
}

function showProducts(q) {
  const hits = searchProducts(q);
  log(`SHOW "${q}" => ${hits.length} hits`);
  renderCards(hits);
}

window.showProducts = showProducts;

/* ---------------- UI open/close ---------------- */

navTry.addEventListener("click", async (e) => {
  e.preventDefault();
  drop.classList.toggle("hidden");

  if (!PRODUCTS.length) {
    try {
      await loadProducts();
    } catch (err) {
      log(`CSV ERROR: ${err.message}`);
    }
  }
});

/* ---------------- Voice (restart-safe) ---------------- */

let isActive = false;
let pc = null;
let dc = null;
let localStream = null;
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
  const m = s.match(/\[\[\s*SHOW\s*:\s*([^\]]+?)\s*\]\]/i);
  return m ? m[1].trim() : "";
}

function safeJsonParse(s) {
  try { return JSON.parse(s); } catch { return null; }
}

function resetVoiceState() {
  isActive = false;
  textBuffer = "";
  dc = null;
  pc = null;
  localStream = null;
  setMicState(false);
}

async function stopVoice() {
  log("Stopping voice...");
  try { dc?.close(); } catch {}
  try { pc?.close(); } catch {}
  try { localStream?.getTracks()?.forEach(t => t.stop()); } catch {}
  resetVoiceState();
  log("Voice stopped. You can click again.");
}

function handleAssistantTextDelta(deltaText) {
  if (!deltaText) return;
  textBuffer += deltaText;

  const q = tryExtractShowCommand(textBuffer);
  if (q) {
    showProducts(q);
    // remove the command so it doesn't retrigger
    textBuffer = textBuffer.replace(/\[\[\s*SHOW[\s\S]*?\]\]/gi, "");
  }

  // keep buffer from growing forever
  if (textBuffer.length > 8000) textBuffer = textBuffer.slice(-2000);
}

async function startVoice() {
  if (isActive) return;
  isActive = true;
  setMicState(true);
  textBuffer = "";
  log("Starting voice...");

  const sess = await fetch("/session", { method: "POST" }).then(r => r.json());
  if (!sess?.client_secret?.value) {
    await stopVoice();
    throw new Error("Missing client_secret from /session");
  }

  localStream = await navigator.mediaDevices.getUserMedia({ audio: true });

  pc = new RTCPeerConnection();

  for (const track of localStream.getTracks()) pc.addTrack(track, localStream);

  pc.ontrack = (event) => {
    const audio = ensureAssistantAudioEl();
    audio.srcObject = event.streams[0];
  };

  dc = pc.createDataChannel("oai-events");

  dc.onopen = () => {
    log("DataChannel open");
    // Reinforce English-only + SHOW behavior at runtime too
    dc.send(JSON.stringify({
      type: "session.update",
      session: {
        instructions: "Respond ONLY in English. If user asks to see/list/browse guitars, output [[SHOW: ...]]."
      }
    }));
  };

  dc.onclose = () => log("DataChannel closed");

  dc.onmessage = (e) => {
    const raw = String(e.data || "");
    const obj = safeJsonParse(raw);

    if (obj && obj.type) {
      // Different models/versions can emit different event types.
      // We handle a broad set so SHOW triggers reliably.
      if (obj.delta) handleAssistantTextDelta(String(obj.delta));
      if (obj.text) handleAssistantTextDelta(String(obj.text));
      if (obj.output_text) handleAssistantTextDelta(String(obj.output_text));

      // Common delta types
      if (obj.type === "response.output_text.delta" && obj.delta) handleAssistantTextDelta(String(obj.delta));
      if (obj.type === "response.text.delta" && obj.delta) handleAssistantTextDelta(String(obj.delta));
      if (obj.type === "response.output_text.done" && obj.text) handleAssistantTextDelta(String(obj.text));
      if (obj.type === "response.completed") {
        // final sweep
        const q = tryExtractShowCommand(textBuffer);
        if (q) showProducts(q);
        textBuffer = "";
      }
      return;
    }

    // Fallback: raw text
    handleAssistantTextDelta(raw);
  };

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

micBtn.addEventListener("click", async () => {
  try {
    if (!isActive) await startVoice();
    else await stopVoice();
  } catch (err) {
    log(`VOICE ERROR: ${err.message}`);
    await stopVoice(); // hard reset so the next click works
  }
});
