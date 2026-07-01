/* ======================================================
   Tile Box Planner – app.js
   ====================================================== */

// ─── Supabase Cloud Sync Configuration ──────────────────────────
const DEFAULT_SUPABASE_URL = "https://tnpghgqgavcfukjjmnwk.supabase.co";
const DEFAULT_SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRucGdoZ3FnYXZjZnVramptbndrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyNDAzMTksImV4cCI6MjA5NzgxNjMxOX0.-QoBvaLT1rm7X4tEYuodin2PrtpUWaBzb04s64wzu3k";

let supabaseClient = null;
let activeEstimateId = null;
let allCloudEstimates = []; // cached list of saved estimates for searching

function initSupabase() {
  const url = localStorage.getItem("supabase_url") || DEFAULT_SUPABASE_URL;
  const key = localStorage.getItem("supabase_anon_key") || DEFAULT_SUPABASE_KEY;

  if (typeof supabase !== "undefined" && url && key) {
    try {
      supabaseClient = supabase.createClient(url, key);
      console.log("Supabase client initialized successfully!");
    } catch (err) {
      console.error("Error creating Supabase client:", err);
    }
  } else {
    console.warn("Supabase library not loaded or credentials not configured.");
  }
}

function loadSettings() {
  const url = localStorage.getItem("supabase_url") || DEFAULT_SUPABASE_URL;
  const key = localStorage.getItem("supabase_anon_key") || DEFAULT_SUPABASE_KEY;

  const urlInput = document.getElementById("settings-supabase-url");
  const keyInput = document.getElementById("settings-supabase-key");

  if (urlInput) urlInput.value = url;
  if (keyInput) keyInput.value = key;
}

function saveSettings() {
  const urlVal = document.getElementById("settings-supabase-url").value.trim();
  const keyVal = document.getElementById("settings-supabase-key").value.trim();

  if (!urlVal || !keyVal) {
    alert("Please enter both the Supabase URL and Anon Key.");
    return;
  }

  localStorage.setItem("supabase_url", urlVal);
  localStorage.setItem("supabase_anon_key", keyVal);

  initSupabase();
  document.getElementById("settings-modal").close();
  alert("Supabase API settings saved and client re-initialized!");
}

function updateActiveEstimateStatus() {
  const statusEl = document.getElementById("active-estimate-status");
  if (!statusEl) return;

  if (activeEstimateId) {
    statusEl.textContent = "☁️ Cloud Saved";
    statusEl.className = "badge badge-green";
    statusEl.title = `Saved in database (ID: ${activeEstimateId})`;
  } else {
    statusEl.textContent = "✏️ New Plan";
    statusEl.className = "badge badge-blue";
    statusEl.title = "Not saved to cloud database yet";
  }
}

function setupDialogLightDismiss(dialogId) {
  const dialog = document.getElementById(dialogId);
  if (!dialog) return;

  if (!("closedBy" in HTMLDialogElement.prototype)) {
    dialog.addEventListener("click", (event) => {
      if (event.target !== dialog) return;

      const rect = dialog.getBoundingClientRect();
      const isDialogContent = (
        rect.top <= event.clientY &&
        event.clientY <= rect.top + rect.height &&
        rect.left <= event.clientX &&
        event.clientX <= rect.left + rect.width
      );

      if (isDialogContent) return;
      dialog.close();
    });
  }
}

