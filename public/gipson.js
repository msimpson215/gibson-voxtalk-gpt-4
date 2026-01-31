const grid = document.getElementById("prodGrid");
const catalogState = document.getElementById("catalogState");

let CATALOG = [];
let READY = false;

function setState(msg){
  if (catalogState) catalogState.textContent = msg;
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
  return out.map(s => s.trim());
}

function parseCSV(text){
  const lines = text.split(/\r?\n/).filter(l => l.trim().length);
  const rows = [];

  for (let i=1; i<lines.length; i++){
    const cols = csvParseLine(lines[i]);
    rows.push(cols);
  }
  return rows;
}

function resolveImage(img){
  if (!img) return "";

  // If already full URL, use it
  if (/^https?:\/\//i.test(img)) return img;

  // Otherwise force local asset path
  return "/assets/" + img.replace(/^\/+/, "");
}

function buildCard(p){
  const card = document.createElement("div");
  card.className = "card";

  const thumb = document.createElement("div");
  thumb.className = "thumb";

  const img = document.createElement("img");
  img.alt = p.name;
  img.src = resolveImage(p.image);
  img.onerror = () => img.style.display = "none";
  thumb.appendChild(img);

  const meta = document.createElement("div");
  meta.className = "meta";

  meta.innerHTML = `
    <div class="name">${p.name}</div>
    <div class="price">${p.price}</div>
    <div class="link"><a href="${p.url}" target="_blank">View →</a></div>
  `;

  card.appendChild(thumb);
  card.appendChild(meta);
  return card;
}

function render(list){
  grid.innerHTML = "";
  list.forEach(p => grid.appendChild(buildCard(p)));
}

async function loadCatalog(){
  setState("loading...");
  const r = await fetch("/data/gibson.csv", { cache: "no-store" });
  const text = await r.text();
  const rows = parseCSV(text);

  CATALOG = rows.map(cols => ({
    name: cols[0],
    price: cols[1],
    image: cols[2],
    url: cols[3]
  }));

  READY = true;
  setState(`ready (${CATALOG.length} guitars)`);
  render(CATALOG.slice(0,3));
}

window.showProducts = function(q){
  if (!READY) return;
  const term = q.toLowerCase();
  const results = CATALOG.filter(g => g.name.toLowerCase().includes(term));
  render(results);
};

loadCatalog();
