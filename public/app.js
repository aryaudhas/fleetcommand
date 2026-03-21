// ============================================================
//  FleetCommand — app.js (Tracking Page)
// ============================================================

const map = L.map('map', { zoomControl: false }).setView([56.1304, -106.3468], 4);
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
  attribution: '© OpenStreetMap © CARTO', maxZoom: 19
}).addTo(map);
L.control.zoom({ position: 'bottomright' }).addTo(map);

const truckIcon = L.divIcon({
  html: `<div style="width:28px;height:28px;background:#f59e0b;border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);border:2px solid #080b11;box-shadow:0 0 12px rgba(245,158,11,.55);
      display:flex;align-items:center;justify-content:center;">
    <div style="transform:rotate(45deg);font-size:13px;margin-left:1px;">🚛</div></div>`,
  className:'', iconSize:[28,28], iconAnchor:[14,28], popupAnchor:[0,-32]
});

const ORS = 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImQ4OTM2YjZkY2EyYzQ5MDdhZTZhNTNjMDg2MDQ5ZjY1IiwiaCI6Im11cm11cjY0In0=';

const SEED = [
  {id:'CA-101',driver:'Alice Martin',   origin:'Toronto',     destination:'Montreal',    status:'moving'},
  {id:'CA-102',driver:'Bob Tremblay',   origin:'Vancouver',   destination:'Calgary',     status:'moving'},
  {id:'CA-103',driver:'Charlie Nguyen', origin:'Ottawa',      destination:'Quebec City', status:'moving'},
  {id:'CA-104',driver:'David Singh',    origin:'Halifax',     destination:'Moncton',     status:'delayed'},
  {id:'CA-105',driver:'Eva Kowalski',   origin:'Winnipeg',    destination:'Regina',      status:'moving'},
  {id:'CA-106',driver:'Frank Leblanc',  origin:'Edmonton',    destination:'Saskatoon',   status:'moving'},
  {id:'CA-107',driver:'Grace Kim',      origin:'Victoria',    destination:'Kelowna',     status:'idle'},
  {id:'CA-108',driver:'Henry Okafor',   origin:'Fredericton', destination:'Halifax',     status:'moving'},
  {id:'CA-109',driver:'Ivy Beaumont',   origin:'Quebec City', destination:'Ottawa',      status:'moving'},
  {id:'CA-110',driver:'Jack Fortier',   origin:'Calgary',     destination:'Vancouver',   status:'moving'},
  {id:'CA-111',driver:'Kara Johansson', origin:'Saskatoon',   destination:'Edmonton',    status:'idle'},
  {id:'CA-112',driver:'Leo Patel',      origin:'Regina',      destination:'Winnipeg',    status:'moving'},
  {id:'CA-113',driver:'Mia Fontaine',   origin:'Kelowna',     destination:'Victoria',    status:'moving'},
  {id:'CA-114',driver:'Nina Dubois',    origin:'Montreal',    destination:'Toronto',     status:'moving'},
  {id:'CA-115',driver:'Oscar Reyes',    origin:'Winnipeg',    destination:'Edmonton',    status:'delayed'},
  {id:'CA-116',driver:'Pam Delacroix',  origin:'Toronto',     destination:'Halifax',     status:'moving'},
  {id:'CA-117',driver:'Quinn Lavoie',   origin:'Vancouver',   destination:'Victoria',    status:'moving'},
  {id:'CA-118',driver:'Rick Santos',    origin:'Moncton',     destination:'Quebec City', status:'moving'},
  {id:'CA-119',driver:'Sophia Gagnon',  origin:'Regina',      destination:'Calgary',     status:'idle'},
  {id:'CA-120',driver:'Tom Briggs',     origin:'Kelowna',     destination:'Winnipeg',    status:'moving'},
];

const trucks = [], routeLines = [];
let serverOnline = false;

let _tt;
function showToast(msg, type='success') {
  const el = document.getElementById('toast');
  el.textContent = msg; el.className = 'show'+(type==='error'?' error':'');
  clearTimeout(_tt); _tt = setTimeout(()=>{ el.className=''; }, 3200);
}