// ─── Tile Database (from CSV) ───────────────────────────────────
let TILE_DB = [
  // 48×24 PGVT
  { name: "AGATHA BEIGE 48X24 PGVT",       coverage: 15.5, weight: 26 },
  { name: "NEOTI WHITE 48X24 PGVT",         coverage: 15.5, weight: 26 },
  { name: "BOTTOCHINO GOLD 48X24 PGVT",     coverage: 15.5, weight: 26 },
  { name: "CONWAY BIANCO 48X24 PGVT",       coverage: 15.5, weight: 26 },
  { name: "LUCIAN WHITE 48X24 PGVT",        coverage: 15.5, weight: 26 },
  { name: "PARKER WHITE 48X24 PGVT",        coverage: 15.5, weight: 26 },
  { name: "TANGO NARANGA 48X24 PGVT",       coverage: 15.5, weight: 26 },
  { name: "BALASTY ONYX 48X24 PGVT",        coverage: 15.5, weight: 26 },
  { name: "ANTARA GOLD 48X24 PGVT",         coverage: 15.5, weight: 26 },
  { name: "MARSI GOLD 48X24 PGVT",          coverage: 15.5, weight: 26 },
  { name: "MORIS GOLD 48X24 PGVT",          coverage: 15.5, weight: 26 },
  { name: "FIROZA AQUA 48X24 PGVT",         coverage: 15.5, weight: 26 },
  { name: "ALKIN ZELENI 48X24 PGVT",        coverage: 15.5, weight: 26 },
  { name: "AZERI GREY 48X24 PGVT",          coverage: 15.5, weight: 26 },
  { name: "EPSO WHITE 48X24 PGVT",          coverage: 15.5, weight: 26 },
  { name: "HAILE BLUE 48X24 PGVT",          coverage: 15.5, weight: 26 },
  { name: "REPEN SATUARIO 48X24 PGVT",      coverage: 15.5, weight: 26 },
  { name: "VEGA BLUE 48X24 PGVT",           coverage: 15.5, weight: 26 },
  // 48×24 HG
  { name: "HG IMPALA BLACK 48X24",          coverage: 15.5, weight: 26 },
  { name: "HG KORDORO BROWN 48X24",         coverage: 15.5, weight: 26 },
  { name: "HG PULIDO BLUE 48X24",           coverage: 15.5, weight: 26 },
  { name: "HG ONYX TEAL 48X24",             coverage: 15.5, weight: 26 },
  { name: "HG PLATINUM BLACK 48X24",        coverage: 15.5, weight: 26 },
  { name: "HG STROMY BLUE 48X24",           coverage: 15.5, weight: 26 },
  // 24×24 GVT
  { name: "ZET BLUE 24X24 GVT",             coverage: 15.5, weight: 26 },
  { name: "SALOMA BEIGE 24X24 GVT",         coverage: 15.5, weight: 26 },
  // 20×20
  { name: "GARDENA GREY 20X20",             coverage: 8.07, weight: 13 },
  { name: "GARDENA NERO 20X20",             coverage: 8.07, weight: 13 },
  // KAG
  { name: "KAG GOLD 20 KG",                coverage: 50,   weight: 20 },
  { name: "KAG DIAMOND 20 KG",             coverage: 50,   weight: 20 },
  // 18×12 WP ELE
  { name: "BAYWALK GREY 18X12 WP ELE",      coverage: 8.72, weight: 10 },
  { name: "BEVERLY GRIS 18X12 WP ELE",      coverage: 8.72, weight: 10 },
  { name: "ROMFO GRIS 18X12 WP ELE",        coverage: 8.72, weight: 10 },
  { name: "10046 L 18X12 WP",               coverage: 8.72, weight: 10 },
  { name: "10047 HL 1 18X12 WP",            coverage: 8.72, weight: 10 },
  { name: "10048 HL 2 18X12 WP",            coverage: 8.72, weight: 10 },
  { name: "10049 D 18X12 WP",               coverage: 8.72, weight: 10 },
  { name: "10051 L 18X12 WP",               coverage: 8.72, weight: 10 },
  { name: "10052 HL 1 18X12 WP",            coverage: 8.72, weight: 10 },
  { name: "10053 HL 2 18X12 WP",            coverage: 8.72, weight: 10 },
  { name: "10054 D 18X12 WP",               coverage: 8.72, weight: 10 },
  { name: "10076 L 18X12 WP",               coverage: 8.72, weight: 10 },
  { name: "10077 HL 1 18X12 WP",            coverage: 8.72, weight: 10 },
  { name: "10078 HL 2 18X12 WP",            coverage: 8.72, weight: 10 },
  { name: "10079 D 18X12 WP",               coverage: 8.72, weight: 10 },
  { name: "10085 L 18X12 WP",               coverage: 8.72, weight: 10 },
  { name: "10087 HL 2 18X12 WP",            coverage: 8.72, weight: 10 },
  { name: "10088 D 18X12 WP",               coverage: 8.72, weight: 10 },
  { name: "10914 L 18X12 WP",               coverage: 8.72, weight: 10 },
  { name: "10915 HL 1 18X12 WP",            coverage: 8.72, weight: 10 },
  { name: "10916 D 18X12 WP",               coverage: 8.72, weight: 10 },
  { name: "10927 L 18X12 WP",               coverage: 8.72, weight: 10 },
  { name: "10928 HL1 18X12 WP",             coverage: 8.72, weight: 10 },
  { name: "10930 D 18X12 WP",               coverage: 8.72, weight: 10 },
  { name: "BREE KITCHEN D 18X12 WP",        coverage: 8.72, weight: 10 },
  { name: "BREE KITCHEN HL-R 18X12 WP",     coverage: 8.72, weight: 10 },
  { name: "BREE KITCHEN L 18X12 WP",        coverage: 8.72, weight: 10 },
  { name: "58005 L 18X12 WP",               coverage: 8.72, weight: 10 },
  { name: "58006 HL1 18X12 WP",             coverage: 8.72, weight: 10 },
  { name: "58007 D 18X12 WP",               coverage: 8.72, weight: 10 },
  { name: "58017 L 18X12 WP",               coverage: 8.72, weight: 10 },
  { name: "58018 HL1 18X12 WP",             coverage: 8.72, weight: 10 },
  { name: "58020 D 18X12 WP",               coverage: 8.72, weight: 10 },
  { name: "58026 L 18X12 WP",               coverage: 8.72, weight: 10 },
  { name: "58027 HL1 18X12 WP",             coverage: 8.72, weight: 10 },
  { name: "58028 HL2 18X12 WP",             coverage: 8.72, weight: 10 },
  { name: "58029 D 18X12 WP",               coverage: 8.72, weight: 10 },
  { name: "58039 L 18X12 WP",               coverage: 8.72, weight: 10 },
  { name: "58040 HL1 18X12 WP",             coverage: 8.72, weight: 10 },
  { name: "58041 D 18X12 WP",               coverage: 8.72, weight: 10 },
  { name: "58042 D 18X12 WP",               coverage: 8.72, weight: 10 },
  { name: "58057 L 18X12 WP",               coverage: 8.72, weight: 10 },
  { name: "58058 HL1 18X12 WP",             coverage: 8.72, weight: 10 },
  { name: "58059 D 18X12 WP",               coverage: 8.72, weight: 10 },
  { name: "58065 L 18X12 WP",               coverage: 8.72, weight: 10 },
  { name: "58067 HL2 18X12 WP",             coverage: 8.72, weight: 10 },
  { name: "58068 D 18X12 WP",               coverage: 8.72, weight: 10 },
  { name: "58074 L 18X12 WP",               coverage: 8.72, weight: 10 },
  { name: "58075 HL1 18X12 WP",             coverage: 8.72, weight: 10 },
  { name: "58076 HL2 18X12 WP",             coverage: 8.72, weight: 10 },
  { name: "58077 D 18X12 WP",               coverage: 8.72, weight: 10 },
  { name: "58084 L 18X12 WP",               coverage: 8.72, weight: 10 },
  { name: "58085 HL1 18X12 WP",             coverage: 8.72, weight: 10 },
  { name: "58086 KITCHEN HL R 18X12 WP",    coverage: 8.72, weight: 10 },
  { name: "58087 D 18X12 WP",               coverage: 8.72, weight: 10 },
  { name: "58089 L 18X12 WP",               coverage: 8.72, weight: 10 },
  { name: "58090 POOJA HL1 R 18X12 WP",     coverage: 8.72, weight: 10 },
  { name: "58091 POOJA HL2 18X12 WP",       coverage: 8.72, weight: 10 },
  { name: "58092 KITCHEN HL R 18X12 WP",    coverage: 8.72, weight: 10 },
  { name: "58093 L 18X12 WP",               coverage: 8.72, weight: 10 },
  { name: "58094 POOJA HL R 18X12 WP",      coverage: 8.72, weight: 10 },
  { name: "58095 KITCHEN HL R 18X12 WP",    coverage: 8.72, weight: 10 },
  { name: "58104 L 18X12 WP",               coverage: 8.72, weight: 10 },
  { name: "58105 HL1 18X12 WP",             coverage: 8.72, weight: 10 },
  { name: "58106 D 18X12 WP",               coverage: 8.72, weight: 10 },
  { name: "30046 L 18X12 WP",               coverage: 8.72, weight: 10 },
  { name: "30047 HL 18X12 WP",              coverage: 8.72, weight: 10 },
  { name: "30048 HL 18X12 WP",              coverage: 8.72, weight: 10 },
  { name: "30049 D 18X12 WP",               coverage: 8.72, weight: 10 },
  { name: "51013 L 18X12 WP",               coverage: 8.72, weight: 10 },
  { name: "51014 HL 18X12 WP",              coverage: 8.72, weight: 10 },
  { name: "51015 D 18X12 WP",               coverage: 8.72, weight: 10 },
  { name: "51089 L 18X12 WP",               coverage: 8.72, weight: 10 },
  { name: "51096 HL-R 18X12 WP",            coverage: 8.72, weight: 10 },
  { name: "51097 D 18X12 WP",               coverage: 8.72, weight: 10 },
  { name: "51279 L 18X12 WP",               coverage: 8.72, weight: 10 },
  { name: "51281 HL 2 18X12 WP",            coverage: 8.72, weight: 10 },
  { name: "51283 D 18X12 WP",               coverage: 8.72, weight: 10 },
  { name: "COSERA KITCHEN D 18X12 WP",      coverage: 8.72, weight: 10 },
  { name: "COSERA KITCHEN HL R 18X12 WP",   coverage: 8.72, weight: 10 },
  { name: "COSERA KITCHEN L 18X12 WP",      coverage: 8.72, weight: 10 },
  { name: "DIVINE POOJA HL 1 R 18X12 WP",   coverage: 8.72, weight: 10 },
  { name: "DIVINE POOJA HL 2 R 18X12 WP",   coverage: 8.72, weight: 10 },
  { name: "DIVINE POOJA L 18X12 WP",        coverage: 8.72, weight: 10 },
  { name: "GLIDER KITCHEN D 18X12 WP",      coverage: 8.72, weight: 10 },
  { name: "GLIDER KITCHEN HL R 18X12 WP",   coverage: 8.72, weight: 10 },
  { name: "GLIDER KITCHEN L 18X12 WP",      coverage: 8.72, weight: 10 },
  { name: "KERMIT KITCHEN D 18X12 WP",      coverage: 8.72, weight: 10 },
  { name: "KERMIT KITCHEN HL R 18X12 WP",   coverage: 8.72, weight: 10 },
  { name: "KERMIT KITCHEN L 18X12 WP",      coverage: 8.72, weight: 10 },
  { name: "MADRID KITCHEN D 18X12 WP",      coverage: 8.72, weight: 10 },
  { name: "MADRID KITCHEN HL R 18X12 WP",   coverage: 8.72, weight: 10 },
  { name: "MADRID KITCHEN L 18X12 WP",      coverage: 8.72, weight: 10 },
  { name: "PARLE KITCHEN D 18X12 WP",       coverage: 8.72, weight: 10 },
  { name: "PARLE KITCHEN HL R 18X12 WP",    coverage: 8.72, weight: 10 },
  { name: "PARLE KITCHEN L 18X12 WP",       coverage: 8.72, weight: 10 },
  { name: "SEAN KITCHEN D 18X12 WP",        coverage: 8.72, weight: 10 },
  { name: "SEAN KITCHEN HL R 18X12 WP",     coverage: 8.72, weight: 10 },
  { name: "SEAN KITCHEN L 18X12 WP",        coverage: 8.72, weight: 10 },
  // 18×12 SM ELE
  { name: "ERCOSA TOPAZ 18X12 SM ELE",      coverage: 8.72, weight: 10 },
  { name: "PLAZMA-EL 18X12 SM ELE",         coverage: 8.72, weight: 10 },
  { name: "RILES 18X12 SM ELE",             coverage: 8.72, weight: 10 },
  { name: "STONICA GRIS-EL 18X12 SM ELE",   coverage: 8.72, weight: 10 },
  { name: "BLOOM D 18X12 SM",               coverage: 8.72, weight: 10 },
  { name: "BLOOM HL1 18X12 SM",             coverage: 8.72, weight: 10 },
  { name: "BLOOM L 18X12 SM",               coverage: 8.72, weight: 10 },
  { name: "SPARTAN HL-R 18X12 SM",          coverage: 8.72, weight: 10 },
  { name: "SPARTAN L 18X12 SM",             coverage: 8.72, weight: 10 },
  // 18×12 HD
  { name: "KHD 104 18X12 HD",               coverage: 7.27, weight: 10 },
  { name: "KHD 113 18X12 HD",               coverage: 7.27, weight: 10 },
  { name: "KHD 123 18X12 HD",               coverage: 7.27, weight: 10 },
  { name: "KHD 124 18X12 HD",               coverage: 7.27, weight: 10 },
  { name: "KHD 145 18X12 HD",               coverage: 7.27, weight: 10 },
  { name: "KHD 147 18X12 HD",               coverage: 7.27, weight: 10 },
  { name: "KHD 148 18X12 HD",               coverage: 7.27, weight: 10 },
  { name: "KHD 153 18X12 HD",               coverage: 7.27, weight: 10 },
  { name: "KHD 176 18X12 HD",               coverage: 7.27, weight: 10 },
  // 16×16
  { name: "RONO GREY 16X16",                coverage: 8.61, weight: 18 },
  { name: "ADAK WOOD 16X16",                coverage: 8.61, weight: 18 },
  { name: "RONO NATURAL 16X16",             coverage: 8.61, weight: 18 },
  { name: "ELAN BLUE 16X16",                coverage: 8.61, weight: 18 },
  { name: "ERKA WOOD 16X16",                coverage: 8.61, weight: 18 },
  { name: "GRETEX BEIGE 16X16",             coverage: 8.61, weight: 18 },
  { name: "GRETEX GREY 16X16",              coverage: 8.61, weight: 18 },
  { name: "RONO WHITE 16X16",               coverage: 8.61, weight: 18 },
  { name: "TONG STONE 16X16",               coverage: 8.61, weight: 18 },
  // 15×10 WP
  { name: "71179 L 15X10 WP",               coverage: 8.07, weight: 8 },
  { name: "71182 D 15X10 WP",               coverage: 8.07, weight: 8 },
  { name: "71181 HL 2 15X10 WP",            coverage: 8.07, weight: 8 },
  { name: "71183 F 15X10 WP",               coverage: 8.07, weight: 8 },
  // 12×12 WP MAT
  { name: "10050 F 12X12 WP MAT",           coverage: 8.72, weight: 10 },
  { name: "10055 F 12X12 WP MAT",           coverage: 8.72, weight: 10 },
  { name: "10080 F 12X12 WP MAT",           coverage: 8.72, weight: 10 },
  { name: "10089 F 12X12 WP MAT",           coverage: 8.72, weight: 10 },
  { name: "10917 F 12X12 WP MAT",           coverage: 8.72, weight: 10 },
  { name: "10931 F 12X12 WP MAT",           coverage: 8.72, weight: 10 },
  { name: "58008 F 12X12 WP MAT",           coverage: 8.72, weight: 10 },
  { name: "58021 F 12X12 WP MAT",           coverage: 8.72, weight: 10 },
  { name: "58030 F 12X12 WP MAT",           coverage: 8.72, weight: 10 },
  { name: "58043 F 12X12 WP MAT",           coverage: 8.72, weight: 10 },
  { name: "58044 F 12X12 WP MAT",           coverage: 8.72, weight: 10 },
  { name: "58060 F 12X12 WP MAT",           coverage: 8.72, weight: 10 },
  { name: "58069 F 12X12 WP MAT",           coverage: 8.72, weight: 10 },
  { name: "58078 F 12X12 WP MAT",           coverage: 8.72, weight: 10 },
  { name: "58088 F 12X12 WP MAT",           coverage: 8.72, weight: 10 },
  { name: "58107 F 12X12 WP MAT",           coverage: 8.72, weight: 10 },
  { name: "30050 F 12X12 WP MAT",           coverage: 8.72, weight: 10 },
  { name: "51016 F 12X12 WP MAT",           coverage: 8.72, weight: 10 },
  { name: "51098 F 12X12 WP MAT",           coverage: 8.72, weight: 10 },
  { name: "51284 F 12X12 WP MAT",           coverage: 8.72, weight: 10 },
  // 12×12 Roofing
  { name: "SNOW WHITE ROOFING 12X12 VIT ROOF", coverage: 7.75, weight: 12 },
  { name: "BLOOM F 12X12 SM MAT",           coverage: 8.72, weight: 10 },
  { name: "ROOF ALTIS MULTI 12X12 ROOF",    coverage: 8.72, weight: 11 },
  { name: "ROOF LAME BLUE 12X12 ROOF",      coverage: 8.72, weight: 11 },
  { name: "SPARKLE LEO MULTI 12X12 ROOF",   coverage: 8.72, weight: 11 },
  { name: "ROOFING WHITE 12X12 ROOF",       coverage: 8.72, weight: 11 },
  // 12×12 PARK
  { name: "BRADFORD 12X12 PARK",            coverage: 7.75, weight: 12 },
  { name: "ESNEX 12X12 PARK",               coverage: 7.75, weight: 12 },
  { name: "FUYA BLUE 12X12 PARK",           coverage: 7.75, weight: 12 },
  { name: "HANIS GREY 12X12 PARK",          coverage: 7.75, weight: 12 },
  { name: "HOPA GREY 12X12 PARK",           coverage: 7.75, weight: 12 },
  { name: "IZEC GREEN 12X12 PARK",          coverage: 7.75, weight: 12 },
  { name: "LIVON NERO 12X12 PARK",          coverage: 7.75, weight: 12 },
  { name: "SONICA WHITE 12X12 PARK",        coverage: 7.75, weight: 12 },
  { name: "STELLA GRIS 12X12 PARK",         coverage: 7.75, weight: 12 },
  { name: "STELLA WOOD 12X12 PARK",         coverage: 7.75, weight: 12 },
  { name: "ZUQA GREY 12X12 PARK",           coverage: 7.75, weight: 12 },
  { name: "TOBA MULTI 12X12 PARK",          coverage: 7.75, weight: 12 },
];

// ─── State ─────────────────────────────────────────────────────
let rooms = [];
let nextId = 1;
let lastAddedRoomId = null;
let selectedTile = null;
let highlightedIdx = -1;
let filteredTiles = [];
let quotationItems = [];
let currentTab = 'planner';

// ─── DOM References ─────────────────────────────────────────────
const roomNameEl   = () => document.getElementById('room-name');
const roomLengthEl = () => document.getElementById('room-length');
const roomBreadthEl= () => document.getElementById('room-breadth');
const liveAreaEl   = () => document.getElementById('live-area-input');
const tileSearchEl = () => document.getElementById('tile-search');
const tileDropEl   = () => document.getElementById('tile-dropdown');
const finalBoxesEl  = () => document.getElementById('final-boxes');
const planTbody    = () => document.getElementById('plan-tbody');
const emptyState   = () => document.getElementById('empty-state');
const summarySection = () => document.getElementById('summary-section');

