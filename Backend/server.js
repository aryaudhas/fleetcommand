// ============================================================
//  FleetCommand — Express Backend
//  process.env.PORT is used so Railway / Render can inject
//  their own port at runtime. Falls back to 3000 locally.
// ============================================================

const express = require('express');
const cors    = require('cors');
const fs      = require('fs');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;          // ← KEY LINE for deployment

const DATA_DIR  = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'trucks.json');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Seed data (used only on very first run) ──────────────────
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

const SEED_TRUCKS = [
  { id:'CA-101', driver:'Alice Martin',   origin:'Toronto',     destination:'Montreal',    status:'moving',  createdAt:daysAgo(1)  },
  { id:'CA-102', driver:'Bob Tremblay',   origin:'Vancouver',   destination:'Calgary',     status:'moving',  createdAt:daysAgo(1)  },
  { id:'CA-103', driver:'Charlie Nguyen', origin:'Ottawa',      destination:'Quebec City', status:'moving',  createdAt:daysAgo(2)  },
  { id:'CA-104', driver:'David Singh',    origin:'Halifax',     destination:'Moncton',     status:'delayed', createdAt:daysAgo(2)  },
  { id:'CA-105', driver:'Eva Kowalski',   origin:'Winnipeg',    destination:'Regina',      status:'moving',  createdAt:daysAgo(3)  },
  { id:'CA-106', driver:'Frank Leblanc',  origin:'Edmonton',    destination:'Saskatoon',   status:'moving',  createdAt:daysAgo(3)  },
  { id:'CA-107', driver:'Grace Kim',      origin:'Victoria',    destination:'Kelowna',     status:'idle',    createdAt:daysAgo(3)  },
  { id:'CA-108', driver:'Henry Okafor',   origin:'Fredericton', destination:'Halifax',     status:'moving',  createdAt:daysAgo(4)  },
  { id:'CA-109', driver:'Ivy Beaumont',   origin:'Quebec City', destination:'Ottawa',      status:'moving',  createdAt:daysAgo(4)  },
  { id:'CA-110', driver:'Jack Fortier',   origin:'Calgary',     destination:'Vancouver',   status:'moving',  createdAt:daysAgo(5)  },
  { id:'CA-111', driver:'Kara Johansson', origin:'Saskatoon',   destination:'Edmonton',    status:'idle',    createdAt:daysAgo(5)  },
  { id:'CA-112', driver:'Leo Patel',      origin:'Regina',      destination:'Winnipeg',    status:'moving',  createdAt:daysAgo(6)  },
  { id:'CA-113', driver:'Mia Fontaine',   origin:'Kelowna',     destination:'Victoria',    status:'moving',  createdAt:daysAgo(6)  },
  { id:'CA-114', driver:'Nina Dubois',    origin:'Montreal',    destination:'Toronto',     status:'moving',  createdAt:daysAgo(7)  },
  { id:'CA-115', driver:'Oscar Reyes',    origin:'Winnipeg',    destination:'Edmonton',    status:'delayed', createdAt:daysAgo(7)  },
  { id:'CA-116', driver:'Pam Delacroix',  origin:'Toronto',     destination:'Halifax',     status:'moving',  createdAt:daysAgo(8)  },
  { id:'CA-117', driver:'Quinn Lavoie',   origin:'Vancouver',   destination:'Victoria',    status:'moving',  createdAt:daysAgo(8)  },
  { id:'CA-118', driver:'Rick Santos',    origin:'Moncton',     destination:'Quebec City', status:'moving',  createdAt:daysAgo(9)  },
  { id:'CA-119', driver:'Sophia Gagnon',  origin:'Regina',      destination:'Calgary',     status:'idle',    createdAt:daysAgo(9)  },
  { id:'CA-120', driver:'Tom Briggs',     origin:'Kelowna',     destination:'Winnipeg',    status:'moving',  createdAt:daysAgo(10) },
];

