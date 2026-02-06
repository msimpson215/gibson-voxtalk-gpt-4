/* Gibson Voice AI Demo — gipson.js (full file)
 * - Loads CSV from /data/gibson.csv
 * - Renders product cards
 * - Text search filter
 * - WebRTC Realtime voice using ephemeral key from /token
 */

(() => {
  // ====== SETTINGS ======
  const CSV_URL = "/data/gibson.csv";

  // ✅ REQUIRED: supply model to Realtime calls
  const REALTIME_MODEL = "gpt-realtime";

  // ====== DOM ======
  const micBtn = document.getElementById("micBtn");
  const micState = document.getElementById("micState");
  const micDot = document.getElementById("micDot");
  const cardsEl = document.getElementById("cards");
  const logEl = document.getElementById("log");
  const searchInput = document.getElementById("searchInput");
  const countLabel = document.getElementById("countLabel");
  const manualInput = document.getElementById("manualInput");
  const manualBtn = document.getElementById("manualBtn");
  const remoteAudio = document.getElementById("remoteAudio");

  // ====== LOG ======
  function log(...args) {
    const s = args
      .map(a => (typeof a === "string" ? a : JSON.stringify(a, null, 2)))
      .join(" ");
    logEl.textContent += s + "\n";
    logEl.scrollTop = logEl.scrollHeight;
  }

  // ====== CSV PARSE ======
  function parseCSV(text) {
    // Simple CSV parser with quotes support
    const rows = [];
    let row = [];
    let cur = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      const next = text[i + 1];

      if (c === '"' && inQuotes && next === '"') {
        cur += '"';
        i++;
        continue;
      }

      if (c === '"') {
        inQuotes = !inQuotes;
        continue;
      }

      if (!inQuotes && (c === ",")) {
        row.push(cur);
        cur = "";
        continue;
      }

      if (!inQuotes && (c === "\n" || c === "\r")) {
        if (c === "\r" && next === "\n") i++;
        row.push(cur);
        cur = "";
        if (row.length > 1 || (row.length === 1 && row[0].trim() !== "")) rows.push(row);
        row = [];
        continue;
      }

      cur += c;
    }

    // flush
    if (cur.length || row.length) {
      row.push(cur);
      rows.push(row);
    }

    return rows;
  }

  function normalizeHeader(h) {
    return String(h || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "");
  }

  function normalizeUrl(u) {
    const s = String(u || "").trim();
    if (!s) return "";
    if (s.startsWith("http://") || s.startsWith("https://") || s.startsWith("data:image/")) return s;
    if (s.startsWith("//")) return `https:${s}`;
    if (s.startsWith("/")) return `https://www.gibson.com${s}`;
    // if it's a bare filename, assume local assets (kept for backward compatibility)
    if (/\.(png|jpg|jpeg|webp)$/i.test(s)) return `/assets/${s}`;
    return s;
  }

  function money(v) {
    const s = String(v ?? "").trim();
    if (!s) return "";
    const n = Number(s.replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(n) || n <= 0) return s;
    return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
  }

  // ====== DATA + RENDER ======
  let catalog = [];
  let headers = [];

  function pickField(obj, candidates) {
    for (const k of candidates) {
      if (obj[k] != null && String(obj[k]).trim() !== "") return obj[k];
    }
    return "";
  }

  function render(list) {
    cardsEl.innerHTML = "";

    for (const item of list) {
      const title = pickField(item, ["name", "title", "model", "product", "display_name"]);
      const sku = pickField(item, ["sku", "product_sku", "item_sku", "id"]);
      const price = pickField(item, ["price", "msrp", "amount"]);
      const image = pickField(item, ["image", "image_url", "img", "photo", "photo_url", "thumbnail", "thumb"]);
      const url = pickField(item, ["url", "product_url", "link", "href"]);

      const aUrl = normalizeUrl(url);
      const imgUrl = normalizeUrl(image);

      const card = document.createElement("div");
      card.className = "card";

      const imgWrap = document.createElement("div");
      imgWrap.className = "cardImg";

      if (imgUrl) {
        const img = document.createElement("img");
        img.alt = title || sku || "Guitar";
        img.loading = "lazy";
        img.src = imgUrl;
        imgWrap.appendChild(img);
      } else {
        imgWrap.textContent = "No image";
      }

      const body = document.createElement("div");
      body.className = "cardBody";

      const h = document.createElement("div");
      h.className = "title";
      h.textContent = title || "(untitled)";

      const meta = document.createElement("div");
      meta.className = "meta";

      const left = document.createElement("div");
      left.textContent = sku ? `SKU: ${sku}` : "SKU: —";

      const right = document.createElement("div");
      right.textContent = price ? money(price) : "";

      meta.appendChild(left);
      meta.appendChild(right);

      const link = document.createElement("a");
      link.className = "a";
      link.target = "_blank";
      link.rel = "noopener";
      link.href = aUrl || "#";
      link.textContent = aUrl ? "View on Gibson" : "No link";

      body.appendChild(h);
      body.appendChild(meta);
      body.appendChild(link);

      card.appendChild(imgWrap);
      card.appendChild(body);

      cardsEl.appendChild(card);
    }

    countLabel.textContent = `${list.length} shown / ${catalog.length} total`;
  }

  function applyFilter(q) {
    const s = String(q || "").trim().toLowerCase();
    if (!s) return render(catalog);

    const filtered = catalog.filter(obj => {
      // search across all fields
      return Object.values(obj).some(v => String(v || "").toLowerCase().includes(s));
    });

    render(filtered);
  }

  async function loadCSV() {
    const r = await fetch(CSV_URL, { cache: "no-store" });
    if (!r.ok) throw new Error(`CSV load failed: ${r.status}`);
    const text = await r.text();

    const rows = parseCSV(text);
    if (!rows.length) throw new Error("CSV empty");

    headers = rows[0].map(normalizeHeader);
    const dataRows = rows.slice(1);

    const mapped = dataRows
      .filter(rw => rw.some(cell => String(cell || "").trim() !== ""))
      .map(rw => {
        const obj = {};
        for (let i = 0; i < headers.length; i++) obj[headers[i]] = rw[i] ?? "";
        return obj;
      });

    catalog = mapped;

    console.log("[gipson.js] HEADERS:", headers);
    console.log("[gipson.js] CSV MAPPED SAMPLE (first 10):", catalog.slice(0, 10));

    log(`[CSV] Loaded ${catalog.length} rows`);
    render(catalog);
  }

  // ====== REALTIME WEBRTC ======
  let pc = null;
  let localStream = null;
  let dataChannel = null;

  function setMicState(state) {
    // state: "idle" | "live" | "err"
    micDot.classList.remove("live", "err");
    if (state === "live") micDot.classList.add("live");
    if (state === "err") micDot.classList.add("err");
  }

  async function getEphemeralKey() {
    const r = await fetch("/token", { cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j?.error || `Token HTTP ${r.status}`);
    const key = j?.value;
    if (!key) throw new Error("No ephemeral key returned from /token");
    return key;
  }

  async function startRealtime() {
    log("[RT] Starting realtime…");
    console.log("Starting realtime…");

    setMicState("live");
    micState.textContent = "Listening…";

    try {
      const ephemeralKey = await getEphemeralKey();

      localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      pc = new RTCPeerConnection();

      // Send mic track
      const [track] = localStream.getTracks();
      console.log("Mic track:", track);
      pc.addTrack(track, localStream);

      // Receive remote audio
      pc.ontrack = (event) => {
        const [stream] = event.streams;
        if (stream) remoteAudio.srcObject = stream;
      };

      // Events channel
      dataChannel = pc.createDataChannel("oai-events");
      dataChannel.onopen = () => {
        log("[RT] data channel open");

        // Minimal session update (optional)
        const msg = {
          type: "session.update",
          session: {
            // voice is already coming back as audio
            // you can add instructions if you want
            instructions: "You are a helpful Gibson guitar specialist. Keep it short."
          }
        };
        dataChannel.send(JSON.stringify(msg));
      };

      dataChannel.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          // Show anything useful, without spamming
          if (msg.type) log(`[EV] ${msg.type}`);
          if (msg.type === "response.output_text.delta" && msg.delta) log(msg.delta);
          if (msg.type === "response.output_text.done" && msg.text) log(msg.text);
          if (msg.type === "input_audio_buffer.speech_started") log("[RT] speech started");
          if (msg.type === "input_audio_buffer.speech_stopped") log("[RT] speech stopped");
        } catch {
          // ignore non-json
        }
      };

      // Create offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // ✅ FIX: include model on the calls endpoint
      const sdpResp = await fetch(
        `https://api.openai.com/v1/realtime/calls?model=${encodeURIComponent(REALTIME_MODEL)}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${ephemeralKey}`,
            "Content-Type": "application/sdp"
          },
          body: offer.sdp
        }
      );

      if (!sdpResp.ok) {
        const errText = await sdpResp.text().catch(() => "");
        throw new Error(`Realtime calls failed: ${sdpResp.status} ${errText}`);
      }

      const answerSdp = await sdpResp.text();
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });

      log("[RT] Connected.");
      micState.textContent = "Connected";
      setMicState("live");
    } catch (err) {
      console.error("START ERROR:", err);
      log("[RT] ERROR:", err?.message || String(err));
      micState.textContent = "Error";
      setMicState("err");
      stopRealtime();
    }
  }

  function stopRealtime() {
    try {
      if (dataChannel) {
        dataChannel.close();
        dataChannel = null;
      }
      if (pc) {
        pc.close();
        pc = null;
      }
      if (localStream) {
        localStream.getTracks().forEach(t => t.stop());
        localStream = null;
      }
    } catch {}
    micState.textContent = "Click to talk";
    setMicState("idle");
  }

  // ====== WIRE UI ======
  micBtn.addEventListener("click", () => {
    if (pc) {
      stopRealtime();
      log("[RT] Stopped.");
      return;
    }
    startRealtime();
  });

  searchInput.addEventListener("input", (e) => applyFilter(e.target.value));

  manualBtn.addEventListener("click", () => {
    const q = manualInput.value || "";
    log("[MANUAL QUERY]:", q);
    applyFilter(q);
  });

  // ====== INIT ======
  loadCSV().catch(err => {
    console.error(err);
    log("[CSV] ERROR:", err?.message || String(err));
    countLabel.textContent = "CSV load error";
  });
})();