// ─── CSV Dynamic Parsing & Synchronization ──────────────────────
function parseCSV(text) {
  const lines = text.split(/\r?\n/);
  if (lines.length === 0) return [];
  
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  
  const nameIdx = headers.findIndex(h => h === 'name');
  const coverageIdx = headers.findIndex(h => h.includes('coverage') || h.includes('sqft per box'));
  const weightIdx = headers.findIndex(h => h.includes('weight') || h.includes('kg per box'));
  const unitIdx = headers.findIndex(h => h === 'unit');
  
  let boxRateIdx = headers.findIndex(h => h === 'rate' || h === 'price' || h === 'box rate' || h === 'box price');
  if (boxRateIdx === -1) {
    boxRateIdx = headers.findIndex(h => (h.includes('rate') || h.includes('price') || h.includes('mrp') || h.includes('cost')) && !h.includes('sqft'));
  }
  
  const sqftRateIdx = headers.findIndex(h => h.includes('sqft price') || h.includes('sqft rate'));
  
  const billingAreaIdx = headers.findIndex(h => h.includes('billing sqft'));
  
  const db = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const parts = line.split(',');
    if (parts.length < 2) continue;
    
    const name = parts[nameIdx !== -1 ? nameIdx : 0]?.trim() || '';
    if (!name || name.toLowerCase() === 'name' || /^,+$/.test(name)) continue;
    
    const coverage = parseFloat(parts[coverageIdx !== -1 ? coverageIdx : 1]) || 1;
    const weight = parseFloat(parts[weightIdx !== -1 ? weightIdx : 2]) || 0;
    
    let price = 0;
    if (boxRateIdx !== -1 && parts[boxRateIdx]) {
      price = parseFloat(parts[boxRateIdx]) || 0;
    }
    
    let sqftPrice = 0;
    if (sqftRateIdx !== -1 && parts[sqftRateIdx]) {
      sqftPrice = parseFloat(parts[sqftRateIdx]) || 0;
    }
    
    let billingArea = 0;
    if (billingAreaIdx !== -1 && parts[billingAreaIdx]) {
      billingArea = parseFloat(parts[billingAreaIdx]) || 0;
    }
    
    // If billingArea and sqftPrice exist, derive the per-box price from them
    if (billingArea > 0 && sqftPrice > 0) {
      price = Math.round(billingArea * sqftPrice * 100) / 100;
    }
    
    let unit = 'Boxes';
    if (unitIdx !== -1 && parts[unitIdx]) {
      unit = parts[unitIdx].trim();
    }
    
    db.push({
      name,
      coverage,
      weight,
      price,
      rate: price,
      sqftPrice,
      sqftRate: sqftPrice,
      billingArea,
      unit
    });
  }
  return db;
}

async function loadCSVOnStartup() {
  const cached = localStorage.getItem('cached_tile_db');
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // If old cache missing billingArea, clear it to force re-import
        if (parsed[0].billingArea === undefined) {
          localStorage.removeItem('cached_tile_db');
          console.log('Cache invalidated: old format without billingArea');
        } else {
          TILE_DB = parsed;
          console.log(`Loaded ${TILE_DB.length} tiles from localStorage cache`);
        }
      }
    } catch (e) {
      console.error('Failed to parse cached tile db:', e);
    }
  }

  const csvFiles = [
    './stock and price - Box planning & quotation data to feed.csv',
    './stock and price - Box planning (1).csv'
  ];

  for (const file of csvFiles) {
    try {
      const res = await fetch(file);
      if (res.ok) {
        const text = await res.text();
        const parsed = parseCSV(text);
        if (parsed.length > 0) {
          TILE_DB = parsed;
          localStorage.setItem('cached_tile_db', JSON.stringify(TILE_DB));
          console.log(`Loaded and cached ${TILE_DB.length} tiles from dynamic CSV fetch of ${file}`);
          break;
        }
      }
    } catch (e) {
      console.warn(`Dynamic CSV fetch for ${file} failed (expected if opening file:// directly).`, e);
    }
  }
}

function handleCSVUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    const text = e.target.result;
    const parsed = parseCSV(text);
    if (parsed.length > 0) {
      TILE_DB = parsed;
      localStorage.setItem('cached_tile_db', JSON.stringify(TILE_DB));
      alert(`Successfully loaded ${TILE_DB.length} tiles from "${file.name}"!`);
      
      filteredTiles = [...TILE_DB];
      if (tileSearchEl().value.trim()) {
        onTileSearch();
      } else {
        renderDropdown();
      }
      if (currentTab === 'catalog') {
        renderCatalogTable(currentCatalogFilter);
      }
    } else {
      alert('Could not find any valid tile data in the selected CSV file. Please make sure it has at least the columns: Name, Area Coverage.');
    }
  };
  reader.readAsText(file);
}

// ─── Init ───────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Initialize Supabase and settings
  initSupabase();
  loadSettings();
  updateActiveEstimateStatus();

  // Setup dialog close fallbacks for light-dismiss
  setupDialogLightDismiss('settings-modal');
  setupDialogLightDismiss('cloud-estimates-modal');

  loadCSVOnStartup();

  initVisualEffects();

  // Register PWA Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js')
      .then(reg => console.log('Service Worker registered successfully!', reg))
      .catch(err => console.error('Service Worker registration failed:', err));
  }

  // Real-time Capitalization for inputs
  const custNameEl = document.getElementById('customer-name');
  const planNotesEl = document.getElementById('plan-notes');

  const handleCapitalization = (el, transformFn) => {
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const oldVal = el.value;
    const newVal = transformFn(oldVal);
    if (oldVal !== newVal) {
      el.value = newVal;
      el.setSelectionRange(start, end);
    }
  };

  const capitalizeWordsRealtime = (val) => {
    if (!val) return '';
    return val.replace(/(^\w|\s\w)/g, m => m.toUpperCase());
  };

  const capitalizeSentenceRealtime = (val) => {
    if (!val) return '';
    return val.charAt(0).toUpperCase() + val.slice(1);
  };

  const quoteCustNameEl = document.getElementById('quote-customer-name');
  if (custNameEl) {
    custNameEl.addEventListener('input', (e) => {
      handleCapitalization(e.target, capitalizeWordsRealtime);
      if (quoteCustNameEl) quoteCustNameEl.value = e.target.value;
    });
  }
  if (quoteCustNameEl) {
    quoteCustNameEl.addEventListener('input', (e) => {
      handleCapitalization(e.target, capitalizeWordsRealtime);
      if (custNameEl) custNameEl.value = e.target.value;
    });
  }
  if (planNotesEl) {
    planNotesEl.addEventListener('input', (e) => {
      handleCapitalization(e.target, capitalizeSentenceRealtime);
    });
  }

  // Set today's date
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('plan-date').value = today;

  const d = new Date();
  const todayFormatted = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  document.getElementById('quote-date').value = todayFormatted;

  // Live area calculation
  roomLengthEl().addEventListener('input', updateLiveArea);
  roomBreadthEl().addEventListener('input', updateLiveArea);
  liveAreaEl().addEventListener('input', updateLiveBoxes);

  // Tile search
  tileSearchEl().addEventListener('input', onTileSearch);
  tileSearchEl().addEventListener('keydown', onTileKeyNav);
  tileSearchEl().addEventListener('focus', () => {
    if (tileSearchEl().value.trim()) onTileSearch();
    else { filteredTiles = [...TILE_DB]; renderDropdown(); }
  });

  // Close dropdown when clicking outside or tabbing away
  document.addEventListener('click', (e) => {
    const wrapper = document.querySelector('.tile-search-wrapper');
    if (wrapper && !wrapper.contains(e.target)) {
      closeTileDropdown();
    }
  });

  document.addEventListener('focusin', (e) => {
    const wrapper = document.querySelector('.tile-search-wrapper');
    if (wrapper && !wrapper.contains(e.target)) {
      closeTileDropdown();
    }
  });

  // Event delegation on dropdown for selection and highlighting
  const dropdownEl = tileDropEl();
  dropdownEl.addEventListener('click', (e) => {
    const option = e.target.closest('.tile-option');
    if (option) {
      const idx = parseInt(option.getAttribute('data-idx'), 10);
      selectTile(idx);
    }
  });

  dropdownEl.addEventListener('mouseover', (e) => {
    const option = e.target.closest('.tile-option');
    if (option) {
      const idx = parseInt(option.getAttribute('data-idx'), 10);
      if (highlightedIdx !== idx) {
        highlightedIdx = idx;
        const options = dropdownEl.querySelectorAll('.tile-option');
        options.forEach((opt, index) => {
          if (index === highlightedIdx) {
            opt.classList.add('highlighted');
          } else {
            opt.classList.remove('highlighted');
          }
        });
      }
    }
  });

  // Enter key on room form
  [roomNameEl(), roomLengthEl(), roomBreadthEl(), liveAreaEl(), finalBoxesEl()].forEach(el => {
    el && el.addEventListener('keydown', e => { if (e.key === 'Enter') addRoom(); });
  });

  renderTable();
});

// ─── Live Area ──────────────────────────────────────────────────
function initVisualEffects() {
  const header = document.querySelector('.header');
  if (header) {
    window.addEventListener('scroll', () => {
      header.classList.toggle('scrolled', window.scrollY > 8);
    }, { passive: true });
  }
}

function popValue(el) {
  if (!el) return;
  el.classList.remove('value-pop');
  void el.offsetWidth;
  el.classList.add('value-pop');
}

function setSummaryValue(id, text) {
  const el = document.getElementById(id);
  if (!el) return;
  if (el.textContent !== text) {
    el.textContent = text;
    popValue(el);
  }
}

function showViewPanel(view) {
  if (!view) return;
  view.style.display = 'block';
  view.classList.remove('view-hidden');
  requestAnimationFrame(() => view.classList.add('view-visible'));
}

function hideViewPanel(view, onDone) {
  if (!view || view.style.display === 'none') {
    if (onDone) onDone();
    return;
  }
  view.classList.remove('view-visible');
  view.classList.add('view-hidden');
  setTimeout(() => {
    view.style.display = 'none';
    view.classList.remove('view-hidden');
    if (onDone) onDone();
  }, 300);
}

function updateLiveArea() {
  const l = parseFloat(roomLengthEl().value) || 0;
  const b = parseFloat(roomBreadthEl().value) || 0;
  const areaEl = liveAreaEl();
  
  // Only override the area if both L and B are positive.
  // This allows manual entry to persist if L or B are empty.
  if (l > 0 && b > 0) {
    const area = l * b;
    const newText = area.toFixed(2);
    if (areaEl.value !== newText) {
      areaEl.value = newText;
      popValue(areaEl);
    }
  }
  updateLiveBoxes();
}

function updateLiveBoxes() {
  const area = parseFloat(liveAreaEl().value) || 0;

  const actualBoxesDiv = document.getElementById('actual-boxes-display');
  const finalBoxesDiv  = document.getElementById('final-boxes-input-group');
  const liveBoxesEl    = document.getElementById('live-actual-boxes');
  const finalBoxesEl   = document.getElementById('final-boxes');

  if (selectedTile && area > 0) {
    // actualBoxesDiv hidden by design
    if (finalBoxesDiv) finalBoxesDiv.style.display  = 'flex';
    
    const boxesExact = area / selectedTile.coverage;
    const newText = boxesExact.toFixed(2) + ' boxes';
    if (liveBoxesEl && liveBoxesEl.textContent !== newText) {
      liveBoxesEl.textContent = newText;
      popValue(liveBoxesEl);
    }
    if (finalBoxesEl) finalBoxesEl.value = Math.ceil(boxesExact);
    
    // Show actual decimal in the label hint
    const hint = document.getElementById('actual-boxes-hint');
    if (hint) hint.textContent = `(actual: ${boxesExact.toFixed(2)})`;
  } else {
    if (actualBoxesDiv) actualBoxesDiv.style.display = 'none';
    if (finalBoxesDiv) finalBoxesDiv.style.display  = 'none';
    if (liveBoxesEl) liveBoxesEl.textContent = '–';
    if (finalBoxesEl) finalBoxesEl.value = '';
    const hint = document.getElementById('actual-boxes-hint');
    if (hint) hint.textContent = '';
  }
}