function interpolate(a,b,t){ return [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t]; }
function fitAll(){ if(!trucks.length)return; map.fitBounds(L.featureGroup(trucks.map(t=>t.marker)).getBounds().pad(.1)); }
function clearRoutes(){ routeLines.forEach(l=>map.removeLayer(l)); routeLines.length=0; }
function updateCount(){ document.getElementById('truckCount').textContent=`${trucks.length} unit${trucks.length!==1?'s':''}`; }

function moveTruck(truck) {
  (function step() {
    const route=truck.route, ni=(truck.currentIndex+1)%route.length;
    const from=route[truck.currentIndex], to=route[ni];
    const dist=map.distance(from,to);
    const speed=truck.status==='moving'?6:truck.status==='delayed'?3:0;
    const t=dist>0?Math.min(speed/dist,1):1;
    truck.progress+=t;
    if(truck.progress>=1){truck.progress=0;truck.currentIndex=ni;}
    const pos=interpolate(from,to,truck.progress);
    truck.marker.setLatLng(pos);
    if(truck.coordEl) truck.coordEl.textContent=`${pos[0].toFixed(4)}, ${pos[1].toFixed(4)}`;
    truck.animFrame=requestAnimationFrame(step);
  })();
}

async function geocodeCity(city) {
  if(!city.toLowerCase().includes('canada')) city+=', Canada';
  const res=await fetch(`https://api.openrouteservice.org/geocode/search?api_key=${ORS}&text=${encodeURIComponent(city)}&size=1`);
  if(!res.ok) throw new Error('Geocoding failed');
  const data=await res.json();
  if(!data.features?.length) throw new Error('City not found: '+city);
  const [lng,lat]=data.features[0].geometry.coordinates;
  return [lat,lng];
}

async function getRoute(start,end) {
  const res=await fetch(`https://api.openrouteservice.org/v2/directions/driving-car?api_key=${ORS}&start=${start[1]},${start[0]}&end=${end[1]},${end[0]}&geometry_simplify=false`);
  if(!res.ok) throw new Error('Route fetch failed');
  const data=await res.json();
  if(!data.features?.length) throw new Error('No route found');
  return data.features[0].geometry.coordinates.map(c=>[c[1],c[0]]);
}

async function removeTruck(id) {
  try {
    if(serverOnline) await apiFetch(`/api/trucks/${id}`,{method:'DELETE'});
    const idx=trucks.findIndex(t=>t.id===id); if(idx===-1)return;
    const tk=trucks[idx]; cancelAnimationFrame(tk.animFrame); map.removeLayer(tk.marker); tk.card.remove();
    trucks.splice(idx,1); updateCount(); showToast(`✓ ${id} removed`);
  } catch { showToast(`✗ Could not remove ${id}`,'error'); }
}

async function addTruckToMap(data, silent=false) {
  const {id,driver,origin,destination,status}=data;
  try {
    const op=await geocodeCity(origin), dp=await geocodeCity(destination);
    const route=await getRoute(op,dp);
    const colors={moving:'#10b981',idle:'#f59e0b',delayed:'#f43f5e'};
    const line=L.polyline(route,{color:colors[status]||'#38bdf8',weight:2,opacity:.45,dashArray:status==='delayed'?'6,4':null}).addTo(map);
    routeLines.push(line);
    const bg={moving:'#052e1c',idle:'#78350f',delayed:'#4c0519'};
    const col={moving:'#10b981',idle:'#f59e0b',delayed:'#f43f5e'};
    const popup=`<div class="popup-inner">
      <div class="popup-id">${id}</div>
      <div class="popup-driver">👤 ${driver}</div>
      <div class="popup-route">📍 ${origin} → ${destination}</div>
      <div style="display:inline-block;margin-top:6px;padding:2px 8px;border-radius:4px;font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;background:${bg[status]||'#1a2233'};color:${col[status]||'#e8ecf5'}">${status.toUpperCase()}</div>
    </div>`;
    const marker=L.marker(route[0],{icon:truckIcon}).addTo(map).bindPopup(popup,{maxWidth:220});
    const card=document.createElement('div');
    card.className=`truck-card ${status}`;
    card.innerHTML=`
      <div class="truck-card-head"><div class="t-id">${id}</div><span class="pill ${status}">${status}</span></div>
      <div class="t-driver">👤 ${driver}</div>
      <div class="t-route">📍 ${origin} → ${destination}</div>
      <div class="truck-card-footer">
        <div class="t-coords" id="coords-${id}">---.----, ---.----</div>
        <button class="remove-btn" onclick="event.stopPropagation();removeTruck('${id}')">✕ Remove</button>
      </div>`;
    card.addEventListener('click',()=>{ map.flyTo(marker.getLatLng(),7,{duration:1.2}); setTimeout(()=>marker.openPopup(),400); });
    document.getElementById('truckList').appendChild(card);
    const truck={id,driver,origin,destination,status,marker,route,card,coordEl:document.getElementById(`coords-${id}`),progress:0,currentIndex:0,animFrame:null};
    trucks.push(truck); moveTruck(truck); updateCount();
    if(!silent) showToast(`✓ ${id} dispatched: ${origin} → ${destination}`);
    return truck;
  } catch(e) {
    console.warn(`Skipped ${id}:`,e.message);
    if(!silent) showToast(`✗ ${e.message}`,'error');
    throw e;
  }
}

