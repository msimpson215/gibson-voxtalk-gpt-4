<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Gibson Voice Demo</title>
  <link rel="stylesheet" href="/styles.css" />
</head>

<body>
<header class="topbar">
  <div class="brand">Gibson</div>

  <a href="#" id="navTry" class="nav-try">
    Try our new Guitar Specialist
    <span class="nav-sub">Click to talk</span>
  </a>
</header>

<main class="wrap">
  <!-- IMPORTANT: NO "hidden" here. UI is always visible -->
  <section id="drop" class="drop">

    <button id="micBtn" class="mic" aria-label="Click to talk">
      <span class="micIcon" aria-hidden="true">🎙️</span>
      <span class="micText">
        <span class="micTitle">Click to talk</span>
        <span class="micSub">Gibson Specialist (English only)</span>
      </span>
      <span id="micState" class="micState">OFF</span>
    </button>

    <div class="panel">
      <div class="panelRow">
        <div class="panelTitle">Top matches</div>
        <div class="panelHint">Try: “show sunburst”, “show les paul custom”</div>
      </div>

      <div id="cards" class="cards"></div>
    </div>

    <pre id="log" class="log"></pre>
  </section>
</main>

<script type="module" src="/gipson.js"></script>
</body>
</html>