// ─── Tile Search / Dropdown ─────────────────────────────────────
function onTileSearch() {
  const q = tileSearchEl().value.trim().toLowerCase();
  if (!q) {
    // Show all when empty
    filteredTiles = [...TILE_DB];
  } else {
    filteredTiles = TILE_DB.filter(t => t.name.toLowerCase().includes(q));
  }
  highlightedIdx = -1;
  renderDropdown();
}

function renderDropdown() {
  const dd = tileDropEl();
  if (filteredTiles.length === 0) {
    dd.innerHTML = `<div style="padding:0.7rem 1rem;font-size:0.82rem;color:var(--text3);">No tiles found</div>`;
    dd.classList.add('open');
    return;
  }
  dd.innerHTML = filteredTiles.slice(0, 500).map((t, i) => `
    <div class="tile-option ${i === highlightedIdx ? 'highlighted' : ''}" data-idx="${i}" style="padding: 0.6rem 0.9rem; cursor: pointer; display: flex; justify-content: space-between; align-items: center; gap: 0.5rem;">
      <span class="tile-option-name" style="font-size:0.83rem; color:var(--text); flex:1; text-align: left;">${t.name}</span>
      <span class="tile-option-badges" style="display:flex; gap:0.3rem; flex-shrink:0;">
        <span class="tile-option-badge cov" style="font-size:0.68rem; padding:0.15rem 0.4rem; border-radius:4px; font-weight:600; background:rgba(6,182,212,0.2); color:#67e8f9;">${t.coverage} sqft</span>
        <span class="tile-option-badge wt" style="font-size:0.68rem; padding:0.15rem 0.4rem; border-radius:4px; font-weight:600; background:rgba(16,185,129,0.2); color:#6ee7b7;">${t.weight} kg</span>
      </span>
    </div>
  `).join('');
  dd.classList.add('open');
}

function closeTileDropdown() {
  tileDropEl().classList.remove('open');
  tileDropEl().innerHTML = '';
  filteredTiles = [];
  highlightedIdx = -1;
}

function scrollHighlightedIntoView() {
  const dd = tileDropEl();
  const highlighted = dd.querySelector('.tile-option.highlighted');
  if (highlighted) {
    const ddRect = dd.getBoundingClientRect();
    const elemRect = highlighted.getBoundingClientRect();
    if (elemRect.bottom > ddRect.bottom) {
      dd.scrollTop += elemRect.bottom - ddRect.bottom;
    } else if (elemRect.top < ddRect.top) {
      dd.scrollTop -= ddRect.top - elemRect.top;
    }
  }
}

function onTileKeyNav(e) {
  if (!tileDropEl().classList.contains('open')) return;
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    highlightedIdx = Math.min(highlightedIdx + 1, filteredTiles.length - 1);
    renderDropdown();
    scrollHighlightedIntoView();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    highlightedIdx = Math.max(highlightedIdx - 1, 0);
    renderDropdown();
    scrollHighlightedIntoView();
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (highlightedIdx >= 0) selectTile(highlightedIdx);
  } else if (e.key === 'Escape') {
    closeTileDropdown();
  }
}

function selectTile(idx) {
  if (idx < 0 || idx >= filteredTiles.length) return;
  const tile = filteredTiles[idx];
  if (!tile) return;
  selectedTile = tile;
  tileSearchEl().value = tile.name;
  closeTileDropdown();

  // Update tile info (hidden by design, but keep data updated for internal use)
  document.getElementById('selected-tile-coverage').value = tile.coverage;
  document.getElementById('info-coverage').textContent = `📐 ${tile.coverage} sqft/box`;
  document.getElementById('info-weight').textContent   = `⚖️ ${tile.weight} kg/box`;
  updateLiveBoxes();
}

// ─── Add Room ───────────────────────────────────────────────────
function addRoom() {
  const name   = roomNameEl().value.trim();
  const length = parseFloat(roomLengthEl().value) || 0;
  const breadth= parseFloat(roomBreadthEl().value) || 0;
  const finalBoxes = parseInt(document.getElementById('final-boxes').value, 10);
  
  const manualArea = parseFloat(liveAreaEl().value) || 0;
  const area = manualArea > 0 ? manualArea : (length * breadth);

  // Validation
  if (!name) { shake(roomNameEl()); roomNameEl().focus(); return; }
  if (area <= 0) { 
    shake(liveAreaEl()); 
    liveAreaEl().focus(); 
    return; 
  }
  if (!selectedTile) { shake(tileSearchEl()); tileSearchEl().focus(); return; }
  if (isNaN(finalBoxes) || finalBoxes <= 0) { 
    shake(document.getElementById('final-boxes')); 
    document.getElementById('final-boxes').focus(); 
    return; 
  }

  const boxesExact = area / selectedTile.coverage;
  const totalWeight = finalBoxes * selectedTile.weight;

  rooms.push({
    id: nextId++,
    name, length, breadth, area,
    tileName: selectedTile.name,
    coverage: selectedTile.coverage,
    weight: selectedTile.weight,
    boxesExact, 
    boxesFinal: finalBoxes, 
    totalWeight
  });
  lastAddedRoomId = rooms[rooms.length - 1].id;

  // Clear form
  roomNameEl().value   = '';
  roomLengthEl().value = '';
  roomBreadthEl().value= '';
  liveAreaEl().value   = '';
  tileSearchEl().value = '';
  selectedTile = null;
  document.getElementById('tile-info-display').style.display = 'none';
  document.getElementById('actual-boxes-display').style.display = 'none';
  document.getElementById('final-boxes-input-group').style.display = 'none';
  closeTileDropdown();

  renderTable();
  renderSummary();
  roomNameEl().focus();
}

// ─── Delete Room ────────────────────────────────────────────────
function deleteRoom(id) {
  const idx = rooms.findIndex(r => r.id === id);
  if (idx >= 0) {
    const row = document.getElementById(`row-${id}`);
    if (row) {
      row.classList.add('row-exit');
      setTimeout(() => {
        rooms.splice(idx, 1);
        renderTable();
        renderSummary();
      }, 250);
      return;
    }
  }
}

// ─── Render Table ───────────────────────────────────────────────
function renderTable() {
  const tbody = planTbody();
  const empty = emptyState();
  const badge = document.getElementById('room-count-badge');
  const countEl = document.getElementById('room-count');

  if (rooms.length === 0) {
    tbody.innerHTML = '';
    empty.style.display = 'block';
    badge.style.display = 'none';
    return;
  }

  empty.style.display = 'none';
  badge.style.display = 'flex';
  countEl.textContent = rooms.length;
  badge.classList.remove('badge-pop');
  void badge.offsetWidth;
  badge.classList.add('badge-pop');

  tbody.innerHTML = rooms.map((r, i) => {
    const isNew = r.id === lastAddedRoomId;
    const animClass = isNew ? 'row-enter' : '';
    const style = isNew ? ` style="animation-delay:${Math.min(i * 0.04, 0.2)}s"` : '';
    return `
    <tr id="row-${r.id}" class="${animClass}"${style}>
      <td class="td-si">${i + 1}</td>
      <td class="td-room">${escHtml(r.name)}</td>
      <td class="td-size">${(r.length > 0 && r.breadth > 0) ? `${r.length} × ${r.breadth}` : ''}</td>
      <td class="td-area">${r.area.toFixed(2)}</td>
      <td class="td-tile"><span class="td-tile-name" title="${escHtml(r.tileName)}">${escHtml(r.tileName)}</span></td>


      <td class="td-final">
        <input type="number" class="table-input-boxes" value="${r.boxesFinal}" min="1" step="1" onchange="updateRoomBoxes(${r.id}, this.value)" />
      </td>
      <td class="td-wt">${r.weight}</td>
      <td class="td-total-wt">${r.totalWeight}</td>
      <td>
        <button class="btn-icon-del" onclick="deleteRoom(${r.id})" title="Delete room">
          <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>
        </button>
      </td>
    </tr>`;
  }).join('');
  lastAddedRoomId = null;
}

function updateRoomBoxes(id, newVal) {
  const val = parseInt(newVal, 10);
  if (isNaN(val) || val <= 0) return;
  const room = rooms.find(r => r.id === id);
  if (room) {
    room.boxesFinal = val;
    room.totalWeight = room.boxesFinal * room.weight;
    renderTable();
    renderSummary();
  }
}

// ─── Render Summary ─────────────────────────────────────────────
function renderSummary() {
  const ss = summarySection();
  if (rooms.length === 0) {
    ss.style.display = 'none';
    return;
  }
  ss.style.display = 'flex';

  const totalBoxes  = rooms.reduce((s, r) => s + r.boxesFinal, 0);
  const totalWeight = rooms.reduce((s, r) => s + r.totalWeight, 0);
  
  // Calculate total area excluding accessories/pastes
  let totalArea = 0;
  let totalPasteArea = 0;
  
  rooms.forEach(r => {
    const dbTile = TILE_DB.find(t => t.name === r.tileName);
    const isAccessoryFlag = dbTile ? dbTile.isAccessory : false;
    
    // Fallback heuristic for existing items added before the checkbox feature
    const n = r.tileName.toUpperCase();
    const isAccessoryHeuristic = n.includes('PASTE') || n.includes('ADHESIVE') || n.includes('EPOXY') || n.includes('GROUT') || n.includes('SPACER') || n.includes('KAG GOLD 20 KG') || n.includes('KAG DIAMOND 20 KG');
    
    const isAccessory = isAccessoryFlag || isAccessoryHeuristic;
    if (isAccessory) {
      totalPasteArea += r.area;
    } else {
      totalArea += r.area;
    }
  });

  setSummaryValue('total-boxes', String(totalBoxes));
  setSummaryValue('total-weight', totalWeight + ' kg');
  setSummaryValue('total-area', totalArea.toFixed(2) + ' sqft');
  setSummaryValue('total-paste-area', totalPasteArea.toFixed(2) + ' sqft');
  setSummaryValue('total-rooms', String(rooms.length));
  
  const pasteCard = document.getElementById('summary-paste-card');
  if (pasteCard) {
    pasteCard.style.display = totalPasteArea > 0 ? 'flex' : 'none';
  }

  // Tile-wise summary
  const tileMap = {};
  rooms.forEach(r => {
    if (!tileMap[r.tileName]) tileMap[r.tileName] = { boxes: 0, weight: 0 };
    tileMap[r.tileName].boxes  += r.boxesFinal;
    tileMap[r.tileName].weight += r.totalWeight;
  });

  const tileEntries = Object.entries(tileMap).sort((a,b) => b[1].boxes - a[1].boxes);

  document.getElementById('tile-summary-content').innerHTML = `
    <div class="tile-summary-grid">
      ${tileEntries.map(([name, data], idx) => `
        <div class="tile-summary-item" style="animation-delay:${idx * 0.06}s">
          <span class="tile-summary-name">${escHtml(name)}</span>
          <span class="tile-summary-stats">
            <span class="tile-stat-badge tile-stat-boxes">📦 ${data.boxes} boxes</span>
            <span class="tile-stat-badge tile-stat-weight">⚖️ ${data.weight} kg</span>
          </span>
        </div>
      `).join('')}
    </div>
  `;
}