document.getElementById('dispatchBtn').addEventListener('click', async()=>{
  const truckId=document.getElementById('truckId').value.trim()||`CA-${121+trucks.length}`;
  const driverName=document.getElementById('driver').value.trim()||`Driver-${trucks.length+1}`;
  const originCity=document.getElementById('origin').value.trim();
  const destCity=document.getElementById('destination').value.trim();
  const statusVal=document.getElementById('status').value;
  if(!originCity||!destCity){showToast('✗ Enter origin and destination','error');return;}
  const btn=document.getElementById('dispatchBtn');
  btn.disabled=true; btn.textContent='Dispatching…';
  try {
    if(serverOnline){
      const r=await apiFetch('/api/trucks',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:truckId,driver:driverName,origin:originCity,destination:destCity,status:statusVal})});
      if(!r.ok){const e=await r.json();throw new Error(e.error||'Server error');}
    }
    await addTruckToMap({id:truckId,driver:driverName,origin:originCity,destination:destCity,status:statusVal});
    ['truckId','driver','origin','destination'].forEach(i=>{document.getElementById(i).value='';});
  } catch(e){ showToast(`✗ ${e.message}`,'error'); }
  finally { btn.disabled=false; btn.textContent='Dispatch Truck'; }
});

let _acT;
async function autocompleteCity(input) {
  clearTimeout(_acT);
  _acT=setTimeout(async()=>{
    const q=input.value; if(q.length<2)return;
    try {
      const res=await fetch(`https://api.openrouteservice.org/geocode/autocomplete?api_key=${ORS}&text=${encodeURIComponent(q)}&size=5`);
      if(!res.ok)return;
      const data=await res.json();
      const div=input.id==='origin'?document.getElementById('originSuggestions'):document.getElementById('destSuggestions');
      div.innerHTML='';
      (data.features||[]).forEach(f=>{
        const opt=document.createElement('div'); opt.textContent=f.properties.label;
        opt.onclick=()=>{input.value=f.properties.label;div.innerHTML='';};
        div.appendChild(opt);
      });
    } catch{}
  },300);
}
document.addEventListener('click',e=>{ if(!e.target.closest('.field')) document.querySelectorAll('.autocomplete-list').forEach(el=>el.innerHTML=''); });

(async()=>{
  const overlay=document.getElementById('loadingOverlay');
  const progress=document.getElementById('loadProgress');
  const loaderTxt=document.getElementById('loaderText');
  let truckList=[];
  try {
    const res=await apiFetch('/api/trucks');
    if(!res.ok) throw new Error();
    truckList=await res.json(); serverOnline=true;
  } catch {
    truckList=SEED; serverOnline=false;
    loaderTxt.textContent='DEMO MODE';
    showToast('⚠ Server offline — showing demo data','error');
  }
  const total=truckList.length; let done=0;
  for(const t of truckList){
    try{ await addTruckToMap(t,true); }catch{}
    done++; progress.textContent=`${done} / ${total}`;
  }
  overlay.style.transition='opacity 0.5s'; overlay.style.opacity='0';
  setTimeout(()=>{overlay.style.display='none';},500);
  showToast(`✓ ${trucks.length} trucks loaded${serverOnline?' from server':' (demo mode)'}`);
  fitAll();
})();
