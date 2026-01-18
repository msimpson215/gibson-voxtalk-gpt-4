<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Gibson Voice Demo (Mock)</title>

  <style>
    :root{
      --font: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;

      /* ===== MOVE ONLY THESE TWO NUMBERS ===== */
      --ai-top: 26px;      /* up/down */
      --ai-right: 380px;   /* left/right: bigger number = farther LEFT from right edge */
      /* ======================================= */

      /* Make it match the nav vibe */
      --ai-font-size: 12.5px;
      --ai-font-weight: 600;
      --ai-letter-spacing: .12px;

      /* Your “invite” color */
      --accent-red: #b91c1c;

      /* Circle */
      --ring: rgba(255,255,255,.85);
      --ring2: rgba(0,0,0,.12);
      --circleBg: rgba(255,255,255,.22);
      --circleBgOn: rgba(255,255,255,.30);

      /* Results tray */
      --line: rgba(0,0,0,.10);
      --shadow: 0 18px 46px rgba(0,0,0,.16);
      --radius: 22px;
    }

    *{ box-sizing:border-box }
    body{ margin:0; font-family:var(--font); }

    .bg{
      position:fixed; inset:0;
      background: url("/assets/gibson-bg.png") center/cover no-repeat;
      z-index: 0;
    }
    .scrim{
      position:fixed; inset:0;
      background: rgba(255,255,255,0.03);
      pointer-events:none;
      z-index: 1;
    }

    /* “Nav” link overlay */
    #aiLink{
      position:fixed;
      top: var(--ai-top);
      right: var(--ai-right);
      z-index: 999999;
      pointer-events:auto;

      appearance:none;
      border:0;
      background:transparent;
      padding:0;
      margin:0;

      font: inherit;
      font-size: var(--ai-font-size);
      font-weight: var(--ai-font-weight);
      letter-spacing: var(--ai-letter-spacing);
      line-height: 1;

      color: rgba(15,23,42,.82);
      cursor:pointer;
      white-space:nowrap;
      display:flex;
      align-items:baseline;
      gap:8px;
    }
    #aiLink .nudge{
      font-weight: 800;
      color: var(--accent-red);
      letter-spacing: .14px;
    }
    #aiLink .main{ color: inherit; }
    #aiLink:hover .main{
      text-decoration: underline;
      text-underline-offset: 4px;
    }

    /* If your top strip text is white (dark header), flip this true in JS */
    body.brandTextLight #aiLink{
      color: rgba(255,255,255,.92);
      text-shadow: 0 2px 10px rgba(0,0,0,.35);
    }
    body.brandTextLight #aiLink .nudge{
      color: rgba(255,210,210,.95);
      text-shadow: 0 2px 10px rgba(0,0,0,.35);
    }

    /* Circle placeholder (mic later) */
    .circleWrap{
      position:fixed;
      left: 50%;
      top: 160px;
      transform: translateX(-50%);
      z-index: 999999;
      display:none;
      pointer-events:none;
    }
    .circleWrap.show{ display:block; pointer-events:auto; }

    .circleBtn{
      width:78px; height:78px;
      border-radius:999px;
      border:1px solid var(--ring2);
      background: var(--circleBg);
      backdrop-filter: blur(10px);
      box-shadow: 0 18px 40px rgba(0,0,0,.16);
      cursor:pointer;
      display:grid;
      place-items:center;
      user-select:none;
      transition: transform .06s ease, box-shadow .18s ease, background .18s ease;
    }
    .circleBtn:hover{
      box-shadow: 0 22px 50px rgba(0,0,0,.18);
      background: var(--circleBgOn);
    }
    .circleBtn:active{ transform: translateY(1px); }

    .circleInner{
      width:54px; height:54px;
      border-radius:999px;
      border:2px solid var(--ring);
      transition: box-shadow .18s ease, border-color .18s ease;
    }
    .circleOn .circleInner{
      border-color: rgba(242,199,107,.95);
      box-shadow: 0 0 0 10px rgba(242,199,107,.18);
    }

    .circleLabel{
      margin-top:8px;
      font-size:12px;
      font-weight:700;
      letter-spacing:.2px;
      text-align:center;
      user-select:none;
      color: rgba(15,23,42,.70);
    }
    body.brandTextLight .circleLabel{
      color: rgba(255,255,255,.90);
      text-shadow: 0 2px 10px rgba(0,0,0,.35);
    }

    /* Results tray */
    #resultsTray{
      position:fixed;
      left:18px; right:18px; bottom:18px;
      z-index: 999999;
      display:none;
      pointer-events:none;
    }
    #resultsTray.show{ display:block; }

    .trayInner{
      pointer-events:auto;
      margin: 0 auto;
      width: min(980px, 100%);
      background: rgba(255,255,255,.92);
      border:1px solid var(--line);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      backdrop-filter: blur(12px);
      overflow:hidden;
    }
    .trayHeader{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:12px;
      padding:12px 14px;
      border-bottom:1px solid var(--line);
      font-weight:950;
      letter-spacing:.2px;
    }
    .trayHeader small{ font-weight:800; color: rgba(15,23,42,.60); }

    #prodGrid{
      display:grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap:10px;
      padding:12px 14px 14px;
    }
    @media (max-width: 860px){
      #prodGrid{ grid-template-columns: 1fr; }
    }

    .prodCard{
      display:grid;
      grid-template-columns: 86px 1fr;
      gap:10px;
      padding:10px;
      border-radius: 16px;
      border:1px solid var(--line);
      background:#fff;
    }
    .thumb{
      width:86px; height:86px;
      border-radius: 12px;
      border:1px solid var(--line);
      overflow:hidden;
      display:flex; align-items:center; justify-content:center;
      background: #f8fafc;
    }
    .thumb img{ width:100%; height:100%; object-fit:cover; display:block; }
    .prodCard h4{ margin:0 0 4px 0; font-size:14px; }
    .meta{ margin:0; color: rgba(15,23,42,.62); font-size:12px; font-weight:700; }
    .price{ margin-top:6px; font-weight:950; }
    .meta a{ color:#2563eb; text-decoration:none; }
    .meta a:hover{ text-decoration:underline; }

    .trayClose{
      border:0;
      border-radius: 12px;
      padding:8px 10px;
      background: rgba(15,23,42,.92);
      color:#fff;
      font-weight:900;
      cursor:pointer;
    }
  </style>
</head>

<body>
  <div class="bg"></div>
  <div class="scrim"></div>

  <!-- The “nav” link overlay -->
  <button id="aiLink" type="button" aria-label="Open AI Guitar Specialist">
    <span class="nudge">Try our new</span>
    <span class="main">Guitar Specialist</span>
  </button>

  <!-- Circle (mic later) -->
  <div class="circleWrap" id="circleWrap" aria-hidden="true">
    <button class="circleBtn" id="circleBtn" type="button" title="Click to start/stop voice">
      <div class="circleInner"></div>
    </button>
    <div class="circleLabel" id="circleLabel">Click to talk</div>
  </div>

  <!-- Results tray -->
  <div id="resultsTray">
    <div class="trayInner">
      <div class="trayHeader">
        <div>Top matches <small id="resultsLabel"></small></div>
        <button class="trayClose" id="closeResults" type="button">Close</button>
      </div>
      <div id="prodGrid"></div>
    </div>
  </div>

  <script src="/gipson.js"></script>

  <script>
    // If your top brand strip text is WHITE, set true:
    const BRAND_TEXT_IS_LIGHT = false;
    document.body.classList.toggle("brandTextLight", BRAND_TEXT_IS_LIGHT);

    const aiLink = document.getElementById("aiLink");
    const circleWrap = document.getElementById("circleWrap");
    const circleBtn = document.getElementById("circleBtn");
    const circleLabel = document.getElementById("circleLabel");

    const resultsTray = document.getElementById("resultsTray");
    const resultsLabel = document.getElementById("resultsLabel");
    const closeResults = document.getElementById("closeResults");

    aiLink.addEventListener("click", () => {
      circleWrap.classList.toggle("show");
      circleWrap.setAttribute("aria-hidden", circleWrap.classList.contains("show") ? "false" : "true");
    });

    window.__gipson_setResultsVisible = (visible, query="") => {
      if (visible){
        resultsLabel.textContent = query ? `— "${query}"` : "";
        resultsTray.classList.add("show");
      } else {
        resultsTray.classList.remove("show");
        resultsLabel.textContent = "";
      }
    };
    closeResults.addEventListener("click", () => window.__gipson_setResultsVisible(false));

    function extractShowQuery(txt){
      const m = txt.match(/^\s*show\s+(.+)$/i);
      if (m) return m[1].trim();
      const m2 = txt.match(/\[\[\s*SHOW\s*:\s*([^\]]+)\]\]/i);
      if (m2) return m2[1].trim();
      return null;
    }

    // -------- Voice (WebRTC Realtime) --------
    let pc = null, dc = null, localStream = null, audioEl = null;

    function sendEvent(obj){
      if (!dc || dc.readyState !== "open") return;
      dc.send(JSON.stringify(obj));
    }

    async function startVoice(){
      circleBtn.classList.add("circleOn");
      circleLabel.textContent = "Listening…";

      pc = new RTCPeerConnection();

      audioEl = document.createElement("audio");
      audioEl.autoplay = true;
      pc.ontrack = (e) => { audioEl.srcObject = e.streams[0]; };

      localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      pc.addTrack(localStream.getTracks()[0]);

      dc = pc.createDataChannel("oai-events");

      dc.onopen = () => {
        circleLabel.textContent = "Voice is live";

        sendEvent({
          type: "session.update",
          session: {
            instructions:
              "You are a friendly, no-pressure guitar salesperson. Ask 1-2 quick questions, then recommend options. " +
              "Keep answers short. If the user mentions a model, help them compare. " +
              "When the user asks to show something, respond with [[SHOW: <query>]]."
          }
        });

        sendEvent({
          type: "response.create",
          response: {
            modalities: ["audio","text"],
            instructions:
              "Greet the user warmly. Ask what style of guitar they want (Les Paul, SG, acoustic, bass). Keep it short."
          }
        });
      };

      dc.onmessage = (e) => {
        try{
          const evt = JSON.parse(e.data);

          if (evt.type === "response.output_text.done" && evt.text) {
            const q = extractShowQuery(evt.text);
            if (q && window.__gipson_showProducts) window.__gipson_showProducts(q);
          }

          if (evt.type === "input_audio_transcription.completed" && evt.text) {
            const q = extractShowQuery(evt.text);
            if (q && window.__gipson_showProducts) window.__gipson_showProducts(q);
          }
        } catch(err){}
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const sdpResp = await fetch("/session", {
        method: "POST",
        body: offer.sdp,
        headers: { "Content-Type": "application/sdp" }
      });

      if (!sdpResp.ok) {
        const t = await sdpResp.text();
        console.error("Session failed:", t);
        circleLabel.textContent = "Error";
        stopVoice();
        return;
      }

      const answer = { type: "answer", sdp: await sdpResp.text() };
      await pc.setRemoteDescription(answer);
    }

    function stopVoice(){
      circleBtn.classList.remove("circleOn");
      circleLabel.textContent = "Click to talk";

      try { if (dc) dc.close(); } catch {}
      dc = null;

      try { if (pc) pc.close(); } catch {}
      pc = null;

      if (localStream) localStream.getTracks().forEach(t => { try{ t.stop(); } catch {} });
      localStream = null;

      if (audioEl) { try { audioEl.srcObject = null; } catch {} }
      audioEl = null;
    }

    circleBtn.addEventListener("click", async () => {
      if (pc) return stopVoice();
      try { await startVoice(); }
      catch(e){ console.error(e); circleLabel.textContent = "Error"; stopVoice(); }
    });

    if (window.__gipson_loadCatalog) window.__gipson_loadCatalog();
  </script>
</body>
</html>