// ─── Print ──────────────────────────────────────────────────────
function printPlan() {
  if (rooms.length === 0) {
    alert('Please add at least one room before printing!');
    return;
  }

  const custName  = document.getElementById('customer-name').value  || '–';
  const custPhone = document.getElementById('customer-phone').value || '–';
  const planDate  = document.getElementById('plan-date').value      || '–';
  const planNotes = document.getElementById('plan-notes').value     || '–';

  // Customer info
  document.getElementById('print-customer-info').innerHTML = `
    <div class="print-info-item"><label>Customer Name</label><br><span>${escHtml(custName)}</span></div>
    <div class="print-info-item"><label>Phone</label><br><span>${escHtml(custPhone)}</span></div>
    <div class="print-info-item"><label>Date</label><br><span>${escHtml(planDate)}</span></div>
    <div class="print-info-item"><label>Notes</label><br><span>${escHtml(planNotes)}</span></div>
  `;

  // Print table
  document.getElementById('print-tbody').innerHTML = rooms.map((r, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${escHtml(r.name)}</td>
      <td>${(r.length > 0 && r.breadth > 0) ? `${r.length} × ${r.breadth}` : ''}</td>
      <td>${r.area.toFixed(2)}</td>
      <td>${escHtml(r.tileName)}</td>


      <td class="final-boxes-cell">${r.boxesFinal}</td>
      <td>${r.weight}</td>
      <td class="total-wt-cell">${r.totalWeight}</td>
    </tr>
  `).join('');

  // Summary
  const totalBoxes  = rooms.reduce((s, r) => s + r.boxesFinal, 0);
  const totalWeight = rooms.reduce((s, r) => s + r.totalWeight, 0);
  let totalArea = 0;
  let totalPasteArea = 0;
  rooms.forEach(r => {
    const dbTile = TILE_DB.find(t => t.name === r.tileName);
    const isAccessoryFlag = dbTile ? dbTile.isAccessory : false;
    const n = r.tileName.toUpperCase();
    const isAccessoryHeuristic = n.includes('PASTE') || n.includes('ADHESIVE') || n.includes('EPOXY') || n.includes('GROUT') || n.includes('SPACER') || n.includes('KAG GOLD 20 KG') || n.includes('KAG DIAMOND 20 KG');
    const isAccessory = isAccessoryFlag || isAccessoryHeuristic;
    if (isAccessory) totalPasteArea += r.area;
    else totalArea += r.area;
  });

  let summaryHTML = `
    <div class="print-summary-box"><div class="print-summary-label">Total Rooms</div><div class="print-summary-value">${rooms.length}</div></div>
    <div class="print-summary-box"><div class="print-summary-label">Total Tile Area</div><div class="print-summary-value">${totalArea.toFixed(0)} sqft</div></div>
    <div class="print-summary-box"><div class="print-summary-label">Total Boxes</div><div class="print-summary-value">${totalBoxes}</div></div>
    <div class="print-summary-box"><div class="print-summary-label">Total Weight</div><div class="print-summary-value">${totalWeight} kg</div></div>
  `;
  
  if (totalPasteArea > 0) {
    summaryHTML += `<div class="print-summary-box"><div class="print-summary-label">Adhesive Area</div><div class="print-summary-value">${totalPasteArea.toFixed(0)} sqft</div></div>`;
  }
  
  document.getElementById('print-summary').innerHTML = summaryHTML;

  // Tile-wise summary
  const tileMap = {};
  rooms.forEach(r => {
    if (!tileMap[r.tileName]) tileMap[r.tileName] = { boxes: 0, weight: 0 };
    tileMap[r.tileName].boxes  += r.boxesFinal;
    tileMap[r.tileName].weight += r.totalWeight;
  });
  const tileEntries = Object.entries(tileMap).sort((a,b) => b[1].boxes - a[1].boxes);

  document.getElementById('print-tile-summary').innerHTML = `
    <div class="print-tile-summary-title">Tile-wise Summary</div>
    <div class="print-tile-grid">
      ${tileEntries.map(([name, data]) => `
        <div class="print-tile-item">
          <span class="print-tile-item-name">${escHtml(name)}</span>
          <span class="print-tile-item-boxes">${data.boxes} boxes</span>
          &nbsp;
          <span class="print-tile-item-wt">${data.weight} kg</span>
        </div>
      `).join('')}
    </div>
  `;

  requestAnimationFrame(() => {
    requestAnimationFrame(() => window.print());
  });
}

// ─── Clear All ──────────────────────────────────────────────────
function clearAll() {
  if (rooms.length === 0 && !activeEstimateId) return;
  if (!confirm('Clear all planner data? This cannot be undone.')) return;
  
  rooms = [];
  quotationItems = [];
  nextId = 1;
  activeEstimateId = null;
  
  document.getElementById('customer-name').value = '';
  document.getElementById('customer-phone').value = '';
  document.getElementById('plan-notes').value = '';
  
  const quoteCustNameEl = document.getElementById('quote-customer-name');
  if (quoteCustNameEl) quoteCustNameEl.value = '';
  
  const quoteByEl = document.getElementById('quote-by');
  if (quoteByEl) quoteByEl.value = '';
  
  renderTable();
  renderSummary();
  if (typeof renderQuotation === 'function') renderQuotation();
  updateActiveEstimateStatus();
}

// ─── Share WhatsApp ─────────────────────────────────────────────
function shareWhatsApp() {
  if (rooms.length === 0) {
    alert('Please add at least one room before sharing!');
    return;
  }

  const custName  = document.getElementById('customer-name').value.trim()  || 'Customer';
  const custPhone = document.getElementById('customer-phone').value.trim() || '';
  const planDate  = document.getElementById('plan-date').value      || '';
  const planNotes = document.getElementById('plan-notes').value.trim()     || '';

  // 1. Build message text
  let msg = `*AG TRADERS - TILE ESTIMATE*\n`;
  msg += `----------------------------------------\n`;
  msg += `• *Customer:* ${custName}\n`;
  if (custPhone) msg += `• *Phone:* ${custPhone}\n`;
  if (planDate)  msg += `• *Date:* ${planDate}\n`;
  if (planNotes) msg += `• *Notes:* ${planNotes}\n`;
  msg += `\n*ROOM LIST:*\n`;

  rooms.forEach((r, i) => {
    msg += `${i + 1}. *${r.name}* (${r.length}×${r.breadth} = ${r.area.toFixed(0)} sqft)\n`;
    msg += `   - Tile: _${r.tileName}_\n`;
    msg += `   - Coverage: ${r.coverage} sqft/box\n`;
    msg += `   - Exact Boxes: ${r.boxesExact.toFixed(2)}\n`;
    msg += `   - *Final Boxes: ${r.boxesFinal}*\n`;
    msg += `   - Weight: ${r.totalWeight} kg\n\n`;
  });

  const totalBoxes  = rooms.reduce((s, r) => s + r.boxesFinal, 0);
  const totalWeight = rooms.reduce((s, r) => s + r.totalWeight, 0);
  const totalArea   = rooms.reduce((s, r) => s + r.area, 0);

  msg += `*ORDER SUMMARY:*\n`;
  msg += `• Total Rooms: ${rooms.length}\n`;
  msg += `• Total Area: ${totalArea.toFixed(0)} sqft\n`;
  msg += `• *Total Boxes: ${totalBoxes} boxes*\n`;
  msg += `• *Total Weight: ${totalWeight} kg*\n\n`;

  // Tile-wise summary
  const tileMap = {};
  rooms.forEach(r => {
    if (!tileMap[r.tileName]) tileMap[r.tileName] = { boxes: 0, weight: 0 };
    tileMap[r.tileName].boxes  += r.boxesFinal;
    tileMap[r.tileName].weight += r.totalWeight;
  });
  const tileEntries = Object.entries(tileMap).sort((a,b) => b[1].boxes - a[1].boxes);

  msg += `*TILE-WISE BREAKDOWN:*\n`;
  tileEntries.forEach(([name, data]) => {
    msg += `• _${name}_: *${data.boxes} boxes* (${data.weight} kg)\n`;
  });

  msg += `\n_Thank you for planning with AG TRADERS, Tiruchengode!_`;

  // 2. Encode message
  const encodedText = encodeURIComponent(msg);
  
  // 3. Open WhatsApp link
  let url = '';
  let cleanPhone = custPhone.replace(/\D/g, '');
  if (cleanPhone) {
    if (cleanPhone.length === 10) {
      cleanPhone = '91' + cleanPhone;
    }
    url = `https://wa.me/${cleanPhone}?text=${encodedText}`;
  } else {
    url = `https://api.whatsapp.com/send?text=${encodedText}`;
  }

  window.open(url, '_blank');
}

// ─── Helpers ────────────────────────────────────────────────────
function capitalizeWords(str) {
  if (!str) return '';
  return str.split(' ').map(word => {
    if (!word) return '';
    return word.charAt(0).toUpperCase() + word.slice(1);
  }).join(' ');
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function shake(el) {
  el.classList.remove('shake-anim');
  void el.offsetWidth;
  el.classList.add('shake-anim');
  setTimeout(() => el.classList.remove('shake-anim'), 400);
}

// ─── Quotation Management ───────────────────────────────────────
function switchTabWithAuth(tabName) {
  if (tabName === 'catalog') {
    const code = prompt("Enter Admin Passcode to manage products:");
    if (code !== "admin123") { 
      alert("Incorrect passcode! Access denied.");
      return;
    }
  }
  switchTab(tabName);
}

function openSettingsWithAuth() {
  const code = prompt("Enter Admin Passcode to open settings:");
  if (code !== "admin123") { 
    alert("Incorrect passcode! Access denied.");
    return;
  }
  document.getElementById('settings-modal').showModal();
}

function switchTab(tabName) {
  currentTab = tabName;
  const plannerTabBtn = document.getElementById('tab-planner');
  const quotationTabBtn = document.getElementById('tab-quotation');
  const catalogTabBtn = document.getElementById('tab-catalog');

  const plannerView = document.getElementById('planner-view');
  const quotationView = document.getElementById('quotation-view');
  const catalogView = document.getElementById('catalog-view');

  const activeView = tabName === 'planner' ? plannerView
    : tabName === 'catalog' ? catalogView
    : quotationView;

  plannerTabBtn.classList.remove('active');
  quotationTabBtn.classList.remove('active');
  if (catalogTabBtn) catalogTabBtn.classList.remove('active');

  if (tabName === 'planner') plannerTabBtn.classList.add('active');
  else if (tabName === 'catalog' && catalogTabBtn) catalogTabBtn.classList.add('active');
  else quotationTabBtn.classList.add('active');

  document.body.classList.remove('print-quote-mode');
  if (tabName === 'quotation') document.body.classList.add('print-quote-mode');

  [plannerView, quotationView, catalogView].forEach(v => {
    if (v && v !== activeView) hideViewPanel(v);
  });
  showViewPanel(activeView);

  if (tabName === 'catalog') renderCatalogTable();
  if (tabName === 'quotation') generateQuotationFromPlan();
}

function generateQuotationFromPlan() {
  const tileMap = {};
  rooms.forEach(r => {
    if (!tileMap[r.tileName]) {
      const dbTile = TILE_DB.find(t => t.name === r.tileName);
      const rate = dbTile ? (dbTile.price || 0) : 0;
      const coverage = dbTile ? (dbTile.coverage || 0) : 0;
      const sqftRate = dbTile ? (dbTile.sqftPrice || dbTile.sqftRate || 0) : 0;
      const unit = dbTile ? (dbTile.unit || 'Boxes') : 'Boxes';
      tileMap[r.tileName] = {
        description: r.tileName,
        quantity: 0,
        rate: rate,
        coverage: coverage,
        sqftRate: sqftRate,
        unit: unit
      };
    }
    tileMap[r.tileName].quantity += r.boxesFinal;
  });
  
  const customItems = quotationItems.filter(item => item.isCustom);
  
  let newItems = Object.values(tileMap).map(item => {
    let sqftRate = item.sqftRate;
    let rate = item.rate;
    // If we have coverage but sqftRate is missing, compute it
    if (item.coverage > 0) {
      if (!sqftRate && rate > 0) {
        sqftRate = Math.round((rate / item.coverage) * 100) / 100;
      } else if (sqftRate > 0 && !rate) {
        rate = Math.round((sqftRate * item.coverage) * 100) / 100;
      }
    }
    return {
      description: item.description,
      quantity: item.quantity,
      rate: rate,
      sqftRate: sqftRate,
      coverage: item.coverage,
      amount: item.quantity * rate,
      isCustom: false,
      unit: item.unit
    };
  });
  
  quotationItems = [...newItems, ...customItems];
  
  renderQuotation();
}

function renderQuotation() {
  const tbody = document.getElementById('quotation-tbody');
  const custName = document.getElementById('customer-name').value || '';
  
  const quoteCustName = document.getElementById('quote-customer-name');
  if (quoteCustName) {
    quoteCustName.value = custName;
  }
  
  tbody.innerHTML = quotationItems.map((item, idx) => {
    const hasCoverage = item.coverage && item.coverage > 0;
    const sqftRateVal = hasCoverage ? (item.sqftRate || 0) : '';
    const sqftDisabled = hasCoverage ? '' : 'disabled';
    const amountVal = (item.quantity * item.rate) || 0;
    
    const unitHTML = item.isCustom ? 
      `<input type="text" class="quote-input-unit" value="${escHtml(item.unit || 'Nos')}" oninput="handleQuoteInput(${idx}, 'unit', this.value)" style="width: 50px; font-size: 0.85rem !important; padding: 0.35rem 0.5rem !important; text-align: left; background: rgba(255,255,255,0.02) !important; border: 1px solid rgba(255,255,255,0.08) !important; color: var(--text); border-radius: var(--radius-sm);" />` :
      `<span style="font-size: 0.9rem; color: var(--text2); width: 50px; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escHtml(item.unit || 'Boxes')}">${escHtml(item.unit || 'Boxes')}</span>`;
    
    return `
      <tr data-idx="${idx}">
        <td class="td-si">${idx + 1}</td>
        <td style="position: relative;">
          <input type="text" class="quote-input-desc" value="${escHtml(item.description)}" oninput="handleQuoteInput(${idx}, 'description', this.value); filterQuoteDropdown(${idx}, this.value)" onfocus="openQuoteDropdown(${idx}, this.value)" onblur="closeQuoteDropdownDelayed(${idx})" onkeydown="handleQuoteDescKeydown(event, ${idx})" autocomplete="off" />
          <div class="tile-dropdown quote-tile-dropdown" id="quote-dropdown-${idx}"></div>
        </td>
        <td>
          <div style="display: inline-flex; align-items: center; gap: 0.5rem; justify-content: center; width: 100%;">
            <div class="stepper-wrapper">
              <button type="button" class="stepper-btn" onclick="stepNumberInput(this, -1)">−</button>
              <input type="number" class="quote-input-qty" value="${item.quantity}" min="0" step="1" oninput="handleQuoteInput(${idx}, 'quantity', this.value)" />
              <button type="button" class="stepper-btn" onclick="stepNumberInput(this, 1)">+</button>
            </div>
            ${unitHTML}
          </div>
        </td>
        <td>
          <div class="stepper-wrapper">
            <button type="button" class="stepper-btn" ${sqftDisabled} onclick="stepNumberInput(this, -1)">−</button>
            <input type="number" class="quote-input-sqft-rate" value="${sqftRateVal}" min="0" step="1" ${sqftDisabled} oninput="handleQuoteInput(${idx}, 'sqftRate', this.value)" placeholder="--" />
            <button type="button" class="stepper-btn" ${sqftDisabled} onclick="stepNumberInput(this, 1)">+</button>
          </div>
        </td>
        <td>
          <div class="stepper-wrapper">
            <button type="button" class="stepper-btn" onclick="stepNumberInput(this, -1)">−</button>
            <input type="number" class="quote-input-rate" value="${item.rate}" min="0" step="1" oninput="handleQuoteInput(${idx}, 'rate', this.value)" />
            <button type="button" class="stepper-btn" onclick="stepNumberInput(this, 1)">+</button>
          </div>
        </td>
        <td class="td-amount">
          ₹ ${amountVal.toFixed(2)}
        </td>
        <td class="td-action no-print">
          <button class="btn-icon-del" onclick="deleteQuotationRow(${idx})" title="Delete row">
            <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>
          </button>
        </td>
      </tr>
    `;
  }).join('');
  
  calculateQuotationTotals();
}

function handleQuoteInput(idx, field, val) {
  if (idx < 0 || idx >= quotationItems.length) return;
  const item = quotationItems[idx];
  
  const tr = document.querySelector(`#quotation-tbody tr[data-idx="${idx}"]`);
  if (!tr) return;
  
  if (field === 'description') {
    item.description = val;
  } else if (field === 'quantity') {
    item.quantity = parseFloat(val) || 0;
    item.amount = item.quantity * item.rate;
    const amountCell = tr.querySelector('.td-amount');
    if (amountCell) amountCell.textContent = '₹ ' + item.amount.toFixed(2);
  } else if (field === 'unit') {
    item.unit = val;
  } else if (field === 'sqftRate') {
    item.sqftRate = parseFloat(val) || 0;
    // Use billingArea if available, otherwise fall back to coverage
    const multiplier = (item.billingArea > 0) ? item.billingArea : item.coverage;
    if (multiplier > 0) {
      item.rate = Math.round((item.sqftRate * multiplier) * 100) / 100;
      const rateInput = tr.querySelector('.quote-input-rate');
      if (rateInput) rateInput.value = item.rate;
    }
    item.amount = item.quantity * item.rate;
    const amountCell = tr.querySelector('.td-amount');
    if (amountCell) amountCell.textContent = '₹ ' + item.amount.toFixed(2);
  } else if (field === 'rate') {
    item.rate = parseFloat(val) || 0;
    if (item.coverage > 0) {
      item.sqftRate = Math.round((item.rate / item.coverage) * 100) / 100;
      const sqftInput = tr.querySelector('.quote-input-sqft-rate');
      if (sqftInput) sqftInput.value = item.sqftRate;
    }
    item.amount = item.quantity * item.rate;
    const amountCell = tr.querySelector('.td-amount');
    if (amountCell) amountCell.textContent = '₹ ' + item.amount.toFixed(2);
  }
  
  calculateQuotationTotals();
}

function handleQuoteChange(idx, field, val) {
  if (idx < 0 || idx >= quotationItems.length) return;
  const item = quotationItems[idx];
  
  if (field === 'description') {
    item.description = val;
    const dbTile = TILE_DB.find(t => t.name.toLowerCase() === val.trim().toLowerCase());
    if (dbTile) {
      item.coverage = dbTile.coverage || 0;
      item.billingArea = dbTile.billingArea || 0;
      item.sqftRate = dbTile.sqftPrice || dbTile.sqftRate || 0;
      item.unit = dbTile.unit || 'Boxes';
      
      // Rate = billingArea * sqftRate (new formula)
      // Fallback: if no billingArea, use coverage * sqftRate or stored price
      const multiplier = (item.billingArea > 0) ? item.billingArea : item.coverage;
      if (item.sqftRate > 0 && multiplier > 0) {
        item.rate = Math.round((item.sqftRate * multiplier) * 100) / 100;
      } else {
        item.rate = dbTile.price || 0;
      }
      
      item.amount = item.quantity * item.rate;
      renderQuotation();
    } else {
      if (!item.isCustom) {
        item.isCustom = true;
        item.coverage = 0;
        item.sqftRate = 0;
        item.unit = 'Nos';
        renderQuotation();
      }
    }
  }
}

function addQuotationRow() {
  quotationItems.push({
    description: '',
    quantity: 1,
    rate: 0,
    sqftRate: 0,
    coverage: 0,
    billingArea: 0,
    amount: 0,
    isCustom: true,
    unit: 'Nos'
  });
  renderQuotation();
}

function deleteQuotationRow(idx) {
  if (idx < 0 || idx >= quotationItems.length) return;
  quotationItems.splice(idx, 1);
  renderQuotation();
}

function calculateQuotationTotals() {
  const grandTotal = quotationItems.reduce((sum, item) => sum + item.amount, 0);
  document.getElementById('quotation-grand-total').textContent = '₹ ' + grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  
  const words = numberToWordsINR(Math.round(grandTotal));
  document.getElementById('quotation-amount-words').textContent = words;
}

function printQuotation() {
  if (quotationItems.length === 0) {
    alert('No items in quotation to print!');
    return;
  }
  
  const custName = document.getElementById('quote-customer-name').value || '–';
  const quoteNo  = document.getElementById('quote-number').value || '–';
  const quoteDate= document.getElementById('quote-date').value || '–';
  const quoteBy  = document.getElementById('quote-by').value || '–';
  
  document.getElementById('print-quote-customer').textContent = custName;
  document.getElementById('print-quote-number').textContent = quoteNo;
  document.getElementById('print-quote-date').textContent = quoteDate;
  document.getElementById('print-quote-by').textContent = quoteBy;
  
  document.getElementById('print-quote-tbody').innerHTML = quotationItems.map((item, idx) => {
    const hasCoverage = item.coverage && item.coverage > 0;
    const sqftRateVal = hasCoverage ? ('₹ ' + item.sqftRate.toFixed(2)) : '–';
    const unitText = item.unit || 'Boxes';
    return `
      <tr>
        <td>${idx + 1}</td>
        <td>${escHtml(item.description)}</td>
        <td>${item.quantity} <span style="font-size: 0.85em; color: #555; font-weight: 500; margin-left: 2px;">${escHtml(unitText)}</span></td>
        <td>${sqftRateVal}</td>
        <td>₹ ${item.rate.toFixed(2)}</td>
        <td>₹ ${(item.quantity * item.rate).toFixed(2)}</td>
      </tr>
    `;
  }).join('');
  
  const grandTotal = quotationItems.reduce((sum, item) => sum + item.amount, 0);
  document.getElementById('print-quote-grand-total').textContent = '₹ ' + grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  document.getElementById('print-quote-amount-words').textContent = numberToWordsINR(Math.round(grandTotal));
  
  requestAnimationFrame(() => {
    requestAnimationFrame(() => window.print());
  });
}

function numberToWordsINR(num) {
  if (num === 0) return 'Zero Rupees Only';
  const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function numToWords(n, suffix) {
    let str = '';
    if (n > 19) {
      str += b[Math.floor(n / 10)] + ' ' + a[n % 10];
    } else {
      str += a[n];
    }
    if (n) {
      str += suffix;
    }
    return str;
  }

  let words = '';
  words += numToWords(Math.floor(num / 10000000), 'Crore ');
  words += numToWords(Math.floor((num / 100000) % 100), 'Lakh ');
  words += numToWords(Math.floor((num / 1000) % 100), 'Thousand ');
  words += numToWords(Math.floor((num / 100) % 10), 'Hundred ');
  let rest = Math.floor(num % 100);
  if (num > 100 && rest > 0) {
    words += 'and ';
  }
  words += numToWords(rest, '');
  
  return words.trim() + ' Rupees Only';
}

function stepNumberInput(btn, direction) {
  const wrapper = btn.closest('.stepper-wrapper');
  if (!wrapper) return;
  const input = wrapper.querySelector('input[type="number"]');
  if (!input || input.disabled) return;
  
  const step = parseFloat(input.getAttribute('step')) || 1;
  const min = input.hasAttribute('min') ? parseFloat(input.getAttribute('min')) : -Infinity;
  const max = input.hasAttribute('max') ? parseFloat(input.getAttribute('max')) : Infinity;
  
  let val = parseFloat(input.value) || 0;
  val = val + direction * step;
  
  if (val < min) val = min;
  if (val > max) val = max;
  
  // Round to 2 decimal places to avoid float issues
  val = Math.round(val * 100) / 100;
  
  input.value = val;
  // Trigger input event to run our dynamic calculations!
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

// State for quotation description autocomplete dropdowns
let activeQuoteDropdownIdx = -1;
let filteredQuoteTiles = [];
let highlightedQuoteTileIdx = -1;

function openQuoteDropdown(idx, q) {
  activeQuoteDropdownIdx = idx;
  const val = q.trim().toLowerCase();
  if (!val) {
    filteredQuoteTiles = [...TILE_DB];
  } else {
    filteredQuoteTiles = TILE_DB.filter(t => t.name.toLowerCase().includes(val));
  }
  highlightedQuoteTileIdx = -1;
  renderQuoteDropdown(idx);
}

function filterQuoteDropdown(idx, q) {
  activeQuoteDropdownIdx = idx;
  const val = q.trim().toLowerCase();
  if (!val) {
    filteredQuoteTiles = [...TILE_DB];
  } else {
    filteredQuoteTiles = TILE_DB.filter(t => t.name.toLowerCase().includes(val));
  }
  renderQuoteDropdown(idx);
}

function renderQuoteDropdown(idx) {
  const dd = document.getElementById(`quote-dropdown-${idx}`);
  if (!dd) return;
  
  if (filteredQuoteTiles.length === 0) {
    dd.innerHTML = `<div style="padding:0.7rem 1rem;font-size:0.82rem;color:var(--text3);background:#1a1a30;">No tiles found</div>`;
    dd.classList.add('open');
    return;
  }
  
  dd.innerHTML = filteredQuoteTiles.slice(0, 15).map((t, i) => `
    <div class="tile-option ${i === highlightedQuoteTileIdx ? 'highlighted' : ''}" 
         onmousedown="selectQuoteTile(${idx}, ${i})"
         style="padding: 0.6rem 0.9rem; cursor: pointer; display: flex; justify-content: space-between; align-items: center; gap: 0.5rem;">
      <span class="tile-option-name" style="font-size:0.83rem; color:var(--text); flex:1; text-align: left;">${t.name}</span>
      <span class="tile-option-badges" style="display:flex; gap:0.3rem; flex-shrink:0;">
        <span class="tile-option-badge cov" style="font-size:0.68rem; padding:0.15rem 0.4rem; border-radius:4px; font-weight:600; background:rgba(6,182,212,0.2); color:#67e8f9;">${t.coverage} sqft</span>
        <span class="tile-option-badge wt" style="font-size:0.68rem; padding:0.15rem 0.4rem; border-radius:4px; font-weight:600; background:rgba(16,185,129,0.2); color:#6ee7b7;">${t.weight} kg</span>
      </span>
    </div>
  `).join('');
  dd.classList.add('open');
}

function selectQuoteTile(idx, tileOptionIdx) {
  const tile = filteredQuoteTiles[tileOptionIdx];
  if (!tile || idx < 0 || idx >= quotationItems.length) return;
  
  const item = quotationItems[idx];
  item.description = tile.name;
  item.coverage = tile.coverage || 0;
  item.rate = tile.price || 0;
  item.sqftRate = tile.sqftPrice || tile.sqftRate || 0;
  item.unit = tile.unit || 'Boxes';
  item.isCustom = false;
  
  if (item.coverage > 0) {
    if (!item.sqftRate && item.rate > 0) {
      item.sqftRate = Math.round((item.rate / item.coverage) * 100) / 100;
    } else if (item.sqftRate > 0 && !item.rate) {
      item.rate = Math.round((item.sqftRate * item.coverage) * 100) / 100;
    }
  }
  
  item.amount = item.quantity * item.rate;
  
  renderQuotation();
}

function closeQuoteDropdownDelayed(idx) {
  setTimeout(() => {
    const dd = document.getElementById(`quote-dropdown-${idx}`);
    if (dd) {
      dd.classList.remove('open');
      dd.innerHTML = '';
    }
    if (activeQuoteDropdownIdx === idx) {
      activeQuoteDropdownIdx = -1;
    }
  }, 200);
}

function handleQuoteDescKeydown(e, idx) {
  const dd = document.getElementById(`quote-dropdown-${idx}`);
  if (!dd || !dd.classList.contains('open')) return;
  
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    highlightedQuoteTileIdx = (highlightedQuoteTileIdx + 1) % filteredQuoteTiles.length;
    renderQuoteDropdown(idx);
    scrollQuoteHighlightedIntoView(idx);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    highlightedQuoteTileIdx = (highlightedQuoteTileIdx - 1 + filteredQuoteTiles.length) % filteredQuoteTiles.length;
    renderQuoteDropdown(idx);
    scrollQuoteHighlightedIntoView(idx);
  } else if (e.key === 'Enter') {
    if (highlightedQuoteTileIdx !== -1) {
      e.preventDefault();
      selectQuoteTile(idx, highlightedQuoteTileIdx);
    }
  } else if (e.key === 'Escape') {
    dd.classList.remove('open');
    dd.innerHTML = '';
  }
}

function scrollQuoteHighlightedIntoView(idx) {
  const dd = document.getElementById(`quote-dropdown-${idx}`);
  if (!dd) return;
  const highlighted = dd.querySelector('.tile-option.highlighted');
  if (highlighted) {
    const ddRect = dd.getBoundingClientRect();
    const elemRect = highlighted.getBoundingClientRect();
    if (elemRect.bottom > ddRect.bottom) {
      dd.scrollTop += elemRect.bottom - ddRect.bottom;
    } else if (elemRect.top < ddRect.top) {
      dd.scrollTop -= ddRect.top - elemRect.top;
    }
  }
}

function savePlanToCloud() {
  if (!supabaseClient) {
    alert("Supabase is not connected. Please click the Settings (⚙️) button to configure your URL and Anon Key.");
    return;
  }

  const custName  = document.getElementById('customer-name').value.trim();
  const custPhone = document.getElementById('customer-phone').value.trim();
  const planDate  = document.getElementById('plan-date').value;
  const planNotes = document.getElementById('plan-notes').value.trim();
  
  if (!custName) {
    alert("Please enter a Customer Name before saving.");
    return;
  }

  const quoteCustNameEl = document.getElementById('quote-customer-name');
  const quoteNumberEl   = document.getElementById('quote-number');
  const quoteDateEl     = document.getElementById('quote-date');
  const quoteByEl       = document.getElementById('quote-by');
  
  const quoteCustName = quoteCustNameEl ? quoteCustNameEl.value.trim() : '';
  const quoteNumber   = quoteNumberEl ? quoteNumberEl.value.trim() : '';
  const quoteDate     = quoteDateEl ? quoteDateEl.value.trim() : '';
  const quoteBy       = quoteByEl ? quoteByEl.value.trim() : '';

  let planNotesToSave = planNotes;
  if (quoteBy) {
    planNotesToSave += `\n[quote_by:${quoteBy}]`;
  }
  
  const payload = {
    customer_name: custName,
    customer_phone: custPhone,
    plan_date: planDate || null,
    plan_notes: planNotesToSave,
    rooms: rooms,
    quotation_items: quotationItems,
    quote_customer_name: quoteCustName,
    quote_number: quoteNumber,
    quote_date: quoteDate,
    next_id: nextId
  };

  const btn = document.getElementById('btn-cloud-save');
  const originalText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = "Saving...";

  let query;
  if (activeEstimateId) {
    query = supabaseClient
      .from('estimates')
      .update(payload)
      .eq('id', activeEstimateId)
      .select();
  } else {
    query = supabaseClient
      .from('estimates')
      .insert([payload])
      .select();
  }

  query.then(({ data, error }) => {
    btn.disabled = false;
    btn.innerHTML = originalText;
    
    if (error) {
      console.error("Cloud Save error:", error);
      alert("Failed to save to cloud: " + error.message);
    } else {
      if (data && data.length > 0) {
        activeEstimateId = data[0].id;
        updateActiveEstimateStatus();
        alert("Estimate saved to cloud successfully!");
      } else {
        alert("Estimate saved to cloud successfully!");
      }
    }
  }).catch(err => {
    btn.disabled = false;
    btn.innerHTML = originalText;
    console.error("Cloud Save unexpected error:", err);
    alert("An unexpected error occurred during Cloud Save: " + err.message);
  });
}

function openCloudEstimatesModal() {
  if (!supabaseClient) {
    alert("Supabase is not connected. Please click the Settings (⚙️) button to configure your URL and Anon Key.");
    return;
  }

  const modal = document.getElementById('cloud-estimates-modal');
  modal.showModal();

  // Clear search input
  const searchInput = document.getElementById('cloud-search-input');
  if (searchInput) searchInput.value = '';

  const tbody = document.getElementById('cloud-estimates-tbody');
  if (tbody) tbody.innerHTML = '';

  const loadingState = document.getElementById('cloud-loading-state');
  const emptyState = document.getElementById('cloud-empty-state');
  
  if (loadingState) loadingState.style.display = 'flex';
  if (emptyState) emptyState.style.display = 'none';

  // Fetch estimates
  supabaseClient
    .from('estimates')
    .select('id, created_at, customer_name, customer_phone, plan_date, plan_notes')
    .order('created_at', { ascending: false })
    .then(({ data, error }) => {
      if (loadingState) loadingState.style.display = 'none';
      
      if (error) {
        console.error("Fetch estimates error:", error);
        alert("Failed to fetch cloud estimates: " + error.message);
      } else {
        allCloudEstimates = data || [];
        renderCloudEstimatesList(allCloudEstimates);
      }
    })
    .catch(err => {
      if (loadingState) loadingState.style.display = 'none';
      console.error("Fetch estimates unexpected error:", err);
      alert("An unexpected error occurred: " + err.message);
    });
}

function renderCloudEstimatesList(list) {
  const tbody = document.getElementById('cloud-estimates-tbody');
  const emptyState = document.getElementById('cloud-empty-state');
  
  if (!tbody) return;
  tbody.innerHTML = '';

  if (list.length === 0) {
    if (emptyState) emptyState.style.display = 'flex';
    return;
  }

  if (emptyState) emptyState.style.display = 'none';

  list.forEach(item => {
    const row = document.createElement('tr');
    
    // Format date nicely
    let formattedDate = '';
    if (item.plan_date) {
      const d = new Date(item.plan_date);
      formattedDate = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    } else if (item.created_at) {
      const d = new Date(item.created_at);
      formattedDate = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    }

    let cleanNotes = item.plan_notes || '';
    cleanNotes = cleanNotes.replace(/\n?\[quote_by:(.*?)\]$/, '').trim();

    row.innerHTML = `
      <td><strong>${item.customer_name || 'Untitled'}</strong></td>
      <td>${item.customer_phone || '—'}</td>
      <td>${formattedDate}</td>
      <td><span style="font-size:0.8rem; color:var(--text3);">${cleanNotes || '—'}</span></td>
      <td class="cloud-action-cell">
        <button class="btn btn-primary" onclick="loadCloudEstimate('${item.id}')">Load</button>
        <button class="btn btn-danger-ghost" onclick="deleteCloudEstimate('${item.id}')" title="Delete from cloud">
          <svg viewBox="0 0 20 20" fill="currentColor" style="width:14px; height:14px;"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>
        </button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

function filterCloudEstimates() {
  const query = document.getElementById('cloud-search-input').value.trim().toLowerCase();
  if (!query) {
    renderCloudEstimatesList(allCloudEstimates);
    return;
  }

  const filtered = allCloudEstimates.filter(item => {
    const name = (item.customer_name || '').toLowerCase();
    const phone = (item.customer_phone || '').toLowerCase();
    const notes = (item.plan_notes || '').toLowerCase();
    return name.includes(query) || phone.includes(query) || notes.includes(query);
  });

  renderCloudEstimatesList(filtered);
}

function loadCloudEstimate(id) {
  if (!supabaseClient) return;

  if (rooms.length > 0) {
    if (!confirm('This will replace your current planner data. Do you want to continue?')) {
      return;
    }
  }

  supabaseClient
    .from('estimates')
    .select('*')
    .eq('id', id)
    .single()
    .then(({ data, error }) => {
      if (error) {
        console.error("Load cloud estimate error:", error);
        alert("Failed to load estimate: " + error.message);
      } else if (data) {
        // Extract quoteBy from plan_notes
        let planNotes = data.plan_notes || '';
        let quoteBy = '';
        const match = planNotes.match(/\[quote_by:(.*?)\]$/);
        if (match) {
          quoteBy = match[1];
          planNotes = planNotes.replace(/\n?\[quote_by:(.*?)\]$/, '');
        }

        // Populate inputs
        document.getElementById('customer-name').value = data.customer_name || '';
        document.getElementById('customer-phone').value = data.customer_phone || '';
        document.getElementById('plan-date').value = data.plan_date || '';
        document.getElementById('plan-notes').value = planNotes;

        const quoteCustNameEl = document.getElementById('quote-customer-name');
        const quoteNumberEl   = document.getElementById('quote-number');
        const quoteDateEl     = document.getElementById('quote-date');
        const quoteByEl       = document.getElementById('quote-by');

        if (quoteCustNameEl) quoteCustNameEl.value = data.quote_customer_name || data.customer_name || '';
        if (quoteNumberEl) quoteNumberEl.value = data.quote_number || '';
        if (quoteDateEl) quoteDateEl.value = data.quote_date || '';
        if (quoteByEl) quoteByEl.value = quoteBy || '';

        // Restore state variables
        rooms = data.rooms || [];
        quotationItems = data.quotation_items || [];
        nextId = data.next_id || (rooms.reduce((max, r) => Math.max(max, r.id), 0) + 1);
        activeEstimateId = id;

        // Re-renders and updates
        updateLiveArea();
        renderTable();
        renderSummary();
        if (typeof renderQuotation === 'function') renderQuotation();
        updateActiveEstimateStatus();

        document.getElementById('cloud-estimates-modal').close();
        alert("Estimate loaded successfully!");
      }
    })
    .catch(err => {
      console.error("Load cloud estimate unexpected error:", err);
      alert("An unexpected error occurred: " + err.message);
    });
}

function deleteCloudEstimate(id) {
  if (!supabaseClient) return;

  if (!confirm("Are you sure you want to delete this estimate from the cloud? This action cannot be undone.")) {
    return;
  }

  supabaseClient
    .from('estimates')
    .delete()
    .eq('id', id)
    .then(({ error }) => {
      if (error) {
        console.error("Delete estimate error:", error);
        alert("Failed to delete estimate: " + error.message);
      } else {
        alert("Estimate deleted successfully!");
        
        // If it was the active estimate, reset activeEstimateId
        if (activeEstimateId === id) {
          activeEstimateId = null;
          updateActiveEstimateStatus();
        }

        // Refresh the list
        openCloudEstimatesModal();
      }
    })
    .catch(err => {
      console.error("Delete estimate unexpected error:", err);
      alert("An unexpected error occurred: " + err.message);
    });
}

function savePlan() {
  const custName  = document.getElementById('customer-name').value.trim();
  const custPhone = document.getElementById('customer-phone').value.trim();
  const planDate  = document.getElementById('plan-date').value;
  const planNotes = document.getElementById('plan-notes').value.trim();
  
  const quoteCustNameEl = document.getElementById('quote-customer-name');
  const quoteNumberEl   = document.getElementById('quote-number');
  const quoteDateEl     = document.getElementById('quote-date');
  const quoteByEl       = document.getElementById('quote-by');
  
  const quoteCustName = quoteCustNameEl ? quoteCustNameEl.value.trim() : '';
  const quoteNumber   = quoteNumberEl ? quoteNumberEl.value.trim() : '';
  const quoteDate     = quoteDateEl ? quoteDateEl.value.trim() : '';
  const quoteBy       = quoteByEl ? quoteByEl.value.trim() : '';
  
  const payload = {
    customerName: custName,
    customerPhone: custPhone,
    planDate: planDate,
    planNotes: planNotes,
    rooms: rooms,
    quotationItems: quotationItems,
    quoteCustomerName: quoteCustName,
    quoteNumber: quoteNumber,
    quoteDate: quoteDate,
    quoteBy: quoteBy,
    nextId: nextId
  };
  
  const jsonStr = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  const safeName = custName ? custName.replace(/[^a-z0-9_-]/gi, '_') : 'Untitled';
  const safeDate = planDate ? planDate.replace(/[^a-z0-9_-]/gi, '_') : 'date';
  
  a.href = url;
  a.download = `Plan_${safeName}_${safeDate}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function handleLoadPlan(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  // Confirm overwrite if there are already rooms
  if (rooms.length > 0) {
    if (!confirm('This will replace your current planner data. Do you want to continue?')) {
      event.target.value = ''; // clear file input
      return;
    }
  }
  
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);
      
      // Validation check
      if (!data || !Array.isArray(data.rooms)) {
        throw new Error('Invalid plan file format (missing rooms list).');
      }
      
      // Populate fields
      document.getElementById('customer-name').value = data.customerName || '';
      document.getElementById('customer-phone').value = data.customerPhone || '';
      document.getElementById('plan-date').value = data.planDate || '';
      document.getElementById('plan-notes').value = data.planNotes || '';
      
      const quoteCustNameEl = document.getElementById('quote-customer-name');
      const quoteNumberEl   = document.getElementById('quote-number');
      const quoteDateEl     = document.getElementById('quote-date');
      const quoteByEl       = document.getElementById('quote-by');
      
      if (quoteCustNameEl) quoteCustNameEl.value = data.quoteCustomerName || data.customerName || '';
      if (quoteNumberEl) quoteNumberEl.value = data.quoteNumber || '';
      if (quoteDateEl) quoteDateEl.value = data.quoteDate || '';
      if (quoteByEl) quoteByEl.value = data.quoteBy || '';
      
      // Restore variables
      rooms = data.rooms;
      quotationItems = data.quotationItems || [];
      nextId = data.nextId || (rooms.reduce((max, r) => Math.max(max, r.id), 0) + 1);
      
      // Reset cloud state since we loaded a local file
      activeEstimateId = null;
      updateActiveEstimateStatus();
      
      // Trigger updates and re-renders
      updateLiveArea();
      renderTable();
      renderSummary();
      renderQuotation();
      
      alert('Plan loaded successfully!');
    } catch (err) {
      console.error(err);
      alert('Failed to load plan: ' + err.message);
    }
    event.target.value = ''; // clear file input
  };
  reader.readAsText(file);
}

// ─── Catalog Management ──────────────────────────────────────────
let currentCatalogFilter = '';

function renderCatalogTable(searchQuery = '') {
  currentCatalogFilter = searchQuery.toLowerCase().trim();
  const tbody = document.getElementById('catalog-tbody');
  const countHeader = document.getElementById('catalog-count-header');
  if (!tbody || !countHeader) return;

  tbody.innerHTML = '';

  const filteredDB = TILE_DB.filter(item => 
    item.name.toLowerCase().includes(currentCatalogFilter)
  );
  
  countHeader.textContent = `Catalog Database (${filteredDB.length} Items)`;

  if (filteredDB.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text3); padding: 2rem;">No products found in catalog.</td></tr>`;
    return;
  }

  filteredDB.forEach((item) => {
    // We need the original index in TILE_DB for deletion
    const originalIndex = TILE_DB.findIndex(dbItem => dbItem.name === item.name);
    
    const tr = document.createElement('tr');
    
    // Formatting values
    const coverage = item.coverage ? item.coverage.toFixed(2) : '--';
    const weight = item.weight ? item.weight.toFixed(2) : '--';
    const rateStr = (item.price || item.rate) ? `₹ ${parseFloat(item.price || item.rate).toFixed(2)}` : '--';
    
    // Accessory badge
    const accessoryBadge = item.isAccessory ? `<span style="font-size: 0.6rem; padding: 0.15rem 0.3rem; margin-left: 0.5rem; background: rgba(245, 158, 11, 0.2); color: #fbbf24; border-radius: 4px; font-weight: 600; white-space: nowrap;">🛠 Paste/Accessory</span>` : '';

    tr.innerHTML = `
      <td class="item-name" style="display:flex; align-items:center;">${item.name} ${accessoryBadge}</td>
      <td style="text-align: center;">${coverage}</td>
      <td style="text-align: center;">${weight}</td>
      <td style="text-align: right; font-weight: 600;">${rateStr}</td>
      <td style="text-align: center;">
        <button class="btn-icon-del" onclick="deleteProductFromCatalog(${originalIndex})" title="Delete Product" style="margin: 0 auto;">
          <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function filterCatalog() {
  const query = document.getElementById('catalog-search-input').value;
  renderCatalogTable(query);
}

function saveProductToCatalog() {
  const nameInput = document.getElementById('new-product-name');
  const coverageInput = document.getElementById('new-product-coverage');
  const weightInput = document.getElementById('new-product-weight');
  const rateInput = document.getElementById('new-product-rate');
  const accessoryInput = document.getElementById('new-product-is-accessory');

  const name = nameInput.value.trim().toUpperCase();
  const coverage = parseFloat(coverageInput.value);
  const weight = parseFloat(weightInput.value);
  const rate = parseFloat(rateInput.value);
  const isAccessory = accessoryInput ? accessoryInput.checked : false;

  if (!name) {
    alert("Product Name / Description is required.");
    return;
  }
  if (isNaN(coverage) || coverage <= 0) {
    alert("Please enter a valid Coverage > 0.");
    return;
  }
  if (isNaN(weight) || weight <= 0) {
    alert("Please enter a valid Weight > 0.");
    return;
  }

  // Check for duplicates
  const existingIndex = TILE_DB.findIndex(item => item.name === name);
  if (existingIndex !== -1) {
    const confirmOverwrite = confirm(`Product "${name}" already exists. Overwrite it?`);
    if (!confirmOverwrite) return;
    
    // Update existing
    TILE_DB[existingIndex] = {
      name: name,
      coverage: coverage,
      weight: weight,
      price: isNaN(rate) ? 0 : rate, // using price as standard based on CSV logic
      isAccessory: isAccessory
    };
  } else {
    // Add new
    TILE_DB.unshift({ // Add to top
      name: name,
      coverage: coverage,
      weight: weight,
      price: isNaN(rate) ? 0 : rate,
      isAccessory: isAccessory
    });
  }

  // Save to local storage
  localStorage.setItem('cached_tile_db', JSON.stringify(TILE_DB));

  // Re-render things
  renderCatalogTable(currentCatalogFilter);
  filteredTiles = [...TILE_DB];
  if (typeof renderDropdown === 'function') renderDropdown();
  
  // Clear form
  nameInput.value = '';
  coverageInput.value = '';
  weightInput.value = '';
  rateInput.value = '';
  if(accessoryInput) accessoryInput.checked = false;
  nameInput.focus();
}

function deleteProductFromCatalog(index) {
  if (index < 0 || index >= TILE_DB.length) return;
  
  const item = TILE_DB[index];
  if (confirm(`Are you sure you want to delete "${item.name}" from the catalog?`)) {
    TILE_DB.splice(index, 1);
    localStorage.setItem('cached_tile_db', JSON.stringify(TILE_DB));
    renderCatalogTable(currentCatalogFilter);
    filteredTiles = [...TILE_DB];
    if (typeof renderDropdown === 'function') renderDropdown();
  }
}

