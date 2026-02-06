(() => {

const CSV_URL = "/data/gibson.csv";
const REALTIME_MODEL = "gpt-realtime";

const cardsEl = document.getElementById("cards");
const countLabel = document.getElementById("countLabel");
const logEl = document.getElementById("log");
const micBtn = document.getElementById("micBtn");
const searchInput = document.getElementById("searchInput");
const remoteAudio = document.getElementById("remoteAudio");

function log(t){ logEl.textContent += t + "\n"; }

function parseCSV(text){
  const rows=[]; let row=[],cur="",q=false;
  for(let i=0;i<text.length;i++){
    const c=text[i],n=text[i+1];
    if(c=='"'&&q&&n=='"'){cur+='"';i++;continue;}
    if(c=='"'){q=!q;continue;}
    if(!q&&c==","){row.push(cur);cur="";continue;}
    if(!q&&(c=="\n"||c=="\r")){row.push(cur);rows.push(row);row=[];cur="";continue;}
    cur+=c;
  }
  if(cur||row.length){row.push(cur);rows.push(row);}
  return rows;
}

let catalog=[];

function render(list){
  cardsEl.innerHTML="";
  for(const p of list){
    const d=document.createElement("div");
    d.innerHTML=`
      <img src="${p.image}" width="200"><br>
      <b>${p.name}</b><br>
      SKU: ${p.color}<br>
      ${p.price}<br>
      <a href="${p.url}" target="_blank">View</a>
      <hr>
    `;
    cardsEl.appendChild(d);
  }
  countLabel.textContent=`${list.length} shown / ${catalog.length} total`;
}

async function loadCSV(){
  const r=await fetch(CSV_URL);
  const text=await r.text();
  const rows=parseCSV(text);
  const data=rows.slice(1);

  // YOUR COLUMN MAP:
  // 0 = main product URL
  // 1 = main image
  // 2 = product name
  // 10 = color/variant
  // 11 = price

  catalog=data.map(r=>({
    url:r[0],
    image:r[1],
    name:r[2],
    color:r[10],
    price:r[11]
  }));

  render(catalog);
  log("CSV loaded: "+catalog.length);
}

function filter(q){
  q=q.toLowerCase();
  render(catalog.filter(p=>Object.values(p).join(" ").toLowerCase().includes(q)));
}

searchInput.addEventListener("input",e=>filter(e.target.value));

micBtn.onclick=()=>startRealtime();

async function startRealtime(){
  log("Starting realtime…");
  try{
    const k=await fetch("/token").then(r=>r.json()).then(j=>j.value);
    const stream=await navigator.mediaDevices.getUserMedia({audio:true});
    const pc=new RTCPeerConnection();
    pc.ontrack=e=>remoteAudio.srcObject=e.streams[0];
    pc.addTrack(stream.getTracks()[0],stream);

    const offer=await pc.createOffer();
    await pc.setLocalDescription(offer);

    const r=await fetch(`https://api.openai.com/v1/realtime/calls?model=${REALTIME_MODEL}`,{
      method:"POST",
      headers:{Authorization:`Bearer ${k}`,"Content-Type":"application/sdp"},
      body:offer.sdp
    });

    const ans=await r.text();
    await pc.setRemoteDescription({type:"answer",sdp:ans});
    log("Connected.");
  }catch(e){ log("ERROR "+e.message); }
}

loadCSV();
})();