// ── JSON file persistence ─────────────────────────────────────
function loadDB() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch (e) {
    console.warn('Could not read data file, using seed data.');
  }
  return { trucks: SEED_TRUCKS };
}

function saveDB() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}

let db = loadDB();

// ── Helpers ───────────────────────────────────────────────────
function findTruck(id) {
  return db.trucks.find(t => t.id === id);
}

// ── Trucks CRUD ───────────────────────────────────────────────

// GET all
app.get('/api/trucks', (req, res) => {
  res.json(db.trucks);
});

// GET one
app.get('/api/trucks/:id', (req, res) => {
  const t = findTruck(req.params.id);
  if (!t) return res.status(404).json({ error: 'Truck not found' });
  res.json(t);
});

// POST create
app.post('/api/trucks', (req, res) => {
  const { id, driver, origin, destination, status } = req.body;
  if (!id || !driver || !origin || !destination || !status)
    return res.status(400).json({ error: 'Missing required fields' });
  if (findTruck(id))
    return res.status(409).json({ error: `Truck ID '${id}' already exists` });

  const truck = { id, driver, origin, destination, status, createdAt: new Date().toISOString() };
  db.trucks.push(truck);
  saveDB();
  console.log(`[+] ${id} dispatched: ${origin} → ${destination}`);
  res.status(201).json(truck);
});

// PATCH update status only
app.patch('/api/trucks/:id/status', (req, res) => {
  const t = findTruck(req.params.id);
  if (!t) return res.status(404).json({ error: 'Truck not found' });
  const { status } = req.body;
  if (!['moving','idle','delayed'].includes(status))
    return res.status(400).json({ error: 'Invalid status' });
  t.status    = status;
  t.updatedAt = new Date().toISOString();
  saveDB();
  res.json(t);
});

// PATCH update any fields
app.patch('/api/trucks/:id', (req, res) => {
  const t = findTruck(req.params.id);
  if (!t) return res.status(404).json({ error: 'Truck not found' });
  ['driver','origin','destination','status'].forEach(f => {
    if (req.body[f] !== undefined) t[f] = req.body[f];
  });
  t.updatedAt = new Date().toISOString();
  saveDB();
  res.json(t);
});

// DELETE
app.delete('/api/trucks/:id', (req, res) => {
  const idx = db.trucks.findIndex(t => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Truck not found' });
  const [removed] = db.trucks.splice(idx, 1);
  saveDB();
  console.log(`[-] ${req.params.id} removed`);
  res.json({ deleted: true, truck: removed });
});

// ── Stats API ─────────────────────────────────────────────────
app.get('/api/stats', (req, res) => {
  const trucks  = db.trucks;
  const total   = trucks.length;
  const moving  = trucks.filter(t => t.status === 'moving').length;
  const idle    = trucks.filter(t => t.status === 'idle').length;
  const delayed = trucks.filter(t => t.status === 'delayed').length;

  // Top routes
  const routeCounts = {};
  trucks.forEach(t => {
    const key = `${t.origin} → ${t.destination}`;
    routeCounts[key] = (routeCounts[key] || 0) + 1;
  });
  const topRoutes = Object.entries(routeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([route, count]) => ({ route, count }));

  // Fleet growth last 14 days
  const growth = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const day = d.toISOString().slice(0, 10);
    growth.push({
      date:  day,
      count: trucks.filter(t => t.createdAt && t.createdAt.slice(0, 10) <= day).length
    });
  }

  // Active drivers
  const activeDrivers = trucks
    .filter(t => t.status === 'moving')
    .map(t => ({ driver: t.driver, id: t.id, route: `${t.origin} → ${t.destination}` }));

  res.json({ total, moving, idle, delayed, topRoutes, growth, activeDrivers });
});

// ── Catch-all → serve index.html ─────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Start ─────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('');
  console.log('  🚛  FleetCommand');
  console.log(`  ●   http://localhost:${PORT}`);
  console.log(`  📦  ${db.trucks.length} trucks loaded`);
  console.log('');
});
