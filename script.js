console.log('=== CORPORATE TAKEDOWN — PROTOCOL ASCENSION ===');

/* ══ FIREBASE ════════════════════════════════════════════════════════════ */
const firebaseConfig = {
  apiKey: "AIzaSyBvx5u1OGwS6YAvmVhBF9bstiUn-Vp6TVY",
  authDomain: "corporate-extraction.firebaseapp.com",
  databaseURL: "https://corporate-extraction-default-rtdb.firebaseio.com",
  projectId: "corporate-extraction",
  storageBucket: "corporate-extraction.firebasestorage.app",
  messagingSenderId: "184892788723",
  appId: "1:184892788723:web:93959fe24c883a27088c86"
};

let db = null, bossRef = null, employeesRef = null, currentUser = null;

try {
  if (typeof firebase !== 'undefined' && !firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
    db = firebase.database();
    bossRef = db.ref('frank_corporate_data');
    employeesRef = db.ref('active_employees');
  }
} catch(e) { console.warn('Firebase offline:', e); }

const isOBS = new URLSearchParams(window.location.search).get('obs') === 'true';

/* ══ FIREBASE AUTH ════════════════════════════════════════════════════════ */
let authReady = false;
if (typeof firebase !== 'undefined' && firebase.auth) {
  firebase.auth().onAuthStateChanged(user => {
    if (user) {
      currentUser = user;
      authReady = true;
      // Store uid so crates.html can sync without needing its own auth
      try { localStorage.setItem('ct_player_uid', user.uid); } catch(e) {}
      if (introEnded) load();
    } else {
      firebase.auth().signInAnonymously().catch(e => console.warn('Auth error:', e));
    }
  });
}

setInterval(() => { if (authReady) save(); }, 30000);
window.addEventListener('beforeunload', () => { save(); });

// Poll localStorage for equipped gear written by crates.html
// Runs every 2s — no Firebase needed, works as long as both tabs are same origin
setInterval(() => {
  if (!myUser) return;
  try {
    const raw = localStorage.getItem('ct_crate_equipped');
    // No equipped data saved yet — skip
    if (!raw) return;
    const eq = JSON.parse(raw);
    const prev = JSON.stringify(window._myEquipped || {});
    const next = JSON.stringify(eq);
    if (next === prev) return; // no change, skip
    window._myEquipped = eq;
    applyGearBuffs(); // refresh coin bonus whenever gear changes
    console.log('[Gear] Equipped updated from crates page:', eq);
    // Update own visible card
    const gearEl = document.querySelector('#pcard-' + myUser + ' .player-gear');
    if (gearEl) {
      gearEl.innerHTML = _equippedGearHTML(eq);
    } else {
      console.warn('[Gear] Could not find player card .player-gear for', myUser);
    }
    // Push equipped + items to active_employees so other players can see collection
    if (employeesRef && myUser) {
      let items = [];
      try { const cs = localStorage.getItem('ctcrates'); if(cs){const d=JSON.parse(cs);if(d.items)items=d.items;} } catch(e2){}
      employeesRef.child(myUser).update({ equipped: eq, crateItems: items })
        .catch(e => console.warn('[Gear] FB update failed:', e.message));
    }
  } catch(e) {
    console.error('[Gear] Poll error:', e);
  }
}, 2000);

/* ══ AUDIO ════════════════════════════════════════════════════════════════ */
const bgm = new Audio('Cubicle_Dreams.mp3');
bgm.loop = true; bgm.volume = 0.15;
const clickSfxFiles = ['sfx pack/Boss hit 1.wav','sfx pack/Bubble 1.wav','sfx pack/Hit damage 1.wav','sfx pack/Select 1.wav'];
const attackSounds = clickSfxFiles.map(f => { const a = new Audio(encodeURI(f)); a.volume = 0.3; return a; });
function playClickSound() {
  try { const s = attackSounds[Math.floor(Math.random()*attackSounds.length)].cloneNode(); s.volume=0.3; s.play().catch(()=>{}); } catch(e){}
}

/* ══ roundRect polyfill for older browsers ════════════════════════════ */
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x,y,w,h,r){
    this.beginPath();
    this.moveTo(x+r,y); this.lineTo(x+w-r,y);
    this.arcTo(x+w,y,x+w,y+r,r); this.lineTo(x+w,y+h-r);
    this.arcTo(x+w,y+h,x+w-r,y+h,r); this.lineTo(x+r,y+h);
    this.arcTo(x,y+h,x,y+h-r,r); this.lineTo(x,y+r);
    this.arcTo(x,y,x+r,y,r); this.closePath();
  };
}

/* ══ GAME STATE ═══════════════════════════════════════════════════════════ */
let myCoins=0, myClickDmg=2500, myAutoDmg=0, multi=1, frenzy=0;
let clickCost=25, autoCost=200, critChance=0, critCost=200, myUser='', lastManualClick=0;
let myInventory={}, itemBuffMultiplier=1.0, isAnimatingHit=false;
let overtimeUnlocked=false, synergyLevel=0, rageFuelUnlocked=false, hustleCoinsPerClick=0;
let synergyCost=150, rageCost=75, hustleCost=30;
let currentBossLevel=1;
let _lastBossLevel=null;
let prestigeCount=0, prestigeBuffMulti=1.0;
let myCryptoFragments=0; // Crypto fragments dropped by boss, extracted in Analytics


/* ══ ANTI-CHEAT ══════════════════════════════════════════════════════════ */
let clickHistory = [];
const MAX_CPS = 20;
let isCheating = false;
let cheatLockout = null;

function checkAntiCheat() {
  const now = Date.now();
  clickHistory.push(now);
  clickHistory = clickHistory.filter(t => now - t < 1000);
  if (clickHistory.length > MAX_CPS) {
    isCheating = true;
    if (cheatLockout) clearTimeout(cheatLockout);
    const bName = document.getElementById('main-boss-name');
    if (bName) bName.innerText = '⚠️ SECURITY BREACH';
    cheatLockout = setTimeout(() => {
      isCheating = false;
      clickHistory = [];
    }, 4000);
    return false;
  }
  return true;
}

/* ══ PRESTIGE TITLES ══════════════════════════════════════════════════════ */
const PRESTIGE_TITLES = [
  null, 'Intern','Jr. Analyst','Associate','Coordinator','Specialist',
  'Sr. Analyst','Team Lead','Manager','Director','VP','C-Suite ⭐'
];
function getPrestigeTitle(n) {
  return PRESTIGE_TITLES[Math.min(n, PRESTIGE_TITLES.length-1)] || null;
}

/* ══════════════════════════════════════════════════════════════════════════
   RUNESCAPE-STYLE SKILL SYSTEM
════════════════════════════════════════════════════════════════════════════ */
const SKILLS = {
  phishing:   { name:'Phishing',   icon:'🎣', xp:0, level:1 },
  firewall:   { name:'Firewall',   icon:'🛡️', xp:0, level:1 },
  recovery:   { name:'Recovery',   icon:'💾', xp:0, level:1 },
  encryption: { name:'Purge',      icon:'⚔️', xp:0, level:1 },
  analytics:  { name:'Analytics',  icon:'📊', xp:0, level:1 },
  networking: { name:'Networking', icon:'🌐', xp:0, level:1 },
};

const XP_TABLE = new Array(100).fill(0);
(function buildXPTable(){
  // RuneScape-style XP curve. Level 99 = ~13M XP.
  // At 4x faster pacing than RS (~100h max vs RS ~400h), skill grinding feels earned.
  let pts = 0;
  for(let lvl=1; lvl<99; lvl++){
    pts += Math.floor(lvl + 300 * Math.pow(2, lvl/7));
    XP_TABLE[lvl+1] = Math.floor(pts / 4);
  }
})();

function xpProgressPct(skill){
  if(skill.level >= 99) return 100;
  const lo = XP_TABLE[skill.level] || 0;
  const hi = XP_TABLE[skill.level+1] || 1;
  return Math.min(100, ((skill.xp - lo) / (hi - lo)) * 100);
}

const SKILL_MILESTONES = {
  firewall: [
    { level:5,  icon:'🧱', name:'Basic Proxy',         type:'armor_pierce', value:0.01, desc:'+1% Armor Piercing' },
    { level:10, icon:'🔒', name:'Packet Filter',       type:'dash_coins',   value:0.02, desc:'+2% Dash Coins' },
    { level:15, icon:'🛡️', name:'Intrusion Detection', type:'armor_pierce', value:0.01, desc:'+1% Armor Piercing' },
    { level:20, icon:'🌐', name:'Subnet Gateway',      type:'dash_coins',   value:0.02, desc:'+2% Dash Coins' },
    { level:25, icon:'🔥', name:'Neon Bastion',        type:'armor_pierce', value:0.02, desc:'+2% Armor Piercing' },
    { level:30, icon:'💾', name:'The Mainframe',       type:'frenzy_cap',   value:2,    desc:'+2% Max Frenzy Cap' },
  ],
  phishing: [
    { level:5,  icon:'💌', name:'Spam Filter',         type:'crit_bonus',     value:1,    desc:'+1% Crit Chance' },
    { level:10, icon:'📧', name:'Spear Phish',         type:'loot_rate',      value:0.02, desc:'+2% Loot Drop Rate' },
    { level:15, icon:'🪝', name:'Whaling Tactics',     type:'crit_bonus',     value:1,    desc:'+1% Crit Chance' },
    { level:20, icon:'💻', name:'Darkweb Crawler',     type:'loot_rate',      value:0.02, desc:'+2% Loot Drop Rate' },
    { level:25, icon:'🕸️', name:'Zero-Day Exploit',   type:'crit_bonus',     value:2,    desc:'+2% Crit Chance' },
    { level:30, icon:'🏴‍☠️', name:'The Architect',    type:'legendary_rate', value:0.01, desc:'+1% Legendary Drop Chance' },
  ],
};

let milestoneBonuses = {
  armor_pierce:0, dash_coins:0, frenzy_cap:0,
  crit_bonus:0, loot_rate:0, legendary_rate:0,
};

function recalcMilestoneBonuses() {
  milestoneBonuses = { armor_pierce:0, dash_coins:0, frenzy_cap:0, crit_bonus:0, loot_rate:0, legendary_rate:0 };
  for (const [skillKey, milestones] of Object.entries(SKILL_MILESTONES)) {
    const sk = SKILLS[skillKey];
    for (const m of milestones) {
      if (sk.level >= m.level) {
        milestoneBonuses[m.type] = (milestoneBonuses[m.type] || 0) + m.value;
      }
    }
  }
}

function addSkillXP(key, amount) {
  const sk = SKILLS[key]; if (!sk) return;
  const oldLvl = sk.level;
  sk.xp += amount;
  while (sk.level < 99 && sk.xp >= XP_TABLE[sk.level+1]) {
    sk.level++;
    checkMilestoneUnlocks(key, sk.level);
    showSkillLevelUp(key, sk.level);
  }
  if (sk.level !== oldLvl) { recalcMilestoneBonuses(); save(); }
  renderSkillPanel();
}

function checkMilestoneUnlocks(skillKey, newLevel) {
  const milestones = SKILL_MILESTONES[skillKey];
  if (!milestones) return;
  for (const m of milestones) {
    if (m.level === newLevel) showMilestoneUnlock(skillKey, m);
  }
}

function showMilestoneUnlock(skillKey, milestone) {
  const pop = document.createElement('div');
  pop.style.cssText = 'position:fixed;top:36%;left:50%;transform:translate(-50%,-50%) scale(0.5);opacity:0;' +
    'background:linear-gradient(135deg,#001a00,#002a10);border:3px solid #00ffcc;border-radius:8px;' +
    'padding:20px 40px;z-index:300001;text-align:center;font-family:VT323,monospace;' +
    'box-shadow:0 0 50px rgba(0,255,204,0.7);pointer-events:none;transition:transform 0.35s cubic-bezier(0.2,1.5,0.4,1),opacity 0.3s;';
  pop.innerHTML = `
    <div style="font-size:2.4rem;line-height:1">${milestone.icon}</div>
    <div style="font-size:1.8rem;color:#00ffcc;text-shadow:0 0 12px #00ffcc;margin:4px 0">MILESTONE!</div>
    <div style="font-size:1.4rem;color:#fff">${milestone.name}</div>
    <div style="font-size:1.1rem;color:#f1c40f;margin-top:4px">${milestone.desc}</div>`;
  document.body.appendChild(pop);
  requestAnimationFrame(() => { pop.style.transform='translate(-50%,-50%) scale(1)'; pop.style.opacity='1'; });
  setTimeout(() => { pop.style.opacity='0'; pop.style.transform='translate(-50%,-50%) scale(0.85)'; setTimeout(() => pop.remove(), 350); }, 3000);
}

function showSkillLevelUp(key, newLevel) {
  const sk = SKILLS[key];
  const pop = document.createElement('div');
  pop.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-60%) scale(0.6);opacity:0;' +
    'background:linear-gradient(135deg,#0a001a,#1a0040);border:3px solid #f1c40f;border-radius:8px;' +
    'padding:22px 40px;z-index:300000;text-align:center;font-family:VT323,monospace;' +
    'box-shadow:0 0 50px rgba(241,196,15,0.7);pointer-events:none;transition:transform 0.35s cubic-bezier(0.2,1.5,0.4,1),opacity 0.3s;';
  pop.innerHTML = `<div style="font-size:2.8rem;line-height:1">${sk.icon}</div>
    <div style="font-size:2.2rem;color:#f1c40f;text-shadow:0 0 14px #f1c40f;margin:6px 0">LEVEL UP!</div>
    <div style="font-size:1.5rem;color:#ddd">${sk.name}</div>
    <div style="font-size:3rem;color:#00ffcc;text-shadow:0 0 12px #00ffcc">Level ${newLevel}</div>`;
  document.body.appendChild(pop);
  requestAnimationFrame(() => { pop.style.transform='translate(-50%,-50%) scale(1)'; pop.style.opacity='1'; });
  setTimeout(() => { pop.style.opacity='0'; pop.style.transform='translate(-50%,-50%) scale(0.85)'; setTimeout(() => pop.remove(), 350); }, 2400);
}

function renderSkillPanel() {
  for (const key of Object.keys(SKILLS)) {
    const sk = SKILLS[key];
    const slot = document.getElementById('skill-'+key);
    if (!slot) continue;
    const lvEl = slot.querySelector('.skill-level');
    if (lvEl) lvEl.innerText = sk.level >= 99 ? '99 ⭐' : 'Lv.'+sk.level;
    let bar = slot.querySelector('.sk-xp-fill');
    if (!bar) {
      const wrap = document.createElement('div');
      wrap.style.cssText='width:100%;height:3px;background:#1a0030;border-radius:2px;margin-top:3px;overflow:hidden;flex-shrink:0;';
      bar = document.createElement('div');
      bar.className='sk-xp-fill';
      bar.style.cssText='height:100%;background:linear-gradient(90deg,#00ffcc,#00ff88);border-radius:2px;transition:width 0.4s;';
      wrap.appendChild(bar); slot.appendChild(wrap);
    }
    bar.style.width = xpProgressPct(sk)+'%';
    if (slot.classList.contains('skill-active')) {
      const lv = sk.level;
      if (lv >= 80)      { slot.style.borderColor='#f1c40f'; slot.style.boxShadow='0 0 10px rgba(241,196,15,0.45)'; }
      else if (lv >= 50) { slot.style.borderColor='#3498db'; slot.style.boxShadow='0 0 8px rgba(52,152,219,0.4)'; }
      else if (lv >= 20) { slot.style.borderColor='#2ecc71'; slot.style.boxShadow='0 0 6px rgba(46,204,113,0.3)'; }
      const msPrefix = key === 'phishing' ? 'ms-phish-' : key === 'firewall' ? 'ms-fire-' : null;
      if (msPrefix) {
        for (const lvl of [5,10,15,20,25,30]) {
          const row = document.getElementById(msPrefix+lvl);
          if (row) { row.className = 'milestone-row ' + (lv >= lvl ? 'unlocked' : 'locked'); }
        }
      }
    }
  }
}

function showXPGain(key, xp) {
  const sk = SKILLS[key]; if (!sk) return;
  const pop = document.createElement('div');
  pop.style.cssText = 'position:fixed;bottom:90px;right:22px;background:rgba(0,0,0,0.88);border:1px solid #00ffcc;' +
    'border-radius:4px;padding:7px 16px;font-family:VT323,monospace;font-size:1.15rem;color:#00ffcc;z-index:99999;pointer-events:none;' +
    'animation:xpSlide 0.3s ease,xpFade 0.4s 2.2s forwards;';
  pop.innerText = sk.icon+' +'+xp.toLocaleString()+' '+sk.name+' XP  (Lv.'+sk.level+')';
  document.body.appendChild(pop);
  setTimeout(() => pop.remove(), 2800);
}

/* ══ RICHARD TIPS ════════════════════════════════════════════════════════ */
const richardTips = [
  "TIP: CLICK FAST TO FILL THE CHARGE METER!",
  "TIP: CHARGE TO 100% FOR A 5x DAMAGE COMBO!",
  "TIP: CRIT HITS DEAL 5x YOUR BASE DAMAGE!",
  "TIP: PLAY MINIGAMES TO LEVEL YOUR SKILLS!",
  "TIP: MERCS DEAL DAMAGE EVEN WHILE YOU'RE AFK!",
  "TIP: PRESTIGE IS AUTO — BE ONLINE TO EARN BUFFS!",
  "TIP: LEGENDARY LOOT DROPS ARE RARE — KEEP CLICKING!",
  "TIP: SYNERGY BOOST STACKS WITH ALL OTHER MULTIPLIERS!",
  "TIP: FIREWALL DASH PAYS 1,000 COINS PER SECOND!",
  "TIP: PHISHING SKILL LEVELS UP EVERY MINIGAME!",
  "TIP: BOSS ARMOR INCREASES EVERY LEVEL — UPGRADE OFTEN!",
  "TIP: CHECK THE DESK DRAWER FOR LOOT BUFFS!",
  "TIP: SIDE HUSTLE GIVES EXTRA COINS PER CLICK!",
  "TIP: RAGE FUEL SLOWS YOUR COMBO METER DECAY!",
  "TIP: PRESTIGE GIVES YOUR CUBICLE A NEW TITLE!",
  "TIP: DOUBLE JUMP IS AVAILABLE IN CORPORATE DASH!",
  "TIP: OVERTIME UPGRADE FIRES MERCS EVERY 0.6s!",
  "TIP: REACH SKILL LV.99 FOR MAX POWER BONUS!",
  "TIP: ACTIVE PLAYERS AT PRESTIGE GET +10% PERM DMG!",
  "TIP: SKILL MILESTONES UNLOCK EVERY 5 LEVELS!",
  "TIP: FIREWALL LV.30 RAISES YOUR MAX FRENZY CAP!",
  "TIP: PHISHING LV.30 BOOSTS LEGENDARY LOOT ODDS!",
  "TIP: COMPLETE MINIGAMES FOR A CHANCE AT RARE ORNAMENTS!",
  "TIP: CHECK YOUR WORK DESK — ORNAMENTS ARE WAITING!",
];
let usedTips = [];

/* ══════════════════════════════════════════════════════════════════════════
   MY WORK DESK — ORNAMENT SYSTEM  (GDD v2)
   18 ornaments | 2 tabs | milestone rewards | rich tooltips | 8 broadcast
   templates | tutorial popup | locked wireframe slots
   Drop rate: 1 in 2,000 | Expected ~7–8 drops to lv99 | P(≥3) ≈ 98%
════════════════════════════════════════════════════════════════════════════ */

// 18 ornaments — GDD flavor text, skill sources, emoji fallbacks
// PNG path: assets/desk_assets/ornaments/<id>.png
const ALL_ORNAMENTS = [
  { id:'gold_pickaxe',   displayName:'Golden Pickaxe',   emoji:'⛏️', skillSource:'Mining',           slotId:'slot_01', description:"Sturdy enough to break bedrock, shiny enough to blind a goblin." },
  { id:'gold_anvil',     displayName:'Golden Anvil',     emoji:'🔨', skillSource:'Smithing',          slotId:'slot_02', description:"It rings with the purest tone when struck, but it's much too pretty to use." },
  { id:'gold_fishhook',  displayName:'Golden Fishhook',  emoji:'🎣', skillSource:'Phishing',          slotId:'slot_03', description:"The ultimate lure; even the sea gods are jealous of its gleam." },
  { id:'gold_spatula',   displayName:'Golden Spatula',   emoji:'🍳', skillSource:'Cooking',           slotId:'slot_04', description:"Flips flapjacks with divine, unmistakable precision." },
  { id:'gold_smiley',    displayName:'Golden Smiley',    emoji:'😊', skillSource:'Charisma',          slotId:'slot_05', description:"A reminder that a winning smile is worth its weight in gold." },
  { id:'gold_lightning', displayName:'Golden Lightning', emoji:'⚡', skillSource:'Agility',           slotId:'slot_06', description:"Captured in a bottle, now resting safely near your mousepad." },
  { id:'gold_oak_leaf',  displayName:'Golden Oak Leaf',  emoji:'🍂', skillSource:'Woodcutting',       slotId:'slot_07', description:"Never wilts, never fades, entirely impractical for photosynthesis." },
  { id:'gold_book',      displayName:'Golden Book',      emoji:'📖', skillSource:'Magic',             slotId:'slot_08', description:"The pages are solid gold, making it a very heavy read." },
  { id:'gold_sword',     displayName:'Golden Sword',     emoji:'⚔️', skillSource:'Combat',            slotId:'slot_09', description:"Perfectly balanced, though mostly used for opening letters." },
  { id:'gold_shield',    displayName:'Golden Shield',    emoji:'🛡️', skillSource:'Defense',           slotId:'slot_10', description:"A steadfast protector against spilled coffee and minor drafts." },
  { id:'gold_bow',       displayName:'Golden Bow',       emoji:'🏹', skillSource:'Ranged',            slotId:'slot_11', description:"Strung with a sunbeam, it rests proudly on your top shelf." },
  { id:'gold_potion',    displayName:'Golden Potion',    emoji:'🧪', skillSource:'Herblore',          slotId:'slot_12', description:"Do not drink; the liquid inside has solidified into pure bullion." },
  { id:'gold_seed',      displayName:'Golden Seed',      emoji:'🌱', skillSource:'Farming',           slotId:'slot_13', description:"Planting this will only yield a highly confused local economy." },
  { id:'gold_gem',       displayName:'Golden Gem',       emoji:'💎', skillSource:'Crafting',          slotId:'slot_14', description:"Cut to absolute perfection, forever catching the light from your monitor." },
  { id:'gold_stopwatch', displayName:'Golden Stopwatch', emoji:'⏱️', skillSource:'Thieving',          slotId:'slot_15', description:"Time is money, and this watch is literally both." },
  { id:'gold_flame',     displayName:'Golden Flame',     emoji:'🔥', skillSource:'Firewall',          slotId:'slot_16', description:"It burns brightly forever, yet remains completely cool to the touch." },
  { id:'gold_target',    displayName:'Golden Target',    emoji:'🎯', skillSource:'Fletching',         slotId:'slot_17', description:"You hit the bullseye so hard they decided to gild the board." },
  { id:'gold_feather',   displayName:'Golden Feather',   emoji:'🪶', skillSource:'Hunter',            slotId:'slot_18', description:"Plucked from a legendary bird that no one actually believes you caught." },
];

// 18 slot positions — pixel-measured from workdesk.png (2000×1103)
// Top row: 10 slots  |  Bottom row: 8 slots
const DESK_SLOTS = [
  // ── Top row (left → right) ──────────────────────────────────────────
  { id:'slot_01', x:0.195, y:0.528 },
  { id:'slot_02', x:0.258, y:0.528 },
  { id:'slot_03', x:0.321, y:0.528 },
  { id:'slot_04', x:0.384, y:0.528 },
  { id:'slot_05', x:0.447, y:0.528 },
  { id:'slot_06', x:0.510, y:0.528 },
  { id:'slot_07', x:0.573, y:0.528 },
  { id:'slot_08', x:0.636, y:0.528 },
  { id:'slot_09', x:0.699, y:0.528 },
  { id:'slot_10', x:0.762, y:0.528 },
  // ── Bottom row (left → right) ────────────────────────────────────────
  { id:'slot_11', x:0.220, y:0.585 },
  { id:'slot_12', x:0.302, y:0.585 },
  { id:'slot_13', x:0.384, y:0.585 },
  { id:'slot_14', x:0.466, y:0.585 },
  { id:'slot_15', x:0.547, y:0.585 },
  { id:'slot_16', x:0.629, y:0.585 },
  { id:'slot_17', x:0.711, y:0.585 },
  { id:'slot_18', x:0.793, y:0.585 },
];

// 8 broadcast templates (GDD spec) — {PlayerName}, {OrnamentName}, {SkillName} are replaced at runtime
const BROADCAST_TEMPLATES = [
  "🔥 GLOBAL: {PlayerName} just unearthed the {OrnamentName} for their Work Desk!",
  "✨ GLOBAL: Hard work pays off! {PlayerName} found the elusive {OrnamentName} while training {SkillName}!",
  "🏆 GLOBAL: A new trophy acquired! {PlayerName} completed a {SkillName} minigame and claimed the {OrnamentName}.",
  "⚡ GLOBAL: Lightning strikes! {PlayerName} just added the incredibly rare {OrnamentName} to their collection!",
  "🌟 GLOBAL: The grind is real. {PlayerName} just snapped the {OrnamentName} onto their Work Desk!",
  "🛠️ GLOBAL: Flawless execution! A {SkillName} minigame just rewarded {PlayerName} with the legendary {OrnamentName}.",
  "💎 GLOBAL: {PlayerName}'s desk just got a little shinier! Give it up for the new owner of the {OrnamentName}!",
  "🎯 GLOBAL: Bullseye! {PlayerName} scored the rare {OrnamentName} from the {SkillName} minigames!",
];

// Desk completion milestone definitions
const DESK_MILESTONES = [
  { count:3,  title:'The Decorator',   desc:'3 Ornaments Collected!',   reward:'title' },
  { count:9,  title:null,              desc:'Halfway There! Desk Upgraded.', reward:'desk_upgrade' },
  { count:18, title:'The Curator',     desc:'Full Desk! Legendary Status.', reward:'full_desk' },
];

const ORNAMENT_DROP_RATE = 1 / 2000;

// Track minigame completions per ornament so Collection Log can show them
let playerDeskState = {
  unlockedOrnamentIds:     [],  // string[]
  obtainedTimestamps:      {},  // { id: unixMs }
  obtainedFromSkill:       {},  // { id: skillKey }
  obtainedAtCompletion:    {},  // { id: totalCompletionCount }
  totalMinigameCompletions: 0,  // running total across all skills
  milestonesAwarded:       [],  // e.g. ['3','9','18']
  deskHasUpgrade:          false,
  deskHasAura:             false,
  hasSeenTutorial:         false,
};

// Active desk tab: 'overview' | 'collection'
let _deskActiveTab = 'overview';

const _broadcastQueue = [];
let _broadcastTimer = null;
const BROADCAST_THROTTLE_MS = 5000;

/* ── Tutorial popup (fires once, first time player opens the desk) ───── */
function maybeShowDeskTutorial() {
  if (playerDeskState.hasSeenTutorial) return;
  playerDeskState.hasSeenTutorial = true;
  save();

  const pop = document.createElement('div');
  pop.style.cssText = 'position:fixed;inset:0;z-index:500000;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;font-family:VT323,monospace;';
  pop.innerHTML = `
    <div style="background:linear-gradient(160deg,#1a1000,#0d0800);border:3px solid #f1c40f;border-radius:10px;
      padding:32px 44px;max-width:500px;text-align:center;box-shadow:0 0 60px rgba(241,196,15,0.5);">
      <div style="font-size:3.5rem;margin-bottom:6px">🖥️</div>
      <div style="font-size:2.4rem;color:#f1c40f;text-shadow:0 0 16px #f1c40f;margin-bottom:14px">WELCOME TO YOUR WORK DESK!</div>
      <div style="font-size:1.15rem;color:#ddd;line-height:1.7;margin-bottom:20px">
        As you complete skill minigames, you have a rare chance to discover <strong style="color:#f1c40f">Golden Ornaments</strong>.<br>
        Keep grinding, collect them all, and turn this empty desk into a shrine of your achievements!
      </div>
      <button id="desk-tut-ok" style="padding:10px 40px;background:linear-gradient(90deg,#f1c40f,#ff8800);
        border:3px solid #fff;color:#000;font-family:VT323,monospace;font-size:1.8rem;cursor:pointer;
        box-shadow:4px 4px 0 #000;">LET'S GET TO WORK</button>
    </div>`;
  document.body.appendChild(pop);
  document.getElementById('desk-tut-ok').onclick = () => pop.remove();
}

/* ── Drop check: call after every successful minigame completion ──────── */
function checkOrnamentDrop(skillKey) {
  // Increment global completion counter
  playerDeskState.totalMinigameCompletions++;

  if (Math.random() >= ORNAMENT_DROP_RATE) return;

  const owned     = new Set(playerDeskState.unlockedOrnamentIds);
  const available = ALL_ORNAMENTS.filter(o => !owned.has(o.id));

  if (available.length === 0) {
    myCoins += 5000;
    updateUI(); save();
    showConsolationReward();
    return;
  }

  const dropped = available[Math.floor(Math.random() * available.length)];

  playerDeskState.unlockedOrnamentIds.push(dropped.id);
  playerDeskState.obtainedTimestamps[dropped.id]   = Date.now();
  playerDeskState.obtainedFromSkill[dropped.id]    = skillKey;
  playerDeskState.obtainedAtCompletion[dropped.id] = playerDeskState.totalMinigameCompletions;
  save();

  // Check milestone rewards before animation so title is updated
  checkDeskMilestones();

  triggerOrnamentDropAnimation(dropped, skillKey, () => {
    broadcastOrnamentDrop(dropped, skillKey);
    updateDeskProgressLabel();
    renderDeskOverlay();
  });
}

/* ── Milestone checker ────────────────────────────────────────────────── */
function checkDeskMilestones() {
  const count = playerDeskState.unlockedOrnamentIds.length;
  for (const ms of DESK_MILESTONES) {
    const key = String(ms.count);
    if (count >= ms.count && !playerDeskState.milestonesAwarded.includes(key)) {
      playerDeskState.milestonesAwarded.push(key);
      save();
      if (ms.reward === 'desk_upgrade') {
        playerDeskState.deskHasUpgrade = true;
        save();
      }
      if (ms.reward === 'full_desk') {
        playerDeskState.deskHasAura = true;
        save();
      }
      showDeskMilestonePopup(ms, count);
    }
  }
}

function showDeskMilestonePopup(ms, count) {
  const pop = document.createElement('div');
  pop.style.cssText = 'position:fixed;top:38%;left:50%;transform:translate(-50%,-50%) scale(0.5);opacity:0;' +
    'background:linear-gradient(135deg,#1a1000,#2a1800);border:3px solid #f1c40f;border-radius:10px;' +
    'padding:24px 44px;z-index:400005;text-align:center;font-family:VT323,monospace;' +
    'box-shadow:0 0 60px rgba(241,196,15,0.8);pointer-events:none;' +
    'transition:transform 0.4s cubic-bezier(0.2,1.5,0.4,1),opacity 0.3s;';
  const titleLine = ms.title ? `<div style="font-size:1.6rem;color:#f1c40f;margin-top:6px">New Title: <strong>${ms.title}</strong></div>` : '';
  const extraLine = ms.reward === 'desk_upgrade' ? '<div style="font-size:1rem;color:#c89fff;margin-top:4px">🪵 Your desk texture has been upgraded!</div>' : '';
  const auraLine  = ms.reward === 'full_desk'    ? '<div style="font-size:1rem;color:#f1c40f;margin-top:4px">✨ Golden aura unlocked! Your name in chat glows forever.</div>' : '';
  pop.innerHTML = `
    <div style="font-size:3rem;margin-bottom:4px">🖥️</div>
    <div style="font-size:2.2rem;color:#f1c40f;text-shadow:0 0 18px #f1c40f">DESK MILESTONE!</div>
    <div style="font-size:1.4rem;color:#fff;margin:4px 0">${ms.desc}</div>
    ${titleLine}${extraLine}${auraLine}`;
  document.body.appendChild(pop);
  requestAnimationFrame(() => { pop.style.transform='translate(-50%,-50%) scale(1)'; pop.style.opacity='1'; });
  setTimeout(() => {
    pop.style.opacity='0'; pop.style.transform='translate(-50%,-50%) scale(0.85)';
    setTimeout(() => pop.remove(), 380);
  }, 4000);
}

/* ── Full GDD animation sequence (~3.5s) ─────────────────────────────── */
function triggerOrnamentDropAnimation(ornament, skillKey, onComplete) {
  const overlay = document.getElementById('ornament-drop-overlay');
  if (!overlay) { if (onComplete) onComplete(); return; }

  // Populate content
  const emojiEl     = document.getElementById('ornament-drop-emoji');
  const nameEl      = document.getElementById('ornament-drop-name');
  const descEl      = document.getElementById('ornament-drop-desc');
  const skillEl     = document.getElementById('ornament-drop-skill');
  const lightShaft  = document.getElementById('ornament-drop-shaft');
  if (emojiEl)  emojiEl.innerText  = ornament.emoji;
  if (nameEl)   nameEl.innerText   = ornament.displayName;
  if (descEl)   descEl.innerText   = ornament.description;
  if (skillEl)  skillEl.innerText  = `Discovered via: ${ornament.skillSource}`;
  if (lightShaft) lightShaft.style.opacity = '0';

  overlay.style.display = 'flex';
  overlay.classList.remove('drop-enter','drop-reveal','drop-slottify','drop-fly');
  void overlay.offsetWidth;

  // Phase 1 — 0.0s: heavy vignette dims in
  overlay.classList.add('drop-enter');

  // Phase 2 — 0.5s: light shaft + ornament spins in + particles
  setTimeout(() => {
    overlay.classList.add('drop-reveal');
    if (lightShaft) {
      lightShaft.style.transition = 'opacity 0.3s';
      lightShaft.style.opacity = '1';
    }
    spawnDropParticles();
  }, 500);

  // Phase 3 — 2.0s: desk fades in behind, ornament "flies to slot"
  setTimeout(() => {
    overlay.classList.add('drop-slottify');
    if (lightShaft) { lightShaft.style.opacity = '0'; }
  }, 2000);

  // Phase 4 — 3.0s: golden dust puff, settle
  setTimeout(() => {
    spawnSettleDust();
  }, 3000);

  // Phase 5 — 3.5s: fade out + return to game
  setTimeout(() => {
    overlay.classList.add('drop-fly');
    setTimeout(() => {
      overlay.style.display = 'none';
      overlay.classList.remove('drop-enter','drop-reveal','drop-slottify','drop-fly');
      if (onComplete) onComplete();
    }, 500);
  }, 3000);
}

function spawnDropParticles() {
  const container = document.getElementById('ornament-drop-particles');
  if (!container) return;
  container.innerHTML = '';
  const colors = ['#f1c40f','#fff','#ff8800','#ffe066','#ffd700','#ffcc00'];
  for (let i = 0; i < 32; i++) {
    const p     = document.createElement('div');
    const angle = (i / 32) * 360;
    const dist  = 90 + Math.random() * 140;
    const size  = 4 + Math.random() * 7;
    const color = colors[i % colors.length];
    // Mix in some square confetti
    const isConf = i % 5 === 0;
    p.style.cssText = `
      position:absolute; width:${size}px; height:${size}px;
      background:${color}; border-radius:${isConf ? '2px' : '50%'};
      top:50%; left:50%; transform:translate(-50%,-50%);
      animation:dropParticle${i % 4} 1.4s ${(i * 0.03).toFixed(2)}s ease-out forwards;
      --dx:${(Math.cos(angle*Math.PI/180)*dist).toFixed(1)}px;
      --dy:${(Math.sin(angle*Math.PI/180)*dist).toFixed(1)}px;
      box-shadow:0 0 5px ${color};`;
    container.appendChild(p);
  }
}

function spawnSettleDust() {
  const container = document.getElementById('ornament-drop-particles');
  if (!container) return;
  for (let i = 0; i < 10; i++) {
    const p = document.createElement('div');
    const ox = (Math.random()-0.5) * 60;
    p.style.cssText = `
      position:absolute; width:6px; height:6px; background:#f1c40f;
      border-radius:50%; top:50%; left:50%;
      transform:translate(calc(-50% + ${ox}px),-50%);
      animation:dropParticle${i%4} 0.8s ${i*0.05}s ease-out forwards;
      --dx:${ox.toFixed(1)}px; --dy:-${20+Math.random()*30}px;
      opacity:0.8;`;
    container.appendChild(p);
  }
}

/* ── Consolation reward ───────────────────────────────────────────────── */
function showConsolationReward() {
  const pop = document.createElement('div');
  pop.style.cssText = 'position:fixed;top:40%;left:50%;transform:translate(-50%,-50%) scale(0.6);opacity:0;' +
    'background:linear-gradient(135deg,#1a1000,#2a1500);border:3px solid #f1c40f;border-radius:8px;' +
    'padding:24px 44px;z-index:300005;text-align:center;font-family:VT323,monospace;' +
    'box-shadow:0 0 50px rgba(241,196,15,0.7);pointer-events:none;' +
    'transition:transform 0.35s cubic-bezier(0.2,1.5,0.4,1),opacity 0.3s;';
  pop.innerHTML = `
    <div style="font-size:2.8rem">🖥️✨</div>
    <div style="font-size:2rem;color:#f1c40f;margin:6px 0">DESK COMPLETE!</div>
    <div style="font-size:1.2rem;color:#ddd">You already have all ornaments!</div>
    <div style="font-size:1.6rem;color:#00ffcc;margin-top:8px">+5,000 💰 COINS</div>`;
  document.body.appendChild(pop);
  requestAnimationFrame(() => { pop.style.transform='translate(-50%,-50%) scale(1)'; pop.style.opacity='1'; });
  setTimeout(() => {
    pop.style.opacity='0'; pop.style.transform='translate(-50%,-50%) scale(0.85)';
    setTimeout(() => pop.remove(), 350);
  }, 3200);
}

/* ── Broadcast — picks random template ───────────────────────────────── */
function broadcastOrnamentDrop(ornament, skillKey) {
  if (!myUser) return;
  const template = BROADCAST_TEMPLATES[Math.floor(Math.random() * BROADCAST_TEMPLATES.length)];
  const skillDisplay = ornament.skillSource || skillKey || 'Minigame';
  const msg = template
    .replace('{PlayerName}',   myUser)
    .replace('{OrnamentName}', ornament.displayName)
    .replace('{SkillName}',    skillDisplay);
  _broadcastQueue.push(msg);

  if (!_broadcastTimer) {
    _broadcastTimer = setTimeout(() => {
      if (_broadcastQueue.length === 1) {
        showGlobalBroadcast(_broadcastQueue[0]);
      } else {
        showGlobalBroadcast(`💎 GLOBAL: ${_broadcastQueue.length} rare ornaments were discovered across the office! Amazing work, team!`);
      }
      _broadcastQueue.length = 0;
      _broadcastTimer = null;
    }, BROADCAST_THROTTLE_MS);
  }
}

function showGlobalBroadcast(message) {
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;top:14px;left:50%;transform:translateX(-50%) translateY(-70px);' +
    'background:linear-gradient(90deg,#1a0d00,#0a0500);border:2px solid #f1c40f;border-radius:4px;' +
    'padding:9px 24px;font-family:VT323,monospace;font-size:1.1rem;color:#f1c40f;z-index:400000;' +
    'pointer-events:none;box-shadow:0 0 24px rgba(241,196,15,0.55);max-width:90vw;text-align:center;' +
    'transition:transform 0.4s cubic-bezier(0.2,1.4,0.4,1),opacity 0.4s;';
  el.innerText = message;
  document.body.appendChild(el);
  requestAnimationFrame(() => { el.style.transform='translateX(-50%) translateY(0)'; });
  setTimeout(() => {
    el.style.opacity='0'; el.style.transform='translateX(-50%) translateY(-70px)';
    setTimeout(() => el.remove(), 450);
  }, 6000);
}

/* ── Desk overlay rendering ───────────────────────────────────────────── */
function renderDeskOverlay() {
  const owned   = new Set(playerDeskState.unlockedOrnamentIds);
  const total   = ALL_ORNAMENTS.length;
  const count   = owned.size;

  // Update subtitle and progress
  const subtitle = document.getElementById('workdesk-subtitle');
  if (subtitle) subtitle.innerText = `${count} / ${total} ornaments discovered`;

  // Apply desk texture upgrade at 9/18
  const scene = document.getElementById('workdesk-scene');
  if (scene) {
    if (playerDeskState.deskHasUpgrade) scene.classList.add('desk-upgraded');
    else scene.classList.remove('desk-upgraded');
  }

  // Apply golden aura at 18/18
  const panel = document.getElementById('workdesk-panel');
  if (panel) {
    if (playerDeskState.deskHasAura) panel.classList.add('desk-full-aura');
    else panel.classList.remove('desk-full-aura');
  }

  // Render whichever tab is active
  if (_deskActiveTab === 'overview') renderDeskOverviewTab(owned);
  else renderDeskCollectionTab(owned);
}

/* ── Tab 1: Overview — desk image + positioned slot ornaments ─────────── */
function renderDeskOverviewTab(owned) {
  const slotsLayer = document.getElementById('workdesk-slots-layer');
  if (!slotsLayer) return;
  slotsLayer.innerHTML = '';

  for (const ornament of ALL_ORNAMENTS) {
    const slot = DESK_SLOTS.find(s => s.id === ornament.slotId);
    if (!slot) continue;
    const isUnlocked = owned.has(ornament.id);

    const el = document.createElement('div');
    el.className = 'desk-ornament-slot ' + (isUnlocked ? 'slot-unlocked' : 'slot-locked');
    el.style.left = (slot.x * 100) + '%';
    el.style.top  = (slot.y * 100) + '%';

    if (isUnlocked) {
      // Content — PNG with emoji fallback
      const img = document.createElement('img');
      img.src = `assets/desk_assets/ornaments/${ornament.id}.png`;
      img.alt = ornament.displayName;
      const emojiSpan = document.createElement('span');
      emojiSpan.className = 'slot-emoji';
      emojiSpan.innerText = ornament.emoji;
      emojiSpan.style.display = 'none';
      img.onerror = () => { img.style.display='none'; emojiSpan.style.display='block'; };
      el.appendChild(img);
      el.appendChild(emojiSpan);

      // Rich tooltip (GDD spec: name, skill, date, flavor)
      const ts    = playerDeskState.obtainedTimestamps[ornament.id];
      const skill = playerDeskState.obtainedFromSkill[ornament.id] || ornament.skillSource;
      const date  = ts ? new Date(ts).toLocaleDateString() : '?';
      const tip   = buildOrnamentTooltip(ornament, skill, date, true);
      el.appendChild(tip);
    } else {
      // Wireframe silhouette + locked tooltip
      el.innerHTML = `<span class="slot-wireframe">${ornament.emoji}</span>`;
      const tip = buildOrnamentTooltip(ornament, ornament.skillSource, null, false);
      el.appendChild(tip);
    }

    slotsLayer.appendChild(el);
  }
}

function buildOrnamentTooltip(ornament, skillSource, date, isUnlocked) {
  const tip = document.createElement('div');
  tip.className = 'desk-slot-tooltip';
  if (isUnlocked) {
    tip.innerHTML = `
      <div class="tip-icon">${ornament.emoji}</div>
      <div class="tip-name">${ornament.displayName}</div>
      <div class="tip-skill">Source: ${skillSource || '?'}</div>
      ${date ? `<div class="tip-date">Obtained: ${date}</div>` : ''}
      <div class="tip-flavor">${ornament.description}</div>`;
  } else {
    tip.innerHTML = `
      <div class="tip-locked-icon">🔒</div>
      <div class="tip-locked-text">??? — Keep completing <strong>${skillSource}</strong> minigames to discover.</div>`;
  }
  return tip;
}

/* ── Tab 2: Collection Log — grid with completion count ──────────────── */
function renderDeskCollectionTab(owned) {
  const logGrid = document.getElementById('workdesk-log-grid');
  if (!logGrid) return;
  logGrid.innerHTML = '';

  for (const ornament of ALL_ORNAMENTS) {
    const isUnlocked = owned.has(ornament.id);
    const card = document.createElement('div');
    card.className = 'log-card ' + (isUnlocked ? 'log-card-unlocked' : 'log-card-locked');

    if (isUnlocked) {
      const ts         = playerDeskState.obtainedTimestamps[ornament.id];
      const skill      = playerDeskState.obtainedFromSkill[ornament.id] || ornament.skillSource;
      const atCompl    = playerDeskState.obtainedAtCompletion[ornament.id];
      const date       = ts ? new Date(ts).toLocaleDateString() : '?';
      card.innerHTML = `
        <div class="log-emoji">${ornament.emoji}</div>
        <div class="log-name">${ornament.displayName}</div>
        <div class="log-source">${skill}</div>
        <div class="log-date">${date}</div>
        ${atCompl ? `<div class="log-completion">Drop #${atCompl.toLocaleString()}</div>` : ''}`;
    } else {
      card.innerHTML = `
        <div class="log-emoji log-silhouette">${ornament.emoji}</div>
        <div class="log-name log-unknown">???</div>
        <div class="log-source">${ornament.skillSource}</div>`;
    }
    logGrid.appendChild(card);
  }
}

function switchDeskTab(tab) {
  _deskActiveTab = tab;
  const overviewBtn    = document.getElementById('desk-tab-overview');
  const collectionBtn  = document.getElementById('desk-tab-collection');
  const cratesBtn      = document.getElementById('desk-tab-crates');
  const overviewPanel  = document.getElementById('workdesk-overview-panel');
  const collectionPanel= document.getElementById('workdesk-collection-panel');
  const cratesPanel    = document.getElementById('workdesk-crates-panel');

  if (overviewBtn)    overviewBtn.classList.toggle('desk-tab-active',    tab === 'overview');
  if (collectionBtn)  collectionBtn.classList.toggle('desk-tab-active',  tab === 'collection');
  if (cratesBtn)      cratesBtn.classList.toggle('desk-tab-active',      tab === 'crates');
  if (overviewPanel)  overviewPanel.style.display    = tab === 'overview'    ? 'block' : 'none';
  if (collectionPanel)collectionPanel.style.display  = tab === 'collection'  ? 'block' : 'none';
  if (cratesPanel)    cratesPanel.style.display      = tab === 'crates'      ? 'block' : 'none';

  if (tab === 'crates') renderCratesInventory();
  else renderDeskOverlay();
}

function renderCratesInventory() {
  const el = document.getElementById('workdesk-crates-content');
  if (!el) return;

  let equipped = {mouse:null, monitor:null};
  let items = [];
  try {
    const eq = localStorage.getItem('ct_crate_equipped');
    if (eq) equipped = JSON.parse(eq);
    const save = localStorage.getItem('ctcrates');
    if (save) { const d=JSON.parse(save); if(d.items) items=d.items; }
  } catch(e){}

  el.innerHTML = '';

  // ── Equipped loadout row ─────────────────────────────────────────────
  const eqHeader = document.createElement('div');
  eqHeader.style.cssText = 'font-size:.82rem;color:#888;letter-spacing:1px;margin-bottom:10px;';
  eqHeader.textContent = '⚙️ EQUIPPED — shows next to your character';
  el.appendChild(eqHeader);

  const eqRow = document.createElement('div');
  eqRow.style.cssText = 'display:flex;gap:14px;margin-bottom:22px;flex-wrap:wrap;';
  ['mouse','monitor'].forEach(slot => {
    const eq = equipped[slot];
    const lbl = slot==='mouse' ? '🖱️ Mouse' : '🖥️ Monitor';
    const box = document.createElement('div');
    box.style.cssText = 'background:rgba(0,0,0,.5);border:2px solid '+(eq?eq.color:'#2a0044')+
      ';border-radius:8px;padding:10px 14px;text-align:center;min-width:110px;';
    let inner = '<div style="font-size:.75rem;color:#666;margin-bottom:6px;">'+lbl+'</div>';
    if (eq) {
      inner += _crateSprite(eq.type, eq.ri, 80, 72);
      inner += '<div style="font-size:.7rem;color:'+eq.color+';margin-top:5px;">'+eq.name+'</div>';
      inner += '<div style="font-size:.62rem;color:'+eq.color+';opacity:.7;">'+eq.rarity+'</div>';
      inner += '<div style="font-size:.62rem;color:#ffcc00;">🪙 +'+Math.round((GEAR_RARITY_BUFFS[eq.rarity]||0)*100)+'% coins</div>';
    } else {
      inner += '<div style="font-size:1.6rem;color:#2a0044;line-height:72px;">None</div>';
    }
    box.innerHTML = inner;
    if (eq) {
      const uBtn = document.createElement('button');
      uBtn.textContent = '✕ unequip';
      uBtn.style.cssText = 'margin-top:6px;display:block;width:100%;background:none;border:1px solid #ff4444;'+
        'border-radius:3px;color:#ff4444;font-family:Courier New,monospace;font-size:.62rem;cursor:pointer;padding:2px 0;';
      uBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        equipped[slot] = null;
        localStorage.setItem('ct_crate_equipped', JSON.stringify(equipped));
        window._myEquipped = null;
        renderCratesInventory();
      });
      box.appendChild(uBtn);
    }
    eqRow.appendChild(box);
  });
  el.appendChild(eqRow);

  // ── Collection grid ──────────────────────────────────────────────────
  const collHeader = document.createElement('div');
  collHeader.style.cssText = 'font-size:.82rem;color:#888;letter-spacing:1px;margin-bottom:10px;';
  collHeader.textContent = '🗃️ YOUR COLLECTION (' + items.length + ' items) — click to equip';
  el.appendChild(collHeader);

  if (items.length === 0) {
    const empty = document.createElement('div');
    empty.style.cssText = 'text-align:center;color:#444;padding:28px 0;font-size:.95rem;';
    empty.innerHTML = 'No crate loot yet.<br><span style="color:#333;font-size:.8rem;">Open the 🗃️ Crate Shop to get started!</span>';
    el.appendChild(empty);
    return;
  }

  const seen = {};
  items.forEach(it => { const k=it.type+'-'+it.ri; if(!seen[k]) seen[k]={it,cnt:0}; seen[k].cnt++; });

  const grid = document.createElement('div');
  grid.style.cssText = 'display:flex;flex-wrap:wrap;gap:10px;';

  Object.values(seen).forEach(({it, cnt}) => {
    const slot = it.type==='mice' ? 'mouse' : 'monitor';
    const isEq = equipped[slot] && equipped[slot].ri===it.ri && equipped[slot].type===it.type;
    const card = document.createElement('div');
    card.style.cssText = 'width:84px;background:#0a0018;border:2px solid '+(isEq?it.color:'#2a0044')+
      ';border-radius:8px;padding:6px 4px;text-align:center;cursor:pointer;transition:transform .12s;'+
      (isEq?'box-shadow:0 0 12px '+it.color+';':'');
    const buffPct = Math.round((GEAR_RARITY_BUFFS[it.rarity]||0)*100);
    card.innerHTML = _crateSprite(it.type, it.ri, 70, 63)+
      '<div style="font-size:.62rem;color:#c89fff;margin-top:4px;line-height:1.2;">'+it.name+'</div>'+
      '<div style="font-size:.58rem;color:'+it.color+';margin-top:1px;">'+it.rarity+(cnt>1?' ×'+cnt:'')+'</div>'+
      '<div style="font-size:.58rem;color:#ffcc00;margin-top:1px;">🪙 +'+buffPct+'%</div>'+
      '<div style="font-size:.58rem;margin-top:2px;padding:1px 0;border:1px solid '+(isEq?'#00ff88':'#9900ff')+
      ';border-radius:3px;color:'+(isEq?'#00ff88':'#bb44ff')+';">'+(isEq?'✅ on':'⚙️ equip')+'</div>';
    card.addEventListener('mouseenter', ()=>{ card.style.transform='scale(1.07)'; });
    card.addEventListener('mouseleave', ()=>{ card.style.transform='scale(1)'; });
    card.addEventListener('click', () => {
      if (isEq) {
        equipped[slot] = null;
      } else {
        equipped[slot] = {type:it.type, ri:it.ri, name:it.name, rarity:it.rarity, color:it.color};
      }
      localStorage.setItem('ct_crate_equipped', JSON.stringify(equipped));
      window._myEquipped = null; // force poll to pick up change
      renderCratesInventory();
    });
    grid.appendChild(card);
  });
  el.appendChild(grid);
}

function updateDeskProgressLabel() {
  const count = playerDeskState.unlockedOrnamentIds.length;
  const el    = document.getElementById('desk-progress-label');
  if (el) el.innerText = `${count} / ${ALL_ORNAMENTS.length} ornaments`;
}

/* ══ PLAYER CARD SYSTEM ═══════════════════════════════════════════════════ */
const OFFICE_EMOJIS=['🖥️','📋','☕','📊','💼','📎','🖨️','📌','✏️','📞','🔑','💾','📝','🗂️','⌨️','🖱️'];
function emojiForName(name){ let h=0; for(let i=0;i<name.length;i++) h=(h*31+name.charCodeAt(i))&0xffff; return OFFICE_EMOJIS[h%OFFICE_EMOJIS.length]; }
const activePlayers={};

function _avatarSpriteHTML(faceIndex) {
  const FACE_COORDS = [
    {r:0,c:0},{r:0,c:1},{r:0,c:2},{r:0,c:3},{r:0,c:4},{r:0,c:5},
    {r:1,c:0},{r:1,c:1},{r:1,c:2},{r:1,c:3},{r:1,c:4},{r:1,c:5},
    {r:2,c:0},{r:2,c:1},{r:2,c:2},{r:2,c:3},{r:2,c:4},{r:2,c:5},
    {r:3,c:0},{r:3,c:1},{r:3,c:2},{r:3,c:3},{r:3,c:4},{r:3,c:5},
  ];
  const idx = (typeof faceIndex === 'number' && faceIndex >= 0) ? faceIndex : 0;
  const f = FACE_COORDS[idx % FACE_COORDS.length];
  const px = (f.c / 9 * 100).toFixed(4);
  const py = (f.r / 9 * 100).toFixed(4);
  return `<div style="width:48px;height:48px;background-image:url('assets/character_creator.jpg');background-size:1000% 1000%;background-position:${px}% ${py}%;image-rendering:pixelated;border-radius:6px;"></div>`;
}

function _equippedGearHTML(equipped) {
  if (!equipped) return '';
  let html = '';
  ['mouse','monitor'].forEach(slot => {
    const eq = equipped[slot];
    if (!eq || !eq.type) return;
    html += _crateSprite(eq.type, eq.ri, 46, 42,
      'border:2px solid '+eq.color+';box-shadow:0 0 8px '+eq.color+';border-radius:4px;');
  });
  return html;
}

// Shared sprite helper — returns an HTML string with inline style
// Math: background-size = 9*W x 9*H, background-position = 0 (-ri*H)px
function _crateSprite(type, ri, W, H, extraCss) {
  const src = (type === 'mice') ? 'assets/crates/mice.jpg' : 'assets/crates/monitors.png';
  const bsX = 9 * W, bsY = 9 * H, bpY = -ri * H;
  // Single quotes inside url() — safe inside style="..." double-quoted attributes
  return '<div style="width:'+W+'px;height:'+H+'px;'
    + "background-image:url('" + src + "');"
    + 'background-size:'+bsX+'px '+bsY+'px;'
    + 'background-position:0px '+bpY+'px;'
    + 'image-rendering:pixelated;background-repeat:no-repeat;'
    + (extraCss||'') + '"></div>';
}

function upsertPlayerCard(username, faceIndex, equipped){
  const row=document.getElementById('player-row'); if(!row) return;
  if(activePlayers[username]){
    activePlayers[username].lastSeen=Date.now();
    if(equipped !== undefined){
      const gearEl=document.querySelector('#pcard-'+username+' .player-gear');
      if(gearEl) gearEl.innerHTML=_equippedGearHTML(equipped);
    }
    return;
  }
  const isMe=(username===myUser);
  const fi=isMe?playerAvatar.faceIndex:(faceIndex||0);
  const eq=isMe?(window._myEquipped||null):(equipped||null);
  const card=document.createElement('div');
  card.className='player-card'+(isMe?' is-me':'');
  card.id='pcard-'+username;
  card.style.cursor='pointer';
  card.title='View '+username+"'s collection";
  // Face + gear side by side, nametag below
  card.innerHTML=
    '<div class="player-card-face">'+
      '<div class="player-avatar">'+_avatarSpriteHTML(fi)+'</div>'+
      '<div class="player-gear">'+_equippedGearHTML(eq)+'</div>'+
    '</div>'+
    '<div class="player-nametag">'+username+'</div>';
  card.addEventListener('click', ()=>{
    if(username===myUser){
      const ov=document.getElementById('workdesk-overlay');
      if(ov){ov.style.display='flex'; switchDeskTab('crates');}
    } else {
      openPlayerCollection(username);
    }
  });
  row.appendChild(card);
  activePlayers[username]={card,lastSeen:Date.now()};
}

function openPlayerCollection(username) {
  const snap = (window._lastEmployeeSnap||{})[username]||{};
  const fi = snap.faceIndex||0;
  const equipped = snap.equipped||{};
  const items = snap.crateItems||[];

  // Remove old modal if exists
  const old=document.getElementById('pcm-overlay'); if(old) old.remove();

  const overlay=document.createElement('div');
  overlay.id='pcm-overlay';
  overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:400000;display:flex;align-items:center;justify-content:center;';
  overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.remove();});

  const panel=document.createElement('div');
  panel.style.cssText='background:#0d0020;border:2px solid #cc44ff;border-radius:12px;padding:24px 28px;max-width:560px;width:94%;max-height:90vh;overflow-y:auto;position:relative;';

  const closeBtn=document.createElement('button');
  closeBtn.innerHTML='✕';
  closeBtn.style.cssText='position:absolute;top:8px;right:12px;background:none;border:none;color:#666;font-size:1.8rem;cursor:pointer;';
  closeBtn.addEventListener('click',()=>overlay.remove());
  panel.appendChild(closeBtn);

  // Header: avatar + name
  const header=document.createElement('div');
  header.style.cssText='display:flex;align-items:center;gap:14px;margin-bottom:20px;';
  header.innerHTML=_avatarSpriteHTML(fi)+
    '<div><div style="font-size:1.6rem;color:#cc44ff;font-family:VT323,monospace;">'+username+'</div>'+
    '<div style="font-size:.8rem;color:#666;">'+items.length+' crate item'+(items.length!==1?'s':'')+' collected</div></div>';
  panel.appendChild(header);

  // Equipped gear
  const eqLabel=document.createElement('div');
  eqLabel.style.cssText='font-size:.8rem;color:#888;letter-spacing:1px;margin-bottom:8px;';
  eqLabel.textContent='⚙️ EQUIPPED GEAR';
  panel.appendChild(eqLabel);

  const eqRow=document.createElement('div');
  eqRow.style.cssText='display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap;';
  ['mouse','monitor'].forEach(slot=>{
    const eq=equipped[slot];
    const lbl=slot==='mouse'?'🖱️ Mouse':'🖥️ Monitor';
    const box=document.createElement('div');
    box.style.cssText='background:rgba(0,0,0,.5);border:2px solid '+(eq?eq.color:'#333')+';border-radius:8px;padding:8px 12px;text-align:center;min-width:100px;';
    box.innerHTML='<div style="font-size:.7rem;color:#666;margin-bottom:5px;">'+lbl+'</div>';
    if(eq){
      box.innerHTML+=_crateSprite(eq.type,eq.ri,72,65);
      box.innerHTML+='<div style="font-size:.65rem;color:'+eq.color+';margin-top:4px;">'+eq.name+'</div>';
    } else {
      box.innerHTML+='<div style="color:#333;font-size:1.4rem;line-height:65px;">—</div>';
    }
    eqRow.appendChild(box);
  });
  panel.appendChild(eqRow);

  // Collection grid
  const collLabel=document.createElement('div');
  collLabel.style.cssText='font-size:.8rem;color:#888;letter-spacing:1px;margin-bottom:10px;';
  collLabel.textContent='🗃️ COLLECTION ('+items.length+' items)';
  panel.appendChild(collLabel);

  const grid=document.createElement('div');
  grid.style.cssText='display:flex;flex-wrap:wrap;gap:8px;';
  if(items.length>0){
    const seen={};
    items.forEach(it=>{const k=it.type+'-'+it.ri;if(!seen[k])seen[k]={it,cnt:0};seen[k].cnt++;});
    Object.values(seen).forEach(({it,cnt})=>{
      const card=document.createElement('div');
      card.style.cssText='width:78px;background:#0f001a;border:2px solid '+it.color+';border-radius:8px;padding:5px 3px;text-align:center;';
      card.innerHTML=_crateSprite(it.type,it.ri,64,58)+
        '<div style="font-size:.6rem;color:#c89fff;margin-top:3px;line-height:1.2;">'+it.name+'</div>'+
        '<div style="font-size:.58rem;color:'+it.color+';">'+it.rarity+(cnt>1?' \xd7'+cnt:'')+'</div>';
      grid.appendChild(card);
    });
  } else {
    grid.innerHTML='<div style="color:#444;font-size:.9rem;padding:20px 0;width:100%;text-align:center;">No crate items yet</div>';
  }
  panel.appendChild(grid);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);
}

function removePlayerCard(username){
  const d=activePlayers[username]; if(!d) return;
  d.card.style.transition='opacity 0.35s,transform 0.35s';
  d.card.style.opacity='0'; d.card.style.transform='scale(0.5) translateY(20px)';
  setTimeout(()=>{ try{d.card.remove();}catch(e){} delete activePlayers[username]; },380);
}
function flashPlayerCard(username){
  const d=activePlayers[username]; if(!d) return;
  d.card.classList.add('attacking');
  setTimeout(()=>d.card.classList.remove('attacking'),200);
}
function watchEmployees(){
  if(!employeesRef) return;
  employeesRef.on('value',snap=>{
    const data=snap.val()||{}, current=new Set(Object.keys(data));
    window._lastEmployeeSnap = data; // cache for collection viewer
    for(const n of current){
      const eq = (n !== myUser) ? (data[n]?.equipped || undefined) : undefined;
      upsertPlayerCard(n, data[n]?.faceIndex, eq);
    }
    for(const n of Object.keys(activePlayers)) if(!current.has(n)) removePlayerCard(n);
  });
}
function registerEmployee(username){
  if(!employeesRef) return;
  const ref=employeesRef.child(username);
  // Register presence only — equipped gear is handled by localStorage polling below
  ref.set({online:true, joined:Date.now(), faceIndex: playerAvatar.faceIndex||0});
  ref.onDisconnect().remove();
}

/* ══ CUBICLE PLAQUES ══════════════════════════════════════════════════════ */
function refreshCubicle(){
  const title = getPrestigeTitle(prestigeCount);
  document.querySelectorAll('.cubicle-plaque').forEach((el,i)=>{
    if(i===0 && myUser){
      el.innerText = myUser;
      const badge = el.previousElementSibling;
      if(badge && badge.classList.contains('cubicle-title-badge')){
        badge.innerText = title || '';
        badge.style.display = title ? 'block' : 'none';
      }
    }
  });
}

/* ══ LOOT ════════════════════════════════════════════════════════════════ */
const lootTable=[
  {name:'Coffee Mug',emoji:'☕',rarity:'common',bonus:0.03,desc:'+3% DMG'},
  {name:'Sticky Note',emoji:'📝',rarity:'common',bonus:0.03,desc:'+3% DMG'},
  {name:'USB Drive',emoji:'💾',rarity:'uncommon',bonus:0.06,desc:'+6% DMG'},
  {name:'Laser Pointer',emoji:'🔴',rarity:'uncommon',bonus:0.06,desc:'+6% DMG'},
  {name:'Energy Drink',emoji:'⚡',rarity:'uncommon',bonus:0.08,desc:'+8% DMG'},
  {name:'Gold Stapler',emoji:'🔩',rarity:'rare',bonus:0.12,desc:'+12% DMG'},
  {name:'VPN Token',emoji:'🔐',rarity:'rare',bonus:0.15,desc:'+15% DMG'},
  {name:'Employee of Month',emoji:'🏆',rarity:'legendary',bonus:0.25,desc:'+25% DMG'},
  {name:'Briefcase of Cash',emoji:'💼',rarity:'legendary',bonus:0.40,desc:'+40% DMG'},
];
function rollLoot(x, y){
  const roll = Math.random();
  const legendThresh  = 0.008 + milestoneBonuses.legendary_rate;
  const rareThresh    = 0.030;
  const uncommonThresh= 0.090 + milestoneBonuses.loot_rate;
  const commonThresh  = 0.150 + milestoneBonuses.loot_rate;
  let pool;
  if     (roll < legendThresh)   pool = lootTable.filter(i=>i.rarity==='legendary');
  else if(roll < rareThresh)     pool = lootTable.filter(i=>i.rarity==='rare');
  else if(roll < uncommonThresh) pool = lootTable.filter(i=>i.rarity==='uncommon');
  else if(roll < commonThresh)   pool = lootTable.filter(i=>i.rarity==='common');
  else return;
  const item = pool[Math.floor(Math.random()*pool.length)];
  if(!myInventory[item.name]) myInventory[item.name]={...item,count:0};
  myInventory[item.name].count++;
  recalcItemBuff(); renderInventory(); save();
  const colorMap={legendary:'#FFD700',rare:'#3498db',uncommon:'#2ecc71',common:'#fff'};
  const pop=document.createElement('div'); pop.className='loot-popup';
  pop.innerText=item.emoji+' '+item.name+'!';
  const tx=(Math.random()-0.5)*120,ty=-80-Math.random()*60,rot=(Math.random()-0.5)*20;
  pop.style.cssText=`left:${x}px;top:${y}px;--tx:${tx}px;--ty:${ty}px;--rot:${rot}deg;color:${colorMap[item.rarity]};`;
  document.body.appendChild(pop); setTimeout(()=>pop.remove(),3500);
}
function recalcItemBuff(){
  let t=0; for(const k in myInventory) t+=myInventory[k].bonus*myInventory[k].count;
  itemBuffMultiplier=1+t;
  const el=document.getElementById('loot-buff'); if(el) el.innerText=Math.round(t*100);
}
function renderInventory(){
  const grid=document.getElementById('inventory-grid'); if(!grid) return;
  grid.innerHTML='';
  for(const k in myInventory){
    const item=myInventory[k];
    const div=document.createElement('div'); div.className='inv-item rarity-'+item.rarity;
    div.innerHTML=`<span style="font-size:22px">${item.emoji}</span><span class="inv-count">${item.count}</span><div class="inv-tooltip">${item.name}<br>${item.desc}</div>`;
    grid.appendChild(div);
  }
}

/* ══ INIT ════════════════════════════════════════════════════════════════ */
function initSystem(){
  const bImg=document.getElementById('boss-image');
  if(bImg){ bImg.src='assets/phases/dave/dave_phase1.png'; triggerBossEntrance(); }
  startRichardLoop();
  renderInventory(); recalcItemBuff();
  renderSkillPanel(); recalcMilestoneBonuses();
  if(myAutoDmg>0) startAutoTimer();
  watchEmployees();
  updateDeskProgressLabel();
  renderDeskOverlay();
  initSeasonalBoss();
  if(authReady) load();
  else {
    const local = localStorage.getItem('gwm_v14') || localStorage.getItem('gwm_v13');
    if(local) { applyPayload(JSON.parse(local)); renderDeskOverlay(); updateDeskProgressLabel(); }
  }
}

function autoLoginIfSaved(){
  const local = localStorage.getItem('gwm_v14') || localStorage.getItem('gwm_v13');
  if(!local) return false;
  try {
    const d = JSON.parse(local);
    if(d.u && d.u.trim()){
      myUser = d.u.trim();
      try { localStorage.setItem('ct_player_username', myUser); } catch(e) {}
      const loginScreen = document.getElementById('login-screen');
      const gameContainer = document.getElementById('game-container');
      if(loginScreen) loginScreen.style.display='none';
      if(gameContainer) gameContainer.style.display='block';
      bgm.play().catch(()=>{});
      upsertPlayerCard(myUser); registerEmployee(myUser); refreshCubicle(); updateUI(); applyGearBuffs();
      setTimeout(() => enforceIdBadge(), 800);
      return true;
    }
  } catch(e){}
  return false;
}
function triggerBossEntrance(){
  const bImg=document.getElementById('boss-image'); if(!bImg) return;
  bImg.classList.remove('boss-enter'); void bImg.offsetWidth;
  bImg.classList.add('boss-enter');
  bImg.addEventListener('animationend',()=>bImg.classList.remove('boss-enter'),{once:true});
}
function shakeArena(){
  const a=document.getElementById('battle-arena'); if(!a) return;
  a.classList.add('shaking'); setTimeout(()=>a.classList.remove('shaking'),240);
}

/* ══ INTRO ════════════════════════════════════════════════════════════════ */
let ytPlayer=null, introEnded=false;
const endIntro=()=>{
  if(introEnded) return; introEnded=true;
  try{if(ytPlayer){ytPlayer.stopVideo();ytPlayer.destroy();ytPlayer=null;}}catch(e){}
  const ytEl=document.getElementById('yt-player');
  if(ytEl){ytEl.src='';ytEl.style.display='none';}
  const introContainer=document.getElementById('intro-container');
  glitchTransition(()=>{
    if(introContainer) introContainer.style.display='none';
    initSystem();
    setTimeout(autoLoginIfSaved, 100);
  });
};

// Wire up skip + start buttons once DOM is ready
function _initIntroButtons(){
  // SKIP button — always visible, always works
  const skipBtn = document.getElementById('skip-intro-btn');
  if(skipBtn){ skipBtn.style.display='block'; skipBtn.onclick=endIntro; }

  // INITIALIZE SYSTEM button — show immediately, don't wait for YT
  // If YouTube player is ready when clicked → play video
  // If not ready → just end intro cleanly
  const startBtn = document.getElementById('start-intro-btn');
  if(startBtn){
    startBtn.style.display = 'block';
    startBtn.onclick = () => {
      if(ytPlayer && typeof ytPlayer.playVideo === 'function'){
        startBtn.style.display = 'none';
        const ytEl = document.getElementById('yt-player');
        if(ytEl) ytEl.style.display = 'block';
        ytPlayer.playVideo();
      } else {
        // YT not ready yet — just go straight into the game
        endIntro();
      }
    };
  }

  // Safety: if nothing happens after 12s, auto-proceed
  const _introSafetyTimer = setTimeout(()=>{
    if(introEnded) return;
    endIntro();
  }, 12000);
  window._introSafetyTimer = _introSafetyTimer;
}

window.onYouTubeIframeAPIReady=function(){
  if(window._introSafetyTimer) clearTimeout(window._introSafetyTimer);
  const introContainer=document.getElementById('intro-container');
  if(isOBS||!introContainer||introEnded) return;
  ytPlayer=new YT.Player('yt-player',{
    videoId:'HeKNgnDyD7I',
    playerVars:{playsinline:1,controls:0,disablekb:1,fs:0,modestbranding:1,rel:0,origin:window.location.origin},
    events:{
      onReady:()=>{
        // Player is now ready — start-intro-btn click will work fully
        // Nothing extra needed; button was already shown above
      },
      onStateChange:(e)=>{ if(e.data===0) endIntro(); }
    }
  });
};
function glitchTransition(callback){
  const glitch=document.createElement('div');
  glitch.style.cssText='position:fixed;inset:0;z-index:99998;pointer-events:none;background:#000;opacity:0;';
  document.body.appendChild(glitch);
  const canvas=document.createElement('canvas'); canvas.style.cssText='position:absolute;inset:0;width:100%;height:100%;';
  canvas.width=window.innerWidth; canvas.height=window.innerHeight; glitch.appendChild(canvas);
  const ctx=canvas.getContext('2d'); let frame=0; const total=40;
  const colors=['#ff00ff','#00ffff','#ffffff','#ff0000','#00ff00'];
  function drawGlitch(intensity){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    for(let i=0;i<Math.floor(4+intensity*12);i++){
      ctx.fillStyle=colors[Math.floor(Math.random()*colors.length)];
      ctx.globalAlpha=Math.random()*0.6*intensity;
      ctx.fillRect((Math.random()-0.5)*80*intensity,Math.random()*canvas.height,canvas.width,Math.random()*30*intensity+2);
    }
    ctx.globalAlpha=0.15*intensity; ctx.fillStyle='#000';
    for(let y=0;y<canvas.height;y+=4) ctx.fillRect(0,y,canvas.width,2);
    ctx.globalAlpha=1;
  }
  function animate(){
    frame++; const p=frame/total;
    if(p<0.3){glitch.style.opacity=p/0.3*0.85;drawGlitch(p/0.3);}
    else if(p<0.6){glitch.style.opacity='1';glitch.style.background='#fff';ctx.clearRect(0,0,canvas.width,canvas.height);drawGlitch(1);}
    else if(p<0.7){glitch.style.background='#000';glitch.style.opacity='1';ctx.clearRect(0,0,canvas.width,canvas.height);if(frame===Math.floor(total*0.6)+1)callback();}
    else{const f=1-((p-0.7)/0.3);glitch.style.opacity=Math.max(0,f);drawGlitch(f);if(p>=1){glitch.remove();return;}}
    requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);
}

/* ══ FIREBASE BOSS LISTENER ═══════════════════════════════════════════════ */
if(bossRef){
  bossRef.on('value',snap=>{
    const b=snap.val(); if(!b) return;
    const maxHP=1000000000*b.level;
    currentBossLevel=b.level;

    // Update health bar first, regardless of defeat state
    const fill=document.getElementById('health-bar-fill');
    const txt=document.getElementById('health-text');
    if(fill) fill.style.width=(Math.max(0,b.health/maxHP)*100)+'%';
    if(txt) txt.innerText=Math.max(0,b.health).toLocaleString()+' / '+maxHP.toLocaleString();

    console.log('[Boss Update] Level:', b.level, 'Health:', b.health, 'MaxHP:', maxHP);
    if(b.health<=0) {
      console.log('[Boss] Health <= 0, calling handleDefeat');
      return handleDefeat(b);
    }

    const bName=document.getElementById('main-boss-name');
    const bLevel=document.getElementById('boss-level-badge');
    const armorBadge=document.getElementById('boss-armor-badge');
    const armorPct=document.getElementById('boss-armor-pct');
    const armor=Math.round(getBossArmor()*100);
    if(bName) bName.innerText='Cleaning Manager Jim';
    if(bLevel) bLevel.innerText='LV.'+b.level;
    if(armorBadge) armorBadge.style.display=armor>0?'inline-flex':'none';
    if(armorPct) armorPct.innerText=armor;
    const bossNameH1=document.getElementById('boss-name');
    if(bossNameH1) bossNameH1.innerText='⚔ CLEANING MANAGER JIM — LEVEL '+b.level;
    const bImg=document.getElementById('boss-image');
    if(bImg){
      if(b.level!==_lastBossLevel){ bImg.src='cleanerjim.png'; triggerBossEntrance(); shakeArena(); _lastBossLevel=b.level; }
    }
  });
}

/* ══ PRESTIGE ════════════════════════════════════════════════════════════ */
function handleDefeat(b){
  let nextLvl=b.level+1;
  if(nextLvl>10){
    nextLvl=1;
    prestigeCount++;
    const isActive=(Date.now()-lastManualClick)<60000;
    if(isActive){ prestigeBuffMulti+=0.10; myCoins+=Math.floor(500000*prestigeCount); }
    refreshCubicle(); showPrestigeNotice(isActive); updateUI(); save();
  }
  bossRef.set({level:nextLvl,health:1000000000*nextLvl});
}

function showPrestigeNotice(wasActive){
  const title=getPrestigeTitle(prestigeCount);
  const div=document.createElement('div');
  div.style.cssText='position:fixed;inset:0;z-index:250000;background:rgba(0,0,0,0.93);' +
    'display:flex;flex-direction:column;align-items:center;justify-content:center;' +
    'font-family:VT323,monospace;text-align:center;animation:fadeInPop 0.4s ease;';
  if(wasActive){
    const coins=Math.floor(500000*prestigeCount);
    div.innerHTML=`
      <div style="font-size:4.5rem;margin-bottom:8px">🏆</div>
      <div style="font-size:3.2rem;color:#f1c40f;text-shadow:0 0 22px #f1c40f">PRESTIGE!</div>
      <div style="font-size:1.7rem;color:#fff;margin:6px 0">All 10 bosses defeated!</div>
      ${title?`<div style="font-size:1.5rem;color:#00ffcc;margin-bottom:4px">New Title: <strong>${title}</strong></div>`:''}
      <div style="font-size:1.5rem;color:#ff00ff;margin:4px 0">🔥 PERMANENT +10% DAMAGE!</div>
      <div style="font-size:1.2rem;color:#aaa;margin-bottom:4px">Total Prestige Bonus: +${Math.round((prestigeBuffMulti-1)*100)}% DMG</div>
      <div style="font-size:1.8rem;color:#f1c40f;margin-bottom:22px">+${coins.toLocaleString()} 💰 COINS</div>
      <button id="pok" style="padding:10px 44px;background:linear-gradient(90deg,#ff00ff,#00ffff);border:3px solid #fff;color:#fff;font-family:VT323,monospace;font-size:1.8rem;cursor:pointer">LET'S GO!</button>`;
  } else {
    div.innerHTML=`
      <div style="font-size:3.5rem;margin-bottom:8px">💀</div>
      <div style="font-size:2.6rem;color:#888">PRESTIGE</div>
      <div style="font-size:1.5rem;color:#ccc;margin:6px 0">All 10 bosses were defeated!</div>
      ${title?`<div style="font-size:1.3rem;color:#00ffcc;margin-bottom:4px">Title earned: <strong>${title}</strong></div>`:''}
      <div style="font-size:1.2rem;color:#555;margin-bottom:22px">Stay active next time for +10% permanent DMG!</div>
      <button id="pok" style="padding:8px 36px;background:transparent;border:2px solid #555;color:#888;font-family:VT323,monospace;font-size:1.5rem;cursor:pointer">OK</button>`;
  }
  document.body.appendChild(div);
  document.getElementById('pok').onclick=()=>div.remove();
  setTimeout(()=>{ if(div.parentNode) div.remove(); },14000);
}

/* ══ FRENZY TICK ══════════════════════════════════════════════════════════ */
setInterval(()=>{
  frenzy=Math.max(0,frenzy-(rageFuelUnlocked?1:2));
  const frenzyMax = 100 + (milestoneBonuses.frenzy_cap || 0);
  multi = frenzy>=frenzyMax?5 : frenzy>=(frenzyMax*0.75)?3 : frenzy>=(frenzyMax*0.5)?2 : 1;
  const fill=document.getElementById('frenzy-bar-fill');
  const txt=document.getElementById('frenzy-text');
  const md=document.getElementById('shop-multi-display');
  if(fill) fill.style.width=(frenzy/frenzyMax*100)+'%';
  if(txt) txt.innerText=multi>1?'COMBO '+multi+'x':'CHARGE METER';
  if(md) md.innerText=multi.toFixed(2);
},100);

function getBossArmor(){
  if(!bossRef) return 0;
  const raw = Math.min(0.55, Math.max(0,(currentBossLevel-1)*0.065));
  return Math.max(0, raw - (milestoneBonuses.armor_pierce || 0));
}

/* ══ ATTACK ══════════════════════════════════════════════════════════════ */
function attack(e){
  if(isOBS || isCheating) return;
  if(!checkAntiCheat()) return;

  lastManualClick=Date.now();
  playClickSound();
  if(myUser) flashPlayerCard(myUser);

  if(!isAnimatingHit){
    isAnimatingHit=true; shakeArena();
    const hitFlash=document.getElementById('boss-hit-flash');
    if(hitFlash){ hitFlash.classList.add('flashing'); setTimeout(()=>hitFlash.classList.remove('flashing'),120); }
    const bImg=document.getElementById('boss-image');
    if(bImg){
      bImg.style.transform='scale(1.04)';
      setTimeout(()=>{ bImg.style.transform='scale(1)'; isAnimatingHit=false; },180);
    } else { setTimeout(()=>isAnimatingHit=false,180); }
  }

  const effectiveCrit = critChance + (milestoneBonuses.crit_bonus || 0);
  const isCrit = (Math.random()*100) < effectiveCrit;
  const synergyBonus=1+(synergyLevel*0.10);
  const armor=getBossArmor();
  const rawDmg=Math.floor(myClickDmg*multi*itemBuffMultiplier*synergyBonus*prestigeBuffMulti*(isCrit?5:1));
  const dmg=Math.floor(rawDmg*(1-armor));

  if(bossRef) {
    bossRef.transaction(b=>{
      if(b) {
        b.health = Math.max(0, b.health - dmg);
      }
      return b;
    }).then(result=>{
      if(!result.committed) {
        console.warn('Transaction aborted - boss data inconsistent');
      }
    }).catch(err=>{
      console.error('Transaction failed:', err.message);
    });
  }
  myCoins+=(1+hustleCoinsPerClick)*multi;
  frenzy=Math.min(100+(milestoneBonuses.frenzy_cap||0), frenzy+8);
  updateUI(); save();

  // ── Crypto fragment drop (1.5% base, 5% on crit — meaningful but not spammy) ──
  if (Math.random() < (isCrit ? 0.05 : 0.015)) {
    const fragCount = isCrit ? (1 + Math.floor(Math.random()*2)) : 1;
    myCryptoFragments += fragCount;
    _spawnCryptoDropPopup(cx, cy, fragCount);
    save();
  }

  const cx=e.clientX||window.innerWidth/2, cy=e.clientY||window.innerHeight/2;
  const tx=(Math.random()-0.5)*100,ty=-55-Math.random()*55,rot=(Math.random()-0.5)*20;
  const p=document.createElement('div');
  p.className=isCrit?'damage-popup crit-popup':'damage-popup';
  p.innerText='+'+dmg.toLocaleString();
  p.style.cssText=`left:${cx}px;top:${cy}px;--tx:${tx}px;--ty:${ty}px;--rot:${rot}deg;`;
  document.body.appendChild(p); setTimeout(()=>p.remove(),1200);
  if(Math.random()<0.02) rollLoot(cx,cy-80);
}

// Crypto fragment drop popup — floats up near click position
function _spawnCryptoDropPopup(cx, cy, count) {
  const pop = document.createElement('div');
  pop.className = 'loot-popup';
  pop.innerText = '₿ +' + count + ' Crypto';
  const tx = (Math.random()-0.5)*80, ty = -70-Math.random()*50, rot = (Math.random()-0.5)*18;
  pop.style.cssText = `left:${cx}px;top:${cy}px;--tx:${tx}px;--ty:${ty}px;--rot:${rot}deg;color:#f1c40f;text-shadow:0 0 10px #f1c40f;font-size:1.2rem;`;
  document.body.appendChild(pop);
  setTimeout(() => pop.remove(), 3000);
}

/* ══ MERC UNITS ═══════════════════════════════════════════════════════════ */
const MERC_UNIT_EMOJIS = ['🗡️','🪖','💣','⚔️','🔫','🧨','🪃','📌','💀','🤺'];
let mercUnits = [];
let _mercCount = 0;

function getMercCount(){
  return Math.floor(myAutoDmg / 1000);
}

function syncMercUnits(){
  const count = Math.min(getMercCount(), 50);
  const bossZone = document.getElementById('boss-zone');
  if(!bossZone) return;

  while(mercUnits.length > count){
    const u = mercUnits.pop();
    u.element.style.opacity = '0';
    setTimeout(()=>{ try{u.element.remove();}catch(e){} }, 300);
  }

  while(mercUnits.length < count){
    const idx = mercUnits.length;
    const el = document.createElement('div');
    el.className = 'merc-unit';
    el.innerText = MERC_UNIT_EMOJIS[idx % MERC_UNIT_EMOJIS.length];
    const angle = (idx / Math.max(count, 1)) * Math.PI * 2;
    const tier = Math.floor(idx / 12);
    const radius = 58 + tier * 30;
    bossZone.appendChild(el);
    mercUnits.push({ element: el, angle, radius, tier, lastAttack: 0 });
  }

  positionMercUnits();
}

function positionMercUnits(){
  const bossZone = document.getElementById('boss-zone');
  const bossImg = document.getElementById('boss-image');
  if(!bossZone || !bossImg) return;

  const zRect = bossZone.getBoundingClientRect();
  const bRect = bossImg.getBoundingClientRect();

  const cx = bRect.left - zRect.left + bRect.width / 2;
  const cy = bRect.top  - zRect.top  + bRect.height * 0.45;

  const total = mercUnits.length;
  mercUnits.forEach((u, i) => {
    const angle = (i / Math.max(total, 1)) * Math.PI * 2 + (u.tier * 0.5);
    const radius = u.radius;
    const x = cx + Math.cos(angle) * radius - 12;
    const y = cy + Math.sin(angle) * radius * 0.55 - 12;
    u.element.style.left = x + 'px';
    u.element.style.top  = y + 'px';
    u.element.style.opacity = '1';
  });
}

let _mercAnimFrame = null;
function startMercAnimation(){
  if(_mercAnimFrame) return;
  const interval = overtimeUnlocked ? 600 : 1000;

  mercUnits.forEach((u, i) => {
    u.lastAttack = performance.now() - (i / Math.max(mercUnits.length, 1)) * interval;
  });

  function tick(now){
    const attackInterval = overtimeUnlocked ? 600 : 1000;
    mercUnits.forEach((u, i) => {
      const elapsed = (now - (u.lastAttack || 0));
      if(elapsed >= attackInterval){
        u.lastAttack = now;
        u.element.style.transition = 'transform 0.08s ease,filter 0.08s ease';
        u.element.style.transform = 'scale(1.7) rotate(-15deg)';
        u.element.style.filter = 'drop-shadow(0 0 6px #ff00ff) brightness(2)';
        setTimeout(()=>{
          u.element.style.transform = 'scale(1) rotate(0deg)';
          u.element.style.filter = 'none';
        }, 120);
        const zoneEl = document.getElementById('boss-zone');
        if(zoneEl && myAutoDmg > 0){
          const dmgPerMerc = Math.floor((myAutoDmg * prestigeBuffMulti * (1 - getBossArmor())) / Math.max(mercUnits.length, 1));
          const uRect = u.element.getBoundingClientRect();
          const pop = document.createElement('div');
          pop.style.cssText = `position:fixed;left:${uRect.left + 6}px;top:${uRect.top - 6}px;color:#ff88ff;font-family:VT323,monospace;font-size:0.85rem;z-index:9999;pointer-events:none;transition:opacity 0.4s 0.1s,transform 0.4s 0.1s;text-shadow:0 0 4px #ff00ff;`;
          pop.innerText = '-'+dmgPerMerc.toLocaleString();
          document.body.appendChild(pop);
          requestAnimationFrame(()=>{
            pop.style.opacity = '0';
            pop.style.transform = 'translateY(-22px) scale(0.8)';
          });
          setTimeout(()=>pop.remove(), 600);
        }
      }
    });
    _mercAnimFrame = requestAnimationFrame(tick);
  }
  _mercAnimFrame = requestAnimationFrame(tick);
}

/* ══ AUTO DAMAGE ══════════════════════════════════════════════════════════ */
let autoTimer;
function startAutoTimer(){
  if(autoTimer) clearInterval(autoTimer);
  syncMercUnits();
  startMercAnimation();
  autoTimer=setInterval(()=>{
    if(myAutoDmg>0&&bossRef){
      const dmg=Math.floor(myAutoDmg*prestigeBuffMulti*(1-getBossArmor()));
      bossRef.transaction(b=>{
        if(b) {
          b.health = Math.max(0, b.health - dmg);
        }
        return b;
      }).catch(err=>{
        console.error('Auto transaction failed:', err.message);
      });
    }
    if(Math.random()<0.005) rollLoot(window.innerWidth/2+(Math.random()-0.5)*200,window.innerHeight*0.4);
  },overtimeUnlocked?600:1000);
}

function onMercPurchased(){
  syncMercUnits();
  if(!_mercAnimFrame) startMercAnimation();
}

/* ══ UI UPDATE ════════════════════════════════════════════════════════════ */
function updateUI(){
  const set=(id,v)=>{ const el=document.getElementById(id); if(el) el.innerText=v; };
  set('coin-count',myCoins.toLocaleString());
  set('frag-count-wallet', (myCryptoFragments||0).toLocaleString());
  set('click-power',myClickDmg.toLocaleString());
  set('auto-power',myAutoDmg.toLocaleString());
  set('crit-chance-display', critChance + (milestoneBonuses.crit_bonus||0));
  set('loot-buff',Math.round((itemBuffMultiplier-1)*100));
  const pbEl=document.getElementById('prestige-buff-display');
  if(pbEl) pbEl.innerText=Math.round((prestigeBuffMulti-1)*100);

  const bc=document.getElementById('buy-click'); if(bc) bc.innerHTML='⚔️ Sharpen Blade (+2.5k)<br><span>Cost: '+clickCost.toLocaleString()+'</span>';
  const ba=document.getElementById('buy-auto'); if(ba) ba.innerHTML='🪖 Hire Merc (+1k/s)<br><span>Cost: '+autoCost.toLocaleString()+'</span>';
  const cr=document.getElementById('buy-crit'); if(cr) cr.innerHTML='🎯 Lucky Shot (+5% crit)<br><span class="cost-tag">Cost: '+critCost.toLocaleString()+'</span>';
  const bo=document.getElementById('buy-overtime');
  if(bo){ if(overtimeUnlocked){bo.innerHTML='⏱️ Overtime<br><span class="cost-tag" style="color:#00ff88">✅ ACTIVE</span>';bo.style.opacity='0.6';}
          else{bo.innerHTML='⏱️ Overtime (faster auto)<br><span class="cost-tag">Cost: 1,500</span>';bo.style.opacity='1';} }
  const bs=document.getElementById('buy-synergy'); if(bs) bs.innerHTML='⚡ Synergy Boost (+10%)<br><span class="cost-tag">Lv.'+synergyLevel+' Cost: '+synergyCost.toLocaleString()+'</span>';
  const br=document.getElementById('buy-rage');
  if(br){ if(rageFuelUnlocked){br.innerHTML='🔥 Rage Fuel<br><span class="cost-tag" style="color:#00ff88">✅ ACTIVE</span>';br.style.opacity='0.6';}
          else{br.innerHTML='🔥 Rage Fuel (slower decay)<br><span class="cost-tag">Cost: '+rageCost.toLocaleString()+'</span>';br.style.opacity='1';} }
  const bh=document.getElementById('buy-hustle'); if(bh) bh.innerHTML='💰 Side Hustle (+2 coins)<br><span class="cost-tag">Cost: '+hustleCost.toLocaleString()+'</span>';
  updateDeskProgressLabel();
}

/* ══ CLOUD SAVE / LOAD ════════════════════════════════════════════════════ */
function buildSavePayload(){
  return {
    c:myCoins, cd:myClickDmg, ad:myAutoDmg, ac:autoCost, cc:clickCost,
    critC:critChance, critCost:critCost, u:myUser, inv:myInventory,
    ot:overtimeUnlocked, syn:synergyLevel, rf:rageFuelUnlocked,
    hc:hustleCoinsPerClick, sc:synergyCost, rc:rageCost, hcost:hustleCost,
    pc:prestigeCount, pbm:prestigeBuffMulti,
    skills:Object.fromEntries(Object.entries(SKILLS).map(([k,v])=>[k,{xp:v.xp,level:v.level}])),
    desk: {
      unlockedOrnamentIds:      playerDeskState.unlockedOrnamentIds,
      obtainedTimestamps:       playerDeskState.obtainedTimestamps,
      obtainedFromSkill:        playerDeskState.obtainedFromSkill,
      obtainedAtCompletion:     playerDeskState.obtainedAtCompletion,
      totalMinigameCompletions: playerDeskState.totalMinigameCompletions,
      milestonesAwarded:        playerDeskState.milestonesAwarded,
      deskHasUpgrade:           playerDeskState.deskHasUpgrade,
      deskHasAura:              playerDeskState.deskHasAura,
      hasSeenTutorial:          playerDeskState.hasSeenTutorial,
    },
    analytics: {
      assets:      analyticsState.assets,
      upgrades:    analyticsState.upgrades,
      lastCollect: analyticsState.lastCollect,
    },
    seasonalBoss: {
      tierIndex:  seasonalBossState.tierIndex,
      hp:         seasonalBossState.hp,
      kills:      seasonalBossState.kills,
    },
    crypto: myCryptoFragments,
    avatar: playerAvatar,
    lastSeen:Date.now()
  };
}
function applyPayload(d){
  myCoins=d.c||0; myClickDmg=d.cd||2500; myAutoDmg=d.ad||0; autoCost=d.ac||200;
  clickCost=d.cc||25; critChance=d.critC||0; critCost=d.critCost||200;
  if(d.u) { myUser=d.u; try { localStorage.setItem('ct_player_username', myUser); } catch(e) {} }
  myInventory=d.inv||{}; overtimeUnlocked=d.ot||false; synergyLevel=d.syn||0;
  rageFuelUnlocked=d.rf||false; hustleCoinsPerClick=d.hc||0; synergyCost=d.sc||150;
  rageCost=d.rc||75; hustleCost=d.hcost||30;
  prestigeCount=d.pc||0; prestigeBuffMulti=d.pbm||1.0;
  if(d.skills){ for(const k in d.skills){ if(SKILLS[k]){SKILLS[k].xp=d.skills[k].xp||0;SKILLS[k].level=d.skills[k].level||1;} } }
  // ─── Restore desk state ───
  if(d.desk){
    playerDeskState.unlockedOrnamentIds      = d.desk.unlockedOrnamentIds      || [];
    playerDeskState.obtainedTimestamps       = d.desk.obtainedTimestamps       || {};
    playerDeskState.obtainedFromSkill        = d.desk.obtainedFromSkill        || {};
    playerDeskState.obtainedAtCompletion     = d.desk.obtainedAtCompletion     || {};
    playerDeskState.totalMinigameCompletions = d.desk.totalMinigameCompletions || 0;
    playerDeskState.milestonesAwarded        = d.desk.milestonesAwarded        || [];
    playerDeskState.deskHasUpgrade           = d.desk.deskHasUpgrade           || false;
    playerDeskState.deskHasAura              = d.desk.deskHasAura              || false;
    playerDeskState.hasSeenTutorial          = d.desk.hasSeenTutorial          || false;
  }
  // ─── Restore analytics farm state ───
  if(d.analytics){
    analyticsState.assets      = d.analytics.assets      || {};
    analyticsState.upgrades    = d.analytics.upgrades    || {};
    analyticsState.lastCollect = d.analytics.lastCollect || Date.now();
  }
  // ─── Restore seasonal boss state ───
  if(d.seasonalBoss){
    seasonalBossState.tierIndex = d.seasonalBoss.tierIndex || 0;
    seasonalBossState.hp        = d.seasonalBoss.hp        || 0;
    seasonalBossState.kills     = d.seasonalBoss.kills     || 0;
    seasonalBossState.isDefeated = false;
  }
  myCryptoFragments = d.crypto || 0;
  // ─── Restore Avatar State ───
  if(d.avatar) playerAvatar = d.avatar;
  initSeasonalBoss();
  const u=document.getElementById('username-input'); if(u&&myUser) u.value=myUser;
  recalcItemBuff(); recalcMilestoneBonuses(); renderInventory(); renderSkillPanel(); updateUI();
  if(myAutoDmg>0) startAutoTimer();
  refreshCubicle();
  updateDeskProgressLabel();
  renderDeskOverlay();
  setTimeout(()=>{ syncMercUnits(); if(myAutoDmg>0 && !_mercAnimFrame) startMercAnimation(); }, 200);
  console.log('✅ Save applied, user:', myUser, 'coins:', myCoins);
}

function save(){
  if(isOBS) return;
  const payload = buildSavePayload();
  localStorage.setItem('gwm_v14', JSON.stringify(payload));
  if(currentUser && db){
    db.ref('players/'+currentUser.uid).set(payload).catch(e=>console.warn('Cloud save failed:',e));
  }
}

function load(){
  if(currentUser && db){
    db.ref('players/'+currentUser.uid).once('value').then(snap=>{
      const cloudData = snap.val();
      if(cloudData){
        applyPayload(cloudData);
        console.log('✅ Cloud save loaded');
        autoLoginIfSaved();
      } else {
        const local = localStorage.getItem('gwm_v14') || localStorage.getItem('gwm_v13');
        if(local){
          applyPayload(JSON.parse(local));
          console.log('✅ Local save migrated to cloud');
          save();
          autoLoginIfSaved();
        }
      }
    }).catch(e=>{
      console.warn('Cloud load failed, using local:', e);
      const local = localStorage.getItem('gwm_v14') || localStorage.getItem('gwm_v13');
      if(local){ applyPayload(JSON.parse(local)); autoLoginIfSaved(); }
    });
  } else {
    const local = localStorage.getItem('gwm_v14') || localStorage.getItem('gwm_v13');
    if(local){ applyPayload(JSON.parse(local)); autoLoginIfSaved(); }
  }
}

/* ══ RICHARD TIP LOOP ════════════════════════════════════════════════════ */
function startRichardLoop(){
  setTimeout(()=>{
    const c=document.getElementById('richard-event-container');
    const d=document.getElementById('richard-dialogue');
    const img=document.getElementById('richard-image');
    if(!c||!d||!img){ setTimeout(startRichardLoop,5000); return; }
    if(usedTips.length>=richardTips.length) usedTips=[];
    const avail=richardTips.filter(t=>!usedTips.includes(t));
    const tip=avail[Math.floor(Math.random()*avail.length)];
    usedTips.push(tip); d.innerText=tip;
    const imgs=['yourbossvar/boss-crossing.png','yourbossvar/boss-pointing.png'];
    img.src=imgs[Math.floor(Math.random()*imgs.length)]; img.style.display='block';
    const fromLeft=Math.random()>0.5;
    img.style.left=fromLeft?'10px':'auto'; img.style.right=fromLeft?'auto':'10px';
    img.style.transform=fromLeft?'translateX(-160px)':'translateX(160px)';
    d.style.left=fromLeft?'6vw':'auto'; d.style.right=fromLeft?'auto':'6vw';
    setTimeout(()=>{
      img.style.transition='opacity 1.2s ease, transform 1.5s ease';
      img.style.opacity='0.85'; img.style.transform='translateX(0)';
      d.style.transition='opacity 0.5s 1.5s, transform 0.5s 1.5s';
      d.style.opacity='1'; d.style.transform='scale(1)';
    },100);
    setTimeout(()=>{
      img.style.opacity='0'; img.style.transform=fromLeft?'translateX(-160px)':'translateX(160px)';
      d.style.opacity='0'; d.style.transform='scale(0.8)';
      setTimeout(startRichardLoop,3000);
    },8000);
  },25000+Math.random()*15000);
}

/* ══════════════════════════════════════════════════════════════════════════
   PHISHING MINIGAME
════════════════════════════════════════════════════════════════════════════ */
const phishingEmails=[
  {from:'it-support@company-secure-login.biz',subject:'URGENT: Your account will be DELETED!!!',body:'Dear User,\n\nYour account has been flagged. You MUST verify immediately or face permanent termination.\n\nCLICK HERE: http://login.company-secure-login.biz/verify\n\n- IT Department',isPhish:true,tip:'Fake domain, all-caps urgency, threats, suspicious link.'},
  {from:'noreply@payroll.yourcompany.com',subject:'Paystub for this period is ready',body:'Hi,\n\nYour paystub for the current pay period is now available in the HR portal.\n\nLog in at hr.yourcompany.com to view it.\n\n- Payroll Team',isPhish:false,tip:'Correct company domain, no urgency, no suspicious links.'},
  {from:'ceo-message@corporat3.net',subject:'Personal request from CEO Richard',body:'Hello,\n\nThis is Richard. I need you to purchase $500 in Amazon gift cards for a client RIGHT NOW and send me the codes privately. Do not tell anyone.\n\n- Richard',isPhish:true,tip:'Gift card scam. Wrong domain, secrecy demands, CEO gift card requests are always scams.'},
  {from:'calendar@google.com',subject:'Meeting: Q4 Planning - 3pm Today',body:'You have been invited to a meeting:\n\nQ4 Budget Planning\nWhen: Today at 3:00 PM\nOrganizer: district.manager@yourcompany.com\n\nThis is a Google Calendar notification.',isPhish:false,tip:'Legitimate Google Calendar notification. Real google.com domain.'},
  {from:'security@your-company.support',subject:'Multi-Factor Authentication Required',body:'Your MFA token has expired. To maintain access:\n\nhttp://mfa-portal.your-company.support/enroll\n\nFailure to act within 24 hours will suspend your access.\n\n- Security Operations',isPhish:true,tip:'Unofficial hyphened support domain, urgency pressure tactic.'},
  {from:'helpdesk@yourcompany.com',subject:'Password Expiry Notice - 5 Days Remaining',body:'Your domain password will expire in 5 days.\n\nPlease update it at the IT Self-Service portal: https://helpdesk.yourcompany.com/password\n\n- IT Help Desk',isPhish:false,tip:'Correct company domain, portal link matches, reasonable timeframe.'},
];
function shuffleArray(arr){const a=[...arr];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
let phishPool=[],phishIndex=0,phishScore=0,phishTotal=6,phishTimerInterval=null,phishTimeLeft=0,phishAnswered=false;
function setMikitaImg(v){ const el=document.getElementById('mikita-game-img'); if(el) el.src='assets/chars/mikita_'+v+'.png'; }
function openPhishingGame(){
  phishPool=shuffleArray(phishingEmails).slice(0,phishTotal); phishIndex=0; phishScore=0; phishAnswered=false;
  const overlay=document.getElementById('phishing-game-overlay'); if(!overlay) return;
  overlay.style.display='flex';
  const el=document.getElementById('phish-score'); if(el) el.innerText='0 / '+phishTotal;
  const rs=document.getElementById('phish-result-screen'); if(rs) rs.style.display='none';
  const btns=document.getElementById('phish-buttons'); if(btns) btns.style.display='flex';
  setMikitaImg('terminal'); loadPhishEmail();
}
function loadPhishEmail(){
  if(phishIndex>=phishPool.length){endPhishGame();return;}
  const email=phishPool[phishIndex]; phishAnswered=false;
  const s=document.getElementById('phish-sender'); if(s) s.innerText=email.from;
  const sub=document.getElementById('phish-subject'); if(sub) sub.innerText=email.subject;
  const body=document.getElementById('phish-body'); if(body) body.innerText=email.body;
  const btns=document.getElementById('phish-buttons'); if(btns){btns.style.display='flex';btns.style.pointerEvents='auto';btns.style.opacity='1';}
  const tf=document.getElementById('phish-timer-fill');
  if(tf){tf.style.transition='none';tf.style.width='100%';tf.style.backgroundColor='#00ffcc';void tf.offsetWidth;tf.style.transition='width 0.1s linear,background-color 0.3s';}
  if(phishTimerInterval) clearInterval(phishTimerInterval);
  phishTimeLeft=80;
  phishTimerInterval=setInterval(()=>{
    phishTimeLeft--;
    const pct=(phishTimeLeft/80)*100;
    if(tf){tf.style.width=pct+'%';tf.style.backgroundColor=pct<30?'#ff4444':pct<60?'#ff8800':'#00ffcc';}
    if(phishTimeLeft<=0){clearInterval(phishTimerInterval);if(!phishAnswered)answerPhish(null);}
  },100);
}
function answerPhish(userSaysPhish){
  if(phishAnswered) return; phishAnswered=true;
  if(phishTimerInterval){clearInterval(phishTimerInterval);phishTimerInterval=null;}
  const email=phishPool[phishIndex];
  const correct=userSaysPhish!==null&&(userSaysPhish===email.isPhish);
  if(correct) phishScore++;
  const scoreEl=document.getElementById('phish-score'); if(scoreEl) scoreEl.innerText=phishScore+' / '+phishTotal;
  const tf=document.getElementById('phish-timer-fill'); if(tf) tf.style.backgroundColor=correct?'#00ff88':'#ff4444';
  const btns=document.getElementById('phish-buttons'); if(btns){btns.style.pointerEvents='none';btns.style.opacity='0.4';}
  const bodyEl=document.getElementById('phish-body');
  const verdict=userSaysPhish===null?'⏱️ TIMED OUT!':correct?'✅ CORRECT!':'❌ WRONG!';
  const color=correct?'#00aa55':'#cc0000';
  const answer=email.isPhish?'🚩 PHISHING':'✅ LEGITIMATE';
  if(bodyEl) bodyEl.innerHTML=`<strong style="color:${color};font-size:1.4em;display:block;margin-bottom:8px">${verdict}</strong><span style="color:#666;font-size:0.9em">💡 ${email.tip}</span><br><br><em style="color:#888;font-size:0.85em">This email was: ${answer}</em>`;
  setTimeout(()=>{phishIndex++;if(phishIndex>=phishTotal)endPhishGame();else loadPhishEmail();},2500);
}
function endPhishGame(){
  if(phishTimerInterval) clearInterval(phishTimerInterval);
  const btns=document.getElementById('phish-buttons'); if(btns) btns.style.display='none';
  const rs=document.getElementById('phish-result-screen'); if(rs) rs.style.display='block';
  const fm=document.getElementById('phish-final-msg');
  const pct=phishScore/phishTotal;
  let reward=0,msg='',variant='instructor';
  if(pct>=0.85){reward=80;msg='🏆 ELITE ANALYST!\n'+phishScore+'/'+phishTotal+' Correct\n+'+reward+' ₿ Crypto!';variant='instructor';}
  else if(pct>=0.67){reward=40;msg='✅ SOLID WORK!\n'+phishScore+'/'+phishTotal+' Correct\n+'+reward+' ₿ Crypto';variant='idle';}
  else if(pct>=0.50){reward=15;msg='⚠️ NEEDS TRAINING\n'+phishScore+'/'+phishTotal+' Correct\n+'+reward+' ₿ Crypto';variant='terminal';}
  else{reward=0;msg='❌ PHISHED!\n'+phishScore+'/'+phishTotal+' Correct\nNo reward.';variant='terminal';}
  if(fm) fm.innerText=msg; setMikitaImg(variant);
  myCryptoFragments+=reward; updateUI(); save();
  const xp=phishScore*180+(phishScore===phishTotal?500:0);
  if(xp>0){ addSkillXP('phishing',xp); showXPGain('phishing',xp); }

  // ─── ORNAMENT DROP CHECK — only fires on successful completions ───────
  // "Successful" = scored at least 50% (got a reward)
  if(reward > 0) {
    checkOrnamentDrop('phishing');
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   CORPORATE DASH — Firewall skill
════════════════════════════════════════════════════════════════════════════ */
let gdGame=null;
function openFirewallGame(){
  const overlay=document.getElementById('firewall-game-overlay'); if(!overlay) return;
  overlay.innerHTML='';
  overlay.style.cssText='display:flex;position:fixed;inset:0;background:#000;z-index:200010;flex-direction:column;align-items:center;justify-content:center;font-family:VT323,monospace;user-select:none;';
  const statsBar=document.createElement('div');
  statsBar.style.cssText='display:flex;gap:50px;margin-bottom:14px;font-size:1.3rem;letter-spacing:2px;color:#00ffcc;';
  statsBar.innerHTML=`<span>⏱ <strong id="gd-time" style="color:#fff;font-size:1.5rem">0</strong>s <span style="color:#444">/ 60</span></span><span style="color:#ff00ff;font-size:1.5rem;text-shadow:0 0 12px #ff00ff;">⚡ CORPORATE DASH</span><span>💰 <strong id="gd-coins" style="color:#f1c40f;font-size:1.5rem">0</strong></span>`;
  overlay.appendChild(statsBar);
  const canvas=document.createElement('canvas');
  canvas.id='gd-canvas'; canvas.width=800; canvas.height=300;
  canvas.style.cssText='border:3px solid #00ffcc;box-shadow:0 0 40px rgba(0,255,204,0.4),0 0 80px rgba(0,255,204,0.15);max-width:96vw;display:block;cursor:pointer;';
  overlay.appendChild(canvas);
  const hint=document.createElement('div');
  hint.style.cssText='margin-top:12px;color:#555;font-size:1rem;letter-spacing:1px;';
  hint.innerText='CLICK · SPACE · TAP = JUMP     DOUBLE JUMP AVAILABLE     ONE HIT = DEATH';
  overlay.appendChild(hint);
  const quitBtn=document.createElement('button');
  quitBtn.innerText='✕ QUIT';
  quitBtn.style.cssText='margin-top:14px;padding:6px 28px;background:transparent;border:2px solid #333;color:#555;font-family:VT323,monospace;font-size:1.1rem;cursor:pointer;letter-spacing:1px;transition:all 0.2s;';
  quitBtn.onmouseenter=()=>{quitBtn.style.borderColor='#ff4444';quitBtn.style.color='#ff4444';};
  quitBtn.onmouseleave=()=>{quitBtn.style.borderColor='#333';quitBtn.style.color='#555';};
  quitBtn.onclick=()=>{ if(gdGame){gdGame.destroy();gdGame=null;} overlay.style.display='none'; };
  overlay.appendChild(quitBtn);
  if(gdGame){gdGame.destroy();gdGame=null;}
  gdGame=new GDGame(canvas); gdGame.start();
}

class GDGame{
  constructor(canvas){
    this.canvas=canvas; this.ctx=canvas.getContext('2d');
    this.W=canvas.width; this.H=canvas.height;
    this.raf=null; this.running=false;
    this._keyFn=(e)=>{ if(e.code==='Space'){e.preventDefault();this.jump();} };
    this._clickFn=()=>this.jump();
    this._touchFn=(e)=>{e.preventDefault();this.jump();};
    window.addEventListener('keydown',this._keyFn);
    canvas.addEventListener('click',this._clickFn);
    canvas.addEventListener('touchstart',this._touchFn,{passive:false});
    this._initState();
  }
  destroy(){
    this.running=false;
    if(this.raf){cancelAnimationFrame(this.raf);this.raf=null;}
    window.removeEventListener('keydown',this._keyFn);
    try{this.canvas.removeEventListener('click',this._clickFn);}catch(e){}
    try{this.canvas.removeEventListener('touchstart',this._touchFn);}catch(e){}
  }
  _initState(){
    this.t=0; this.worldX=0; this.dead=false; this.won=false;
    this.resultShown=false; this.lastFrameTime=null;
    this.GY=this.H-55;
    this.p={x:110,y:this.GY-36,w:34,h:34,vy:0,grounded:true,jumps:2,rot:0};
    this.obs=[]; this.nextObsX=this.W+250; this.parts=[];
    this.stars=Array.from({length:55},()=>({sx:Math.random()*this.W,sy:Math.random()*(this.GY*0.75),r:Math.random()*1.6+0.3,phase:Math.random()*Math.PI*2}));
    this._seedStart();
  }
  _seedStart(){ for(const x of [620,960,1300]) this.obs.push({kind:'spike',x,w:30,h:38,y:this.GY-38}); this.nextObsX=1300; }
  start(){ this.running=true; this.lastFrameTime=performance.now(); this._tick(performance.now()); }
  jump(){ if(!this.running||this.dead||this.won) return; if(this.p.jumps>0){this.p.vy=-(500+this._speed()*0.12);this.p.grounded=false;this.p.jumps--;} }
  _speed(){ const t=this.t; if(t<8)return 260; if(t<20)return 260+(t-8)*16; if(t<35)return 452+(t-20)*8; if(t<50)return 572+(t-35)*5; return 647+(t-50)*3; }
  _gravity(){ return 1350+this.t*4; }
  _minGap(){ const t=this.t; if(t<10)return 400; if(t<20)return 320; if(t<35)return 240; if(t<50)return 185; return 155; }
  _makeObs(x){
    const t=this.t,G=this.GY,r=Math.random();
    if(t<12){ if(r<0.7)return{kind:'spike',x,w:30,h:38,y:G-38}; return{kind:'spike2',x,spikes:[{w:30,h:38,y:G-38,dx:0},{w:30,h:44,y:G-44,dx:36}]}; }
    if(t<28){ if(r<0.35)return{kind:'spike',x,w:30,h:38,y:G-38}; if(r<0.60)return{kind:'spike2',x,spikes:[{w:30,h:38,y:G-38,dx:0},{w:30,h:44,y:G-44,dx:36}]}; if(r<0.80){const h=75+Math.random()*35;return{kind:'wall',x,w:22,h,y:G-h};} return{kind:'ceil',x,w:200,h:18,y:55}; }
    if(t<45){ if(r<0.20)return{kind:'spike',x,w:30,h:38,y:G-38}; if(r<0.38)return{kind:'spike2',x,spikes:[{w:30,h:38,y:G-38,dx:0},{w:30,h:44,y:G-44,dx:36}]}; if(r<0.52)return{kind:'spike3',x,spikes:[{w:28,h:36,y:G-36,dx:0},{w:28,h:44,y:G-44,dx:32},{w:28,h:36,y:G-36,dx:64}]}; if(r<0.72){const h=80+Math.random()*40;return{kind:'wall',x,w:22,h,y:G-h};} return{kind:'ceil',x,w:180+Math.random()*80,h:20,y:48+Math.random()*20}; }
    if(r<0.18)return{kind:'spike',x,w:30,h:38,y:G-38}; if(r<0.34)return{kind:'spike3',x,spikes:[{w:28,h:36,y:G-36,dx:0},{w:28,h:44,y:G-44,dx:32},{w:28,h:36,y:G-36,dx:64}]}; if(r<0.55){const h=85+Math.random()*45;return{kind:'wall',x,w:24,h,y:G-h};} if(r<0.75)return{kind:'ceil',x,w:160+Math.random()*100,h:22,y:45+Math.random()*15}; return{kind:'combo',x,ceil:{w:170,h:20,y:50},spike:{w:30,h:38,y:G-38,dx:70}};
  }
  _tick(now){ if(!this.running)return; const dt=Math.min((now-this.lastFrameTime)/1000,0.05); this.lastFrameTime=now; if(!this.dead&&!this.won)this._update(dt); this._draw(); this.raf=requestAnimationFrame(t=>this._tick(t)); }
  _update(dt){
    this.t+=dt; this.worldX+=this._speed()*dt;
    const gdTime=document.getElementById('gd-time'),gdCoins=document.getElementById('gd-coins');
    const coinBonus = 1 + (milestoneBonuses.dash_coins || 0);
    if(gdTime)gdTime.innerText=Math.floor(this.t);
    if(gdCoins)gdCoins.innerText=Math.floor(Math.floor(this.t)*1000*coinBonus).toLocaleString();
    if(this.t>=60){this._win();return;}
    const p=this.p; p.vy+=this._gravity()*dt; p.y+=p.vy*dt;
    if(p.y>=this.GY-p.h){p.y=this.GY-p.h;p.vy=0;p.grounded=true;p.jumps=2;}else p.grounded=false;
    if(p.y<0){p.y=0;p.vy=Math.abs(p.vy)*0.3;}
    p.rot=p.grounded?0:p.rot+360*dt;
    while(this.nextObsX<this.worldX+this.W+500){this.nextObsX+=this._minGap()+Math.random()*160;this.obs.push(this._makeObs(this.nextObsX));}
    this.obs=this.obs.filter(o=>o.x-this.worldX>-300);
    for(const o of this.obs){if(this._hits(p,o)){this._die();return;}}
    this.parts=this.parts.filter(pt=>pt.life>0);
    for(const pt of this.parts){pt.x+=pt.vx*dt;pt.y+=pt.vy*dt;pt.vy+=500*dt;pt.life-=dt;}
  }
  _sx(wx){return wx-this.worldX;}
  _hits(p,o){
    const M=5,px1=p.x+M,px2=p.x+p.w-M,py1=p.y+M,py2=p.y+p.h-M;
    const ov=(ax1,ay1,ax2,ay2,bx1,by1,bx2,by2)=>ax1<bx2&&ax2>bx1&&ay1<by2&&ay2>by1;
    const sx=this._sx(o.x);
    if(o.kind==='spike'||o.kind==='wall')return ov(px1,py1,px2,py2,sx,o.y,sx+o.w,o.y+o.h);
    if(o.kind==='ceil')return ov(px1,py1,px2,py2,sx,o.y,sx+o.w,o.y+o.h);
    if(o.kind==='spike2'||o.kind==='spike3'){for(const sp of o.spikes)if(ov(px1,py1,px2,py2,sx+(sp.dx||0),sp.y,sx+(sp.dx||0)+sp.w,sp.y+sp.h))return true;}
    if(o.kind==='combo'){const c=o.ceil,sp=o.spike;if(ov(px1,py1,px2,py2,sx,c.y,sx+c.w,c.y+c.h))return true;if(ov(px1,py1,px2,py2,sx+(sp.dx||0),sp.y,sx+(sp.dx||0)+sp.w,sp.y+sp.h))return true;}
    return false;
  }
  _die(){
    this.dead=true;
    const secs=Math.floor(this.t);
    const coinBonus=1+(milestoneBonuses.dash_coins||0);
    const coins=Math.floor(secs*3*coinBonus);
    for(let i=0;i<22;i++){const a=(i/22)*Math.PI*2;this.parts.push({x:this.p.x+this.p.w/2,y:this.p.y+this.p.h/2,vx:Math.cos(a)*(80+Math.random()*220),vy:Math.sin(a)*(80+Math.random()*220)-80,life:0.9+Math.random()*0.4,color:['#ff00ff','#00ffff','#ff3366','#f1c40f','#fff'][i%5]});}
    myCryptoFragments+=coins; updateUI(); save();
    const xp=secs*100; if(xp>0){addSkillXP('firewall',xp);showXPGain('firewall',xp);}
    setTimeout(()=>this._showDeath(coins,secs),600);
  }
  _win(){
    this.won=true;
    const coinBonus=1+(milestoneBonuses.dash_coins||0);
    const winCoins=Math.floor(180*coinBonus);
    myCryptoFragments+=winCoins; updateUI(); save();
    const xp=60*100+1000; addSkillXP('firewall',xp); showXPGain('firewall',xp);

    // ─── ORNAMENT DROP CHECK — only on full clear (win) ───────────────
    checkOrnamentDrop('firewall');

    setTimeout(()=>this._showWin(winCoins),300);
  }
  _showDeath(coins,secs){
    if(this.resultShown)return; this.resultShown=true;
    const overlay=document.getElementById('firewall-game-overlay'); if(!overlay)return;
    const div=document.createElement('div');
    div.style.cssText='position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(0,0,0,0.87);z-index:20;text-align:center;font-family:VT323,monospace;';
    div.innerHTML=`<div style="font-size:3.8rem;color:#ff3366;text-shadow:0 0 25px #ff3366;margin-bottom:10px">💀 YOU DIED 💀</div>
      <div style="font-size:1.7rem;color:#fff;margin-bottom:6px">Survived <strong style="color:#f1c40f">${secs}s</strong> / 60s</div>
      <div style="font-size:1.3rem;color:#00ffcc;margin-bottom:4px">+${coins} ₿ Crypto Fragments</div>
      <div style="font-size:1.1rem;color:#00ffcc;margin-bottom:22px">🛡️ +${secs*250} Firewall XP</div>
      <div style="display:flex;gap:22px">
        <button id="gd-retry" style="padding:10px 38px;background:linear-gradient(90deg,#ff00ff,#00ffff);border:3px solid #fff;color:#fff;font-family:VT323,monospace;font-size:1.7rem;cursor:pointer">▶ TRY AGAIN</button>
        <button id="gd-quit" style="padding:10px 38px;background:transparent;border:2px solid #ff4444;color:#ff4444;font-family:VT323,monospace;font-size:1.7rem;cursor:pointer">✕ QUIT</button>
      </div>`;
    overlay.appendChild(div);
    document.getElementById('gd-retry').onclick=()=>{ div.remove(); this._initState(); this.lastFrameTime=performance.now(); };
    document.getElementById('gd-quit').onclick=()=>{ this.destroy();gdGame=null;overlay.style.display='none'; };
  }
  _showWin(winCoins){
    if(this.resultShown)return; this.resultShown=true;
    const overlay=document.getElementById('firewall-game-overlay'); if(!overlay)return;
    const div=document.createElement('div');
    div.style.cssText='position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(0,0,0,0.9);z-index:20;text-align:center;font-family:VT323,monospace;';
    div.innerHTML=`<div style="font-size:3.5rem;color:#00ff88;text-shadow:0 0 30px #00ff88;margin-bottom:10px">🏆 FIREWALL CLEARED! 🏆</div>
      <div style="font-size:1.8rem;color:#fff;margin-bottom:8px">Survived all 60 seconds!</div>
      <div style="font-size:2.2rem;color:#f1c40f;text-shadow:0 0 15px #f1c40f;margin-bottom:4px">+${winCoins.toLocaleString()} VAPOR COINS</div>
      <div style="font-size:1.3rem;color:#00ffcc;margin-bottom:24px">🛡️ +17,500 Firewall XP</div>
      <button id="gd-done" style="padding:12px 52px;background:linear-gradient(90deg,#00ffcc,#00ff88);border:3px solid #fff;color:#000;font-family:VT323,monospace;font-size:1.9rem;cursor:pointer">BACK TO WORK</button>`;
    overlay.appendChild(div);
    document.getElementById('gd-done').onclick=()=>{ this.destroy();gdGame=null;overlay.style.display='none'; };
  }
  _draw(){
    const ctx=this.ctx,W=this.W,H=this.H,GY=this.GY;
    const skyGrad=ctx.createLinearGradient(0,0,0,GY); skyGrad.addColorStop(0,'#03000f'); skyGrad.addColorStop(1,'#0a0025');
    ctx.fillStyle=skyGrad; ctx.fillRect(0,0,W,H);
    const gridOff=this.worldX%100; ctx.strokeStyle='rgba(0,255,204,0.06)'; ctx.lineWidth=1;
    for(let x=-gridOff;x<W;x+=100){ctx.beginPath();ctx.moveTo(x,GY);ctx.lineTo(x+30,H);ctx.stroke();}
    const now=performance.now()*0.001;
    for(const s of this.stars){ctx.globalAlpha=0.4+0.5*Math.abs(Math.sin(now+s.phase));ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(s.sx,s.sy,s.r,0,Math.PI*2);ctx.fill();}
    ctx.globalAlpha=1;
    ctx.shadowBlur=14;ctx.shadowColor='#00ffcc';ctx.strokeStyle='#00ffcc';ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(0,GY);ctx.lineTo(W,GY);ctx.stroke();ctx.shadowBlur=0;
    const groundGrad=ctx.createLinearGradient(0,GY,0,H); groundGrad.addColorStop(0,'rgba(0,255,204,0.22)'); groundGrad.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=groundGrad; ctx.fillRect(0,GY,W,H-GY);
    for(const o of this.obs){const sx=this._sx(o.x);if(sx>W+200||sx<-400)continue;this._drawObs(ctx,o,sx);}
    if(!this.dead){
      const p=this.p;
      ctx.save();ctx.translate(p.x+p.w/2,p.y+p.h/2);ctx.rotate(p.rot*Math.PI/180);
      ctx.shadowBlur=18;ctx.shadowColor='#ff00ff';
      ctx.fillStyle='#dd00cc';ctx.fillRect(-p.w/2,-p.h/2,p.w,p.h);
      ctx.fillStyle='#00ffff';ctx.fillRect(-p.w/2+5,-p.h/2+5,p.w-10,p.h-10);
      ctx.fillStyle='#ff00ff';ctx.fillRect(3,-5,7,7);
      ctx.shadowBlur=0;ctx.restore();
      if(!p.grounded&&p.jumps===1){ctx.globalAlpha=0.85;ctx.fillStyle='#f1c40f';ctx.beginPath();ctx.arc(p.x+p.w/2,p.y-10,5,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;}
    }
    for(const pt of this.parts){ctx.globalAlpha=Math.max(0,pt.life);ctx.fillStyle=pt.color;ctx.shadowBlur=8;ctx.shadowColor=pt.color;ctx.fillRect(pt.x-4,pt.y-4,8,8);}
    ctx.globalAlpha=1;ctx.shadowBlur=0;
    const prog=Math.min(this.t/60,1);
    ctx.fillStyle='rgba(0,0,0,0.6)';ctx.fillRect(0,0,W,7);
    const barGrad=ctx.createLinearGradient(0,0,W,0); barGrad.addColorStop(0,'#ff00ff');barGrad.addColorStop(0.4,'#00ffcc');barGrad.addColorStop(1,'#00ff88');
    ctx.fillStyle=barGrad;ctx.fillRect(0,0,W*prog,7);
    if(this.t>45&&!this.dead&&!this.won){ctx.fillStyle=`rgba(255,0,0,${Math.abs(Math.sin(now*3))*0.07})`;ctx.fillRect(0,0,W,H);}
    if(!this.dead&&!this.won){ctx.fillStyle='rgba(255,255,255,0.18)';ctx.font='16px VT323,monospace';ctx.fillText('SPD '+Math.round(this._speed()),W-88,H-8);}
  }
  _drawObs(ctx,o,sx){
    const spike=(x,y,w,h,color)=>{ ctx.shadowBlur=12;ctx.shadowColor=color;ctx.fillStyle=color; ctx.beginPath();ctx.moveTo(x,y+h);ctx.lineTo(x+w/2,y);ctx.lineTo(x+w,y+h);ctx.closePath();ctx.fill(); ctx.fillStyle='rgba(255,255,255,0.22)';ctx.beginPath();ctx.moveTo(x+4,y+h-2);ctx.lineTo(x+w/2-1,y+4);ctx.lineTo(x+w/2+2,y+4);ctx.closePath();ctx.fill(); ctx.shadowBlur=0; };
    if(o.kind==='spike')spike(sx,o.y,o.w,o.h,'#ff3366');
    else if(o.kind==='spike2'||o.kind==='spike3'){for(const sp of o.spikes)spike(sx+(sp.dx||0),sp.y,sp.w,sp.h,'#ff3366');}
    else if(o.kind==='wall'){ ctx.shadowBlur=14;ctx.shadowColor='#ff00ff'; const g=ctx.createLinearGradient(sx,0,sx+o.w,0);g.addColorStop(0,'#cc00aa');g.addColorStop(1,'#880066'); ctx.fillStyle=g;ctx.fillRect(sx,o.y,o.w,o.h); ctx.fillStyle='rgba(255,255,0,0.1)';for(let wy=o.y;wy<o.y+o.h;wy+=18)ctx.fillRect(sx,wy,o.w,9); ctx.strokeStyle='#ff66ff';ctx.lineWidth=1.5;ctx.strokeRect(sx,o.y,o.w,o.h);ctx.shadowBlur=0; }
    else if(o.kind==='ceil'){ ctx.shadowBlur=14;ctx.shadowColor='#00ffcc'; const g=ctx.createLinearGradient(0,o.y,0,o.y+o.h);g.addColorStop(0,'#004433');g.addColorStop(1,'#00ffcc'); ctx.fillStyle=g;ctx.fillRect(sx,o.y,o.w,o.h); ctx.strokeStyle='#00ffcc';ctx.lineWidth=1.5;ctx.strokeRect(sx,o.y,o.w,o.h); ctx.fillStyle='#00ffcc';for(let tx=sx+10;tx<sx+o.w-10;tx+=26){ctx.beginPath();ctx.moveTo(tx,o.y+o.h);ctx.lineTo(tx+8,o.y+o.h+16);ctx.lineTo(tx+16,o.y+o.h);ctx.closePath();ctx.fill();} ctx.shadowBlur=0; }
    else if(o.kind==='combo'){ const c=o.ceil,sp=o.spike; ctx.shadowBlur=12;ctx.shadowColor='#00ffcc';ctx.fillStyle='#00aa88'; ctx.fillRect(sx,c.y,c.w,c.h);ctx.strokeStyle='#00ffcc';ctx.lineWidth=1;ctx.strokeRect(sx,c.y,c.w,c.h);ctx.shadowBlur=0; spike(sx+(sp.dx||0),sp.y,sp.w,sp.h,'#ff3366'); }
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   SEASONAL BOSS SYSTEM
   ─────────────────────────────────────────────────────────────────────────
   • Per-player health — NOT shared Firebase boss
   • Scales through TIERS: each defeat increases tier, HP, and rewards
   • Damage formula reuses player's attack stats (click dmg × buffs)
   • Coins awarded per hit (proportional) + big bonus on defeat
   • Phase image change at 50% and 20% HP
   • Auto-save via existing save() / buildSavePayload()
════════════════════════════════════════════════════════════════════════════ */

/* ── Tier config table ────────────────────────────────────────────────── */
const SB_TIERS = [
  { tier:1, label:'TIER I',   name:'Shadow Executive',   maxHP:  150_000, coinPerHit:  2, killBonus:   500, tierClass:'tier-1' },
  { tier:2, label:'TIER II',  name:'Vice Phantom',       maxHP:  500_000, coinPerHit:  6, killBonus:  2000, tierClass:'tier-2' },
  { tier:3, label:'TIER III', name:'Director of Chaos',  maxHP:1_500_000, coinPerHit: 16, killBonus:  7500, tierClass:'tier-3' },
  { tier:4, label:'TIER IV',  name:'Board of Shadows',   maxHP:4_000_000, coinPerHit: 40, killBonus: 25000, tierClass:'tier-4' },
  { tier:5, label:'TIER V',   name:'The CEO',            maxHP:10_000_000,coinPerHit:100, killBonus:100000, tierClass:'tier-5' },
  { tier:6, label:'TIER VI',  name:'SHADOW PROTOCOL',    maxHP:30_000_000,coinPerHit:250, killBonus:500000, tierClass:'tier-6' },
];
// Beyond last tier: tier 6 repeats with 3× HP scaling each time
function getSBTierData(tierIndex) {
  if (tierIndex < SB_TIERS.length) return SB_TIERS[tierIndex];
  // Extended tiers scale from tier-6 template
  const base = SB_TIERS[SB_TIERS.length - 1];
  const extra = tierIndex - (SB_TIERS.length - 1);
  const scale = Math.pow(3, extra);
  return {
    tier: tierIndex + 1,
    label: `TIER ${toRoman(tierIndex + 1)}`,
    name: 'SHADOW PROTOCOL',
    maxHP: Math.floor(base.maxHP * scale),
    coinPerHit: Math.floor(base.coinPerHit * Math.pow(2, extra)),
    killBonus: Math.floor(base.killBonus * Math.pow(2.5, extra)),
    tierClass: 'tier-6',
  };
}
function toRoman(n) {
  const map = [[1000,'M'],[900,'CM'],[500,'D'],[400,'CD'],[100,'C'],[90,'XC'],
               [50,'L'],[40,'XL'],[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']];
  let r = '';
  for (const [v, s] of map) { while (n >= v) { r += s; n -= v; } }
  return r;
}

/* ── Seasonal boss per-player state ──────────────────────────────────── */
let seasonalBossState = {
  tierIndex: 0,     // current tier (0 = first tier)
  hp: 0,            // current HP — 0 means uninitialized, use tierData.maxHP
  kills: 0,         // total defeats this account
  isDefeated: false,// brief "dead" window before respawn
};
let _sbAnimLocked = false; // prevent overlapping impact anims

/* ── Initialize on first load / after applyPayload ────────────────────── */
function initSeasonalBoss() {
  const td = getSBTierData(seasonalBossState.tierIndex);
  // If hp is 0 or not set, start at full HP for current tier
  if (!seasonalBossState.hp || seasonalBossState.hp <= 0) {
    seasonalBossState.hp = td.maxHP;
  }
  renderSeasonalBossUI();
}

/* ── Master render — syncs all DOM elements to current state ──────────── */
function renderSeasonalBossUI() {
  const td   = getSBTierData(seasonalBossState.tierIndex);
  const hp   = seasonalBossState.hp;
  const pct  = Math.max(0, hp / td.maxHP);

  // Name / tier label
  const nameEl  = document.getElementById('sb-name');
  const tierEl  = document.getElementById('sb-tier-badge');
  const killEl  = document.getElementById('sb-kill-count');
  const rewEl   = document.getElementById('sb-reward-label');
  if (nameEl)  nameEl.innerText  = td.name;
  if (tierEl)  { tierEl.innerText = td.label; tierEl.className = 'sb-tier-badge ' + td.tierClass; }
  if (killEl)  killEl.innerText  = seasonalBossState.kills.toLocaleString();
  if (rewEl)   rewEl.innerText   = `💰 +${td.coinPerHit}/hit`;

  // HP bar
  const fill   = document.getElementById('sb-hp-fill');
  const hpText = document.getElementById('sb-hp-text');
  if (fill) {
    fill.style.width = (pct * 100).toFixed(2) + '%';
    fill.classList.remove('hp-mid', 'hp-low', 'hp-dead');
    if      (pct <= 0)    fill.classList.add('hp-dead');
    else if (pct <= 0.20) fill.classList.add('hp-low');
    else if (pct <= 0.50) fill.classList.add('hp-mid');
  }
  if (hpText) {
    if (seasonalBossState.isDefeated) {
      hpText.innerText = '💀 DEFEATED — RESPAWNING...';
    } else {
      hpText.innerText = hp.toLocaleString() + ' / ' + td.maxHP.toLocaleString();
    }
  }

  // Danger pulsing border at ≤20% HP
  const zone = document.getElementById('sb-zone');
  if (zone) {
    zone.classList.toggle('sb-danger', pct > 0 && pct <= 0.20);
  }
}

/* ── Main click handler ────────────────────────────────────────────────── */
function attackSeasonalBoss(e) {
  if (isOBS || isCheating) return;
  if (!checkAntiCheat())   return;
  if (seasonalBossState.isDefeated) return;

  playClickSound();

  // ── Compute damage using same formula as main attack ─────────────────
  const effectiveCrit  = critChance + (milestoneBonuses.crit_bonus || 0);
  const isCrit         = (Math.random() * 100) < effectiveCrit;
  const synergyBonus   = 1 + (synergyLevel * 0.10);
  // Seasonal boss has no armor — raw player power matters more
  const dmg = Math.floor(
    myClickDmg * multi * itemBuffMultiplier * synergyBonus * prestigeBuffMulti * (isCrit ? 5 : 1)
  );

  // Apply damage
  const td  = getSBTierData(seasonalBossState.tierIndex);
  seasonalBossState.hp = Math.max(0, seasonalBossState.hp - dmg);

  // ── Coin reward per hit ───────────────────────────────────────────────
  const coinsEarned = Math.max(1, Math.floor(td.coinPerHit * 0.01 * (isCrit ? 3 : 1)));
  myCryptoFragments += coinsEarned;
  frenzy   = Math.min(100 + (milestoneBonuses.frenzy_cap || 0), frenzy + 5);
  updateUI();
  save();

  // ── Impact animation ──────────────────────────────────────────────────
  _triggerSBImpact(isCrit);

  // ── Damage number popup ───────────────────────────────────────────────
  const cx = e.clientX || 0;
  const cy = e.clientY || 0;
  _spawnSBDmgPopup('+' + dmg.toLocaleString(), cx, cy, isCrit ? 'sb-crit' : '');

  // Staggered coin popup
  setTimeout(() => {
    _spawnSBDmgPopup(
      '+' + coinsEarned + '💰',
      cx + (Math.random() - 0.5) * 40,
      cy - 20,
      'sb-coin'
    );
  }, 120);

  // Spawn hit sparks
  _spawnSBSparks(e);

  // ── Check death ───────────────────────────────────────────────────────
  if (seasonalBossState.hp <= 0) {
    _handleSBDefeat(td, cx, cy);
  } else {
    renderSeasonalBossUI();
  }
}

/* ── Visual impact trigger ────────────────────────────────────────────── */
function _triggerSBImpact(hard) {
  const img   = document.getElementById('sb-image');
  const flash = document.getElementById('sb-hit-flash');
  const zone  = document.getElementById('sb-zone');
  const glow  = document.getElementById('sb-bg-glow');

  // Hit flash
  if (flash) {
    flash.classList.add('flashing');
    setTimeout(() => flash.classList.remove('flashing'), hard ? 160 : 100);
  }

  // Pulse background glow
  if (glow) {
    glow.style.opacity = '0';
    setTimeout(() => { glow.style.opacity = '1'; }, 30);
    setTimeout(() => { glow.style.opacity = ''; }, 200);
  }

  // Boss image zoom/shake — only if not already animating
  if (img && !_sbAnimLocked) {
    _sbAnimLocked = true;
    const cls = hard ? 'sb-hard-impact' : 'sb-impact';
    img.classList.remove('sb-impact', 'sb-hard-impact');
    void img.offsetWidth; // reflow to restart
    img.classList.add(cls);
    img.addEventListener('animationend', () => {
      img.classList.remove(cls);
      _sbAnimLocked = false;
    }, { once: true });
    // Safety unlock
    setTimeout(() => { _sbAnimLocked = false; }, 400);
  }
}

/* ── Spawn hit spark particles at click position ─────────────────────── */
function _spawnSBSparks(e) {
  const container = document.getElementById('sb-particles');
  if (!container) return;

  const zone = document.getElementById('sb-zone');
  const rect = zone ? zone.getBoundingClientRect() : null;
  const lx   = rect ? (e.clientX - rect.left) : 50;
  const ly   = rect ? (e.clientY - rect.top)  : 80;

  const colors  = ['#f1c40f', '#ff8800', '#fff', '#ff4400', '#ffcc00'];
  const count   = 7 + Math.floor(Math.random() * 5);

  for (let i = 0; i < count; i++) {
    const spark = document.createElement('div');
    spark.className = 'sb-spark';
    const angle  = Math.random() * Math.PI * 2;
    const dist   = 20 + Math.random() * 45;
    const size   = 3 + Math.random() * 5;
    const color  = colors[Math.floor(Math.random() * colors.length)];
    const delay  = (Math.random() * 0.08).toFixed(3);
    spark.style.cssText = `
      left:${lx}px; top:${ly}px; width:${size}px; height:${size}px;
      background:${color}; box-shadow:0 0 4px ${color};
      --sx:${(Math.cos(angle) * dist).toFixed(1)}px;
      --sy:${(Math.sin(angle) * dist).toFixed(1)}px;
      animation-delay:${delay}s;`;
    container.appendChild(spark);
    // Clean up after animation
    setTimeout(() => spark.remove(), 700);
  }
}

/* ── Floating damage number ──────────────────────────────────────────── */
function _spawnSBDmgPopup(text, cx, cy, extraClass = '') {
  const pop = document.createElement('div');
  pop.className = 'sb-dmg-popup' + (extraClass ? ' ' + extraClass : '');
  pop.innerText  = text;
  const tx  = (Math.random() - 0.5) * 80;
  const ty  = -40 - Math.random() * 40;
  const rot = (Math.random() - 0.5) * 18;
  pop.style.cssText = `left:${cx}px; top:${cy}px; --tx:${tx}px; --ty:${ty}px; --rot:${rot}deg;`;
  document.body.appendChild(pop);
  setTimeout(() => pop.remove(), 1600);
}

/* ── Handle boss defeat ──────────────────────────────────────────────── */
function _handleSBDefeat(td, cx, cy) {
  if (seasonalBossState.isDefeated) return;
  seasonalBossState.isDefeated = true;
  seasonalBossState.kills++;

  // Award kill bonus
  myCryptoFragments += Math.max(5, Math.floor(td.killBonus * 0.01));
  updateUI();
  save();

  // Shake + defeated banner
  const zone   = document.getElementById('sb-zone');
  const banner = document.getElementById('sb-defeated-banner');
  if (zone) {
    zone.classList.remove('sb-danger');
    zone.classList.add('sb-death-shake');
    setTimeout(() => zone.classList.remove('sb-death-shake'), 600);
  }
  if (banner) {
    banner.classList.add('visible');
    setTimeout(() => banner.classList.remove('visible'), 2000);
  }

  // Kill bonus popup
  setTimeout(() => {
    _spawnSBDmgPopup(
      '☠️ +' + td.killBonus.toLocaleString() + ' COINS!',
      cx + (Math.random() - 0.5) * 30,
      cy - 30,
      'sb-kill-bonus'
    );
  }, 200);

  // Flash HP bar dead
  renderSeasonalBossUI();

  // Respawn on next tier after a delay
  setTimeout(() => {
    seasonalBossState.tierIndex++;
    seasonalBossState.hp = getSBTierData(seasonalBossState.tierIndex).maxHP;
    seasonalBossState.isDefeated = false;
    save();
    renderSeasonalBossUI();
    // Brief entrance flash on new tier
    _triggerSBTierEntrance();
  }, 2800);
}

/* ── Tier entrance fanfare ────────────────────────────────────────────── */
function _triggerSBTierEntrance() {
  const img = document.getElementById('sb-image');
  if (!img) return;
  img.classList.remove('sb-impact', 'sb-hard-impact');
  void img.offsetWidth;
  img.classList.add('sb-hard-impact');
  img.addEventListener('animationend', () => img.classList.remove('sb-hard-impact'), { once: true });

  const td = getSBTierData(seasonalBossState.tierIndex);
  // Show a brief banner for new tier
  const pop = document.createElement('div');
  pop.style.cssText = 'position:fixed;top:38%;left:50%;transform:translate(-50%,-50%) scale(0.5);opacity:0;' +
    'background:linear-gradient(135deg,#200010,#400020);border:3px solid #ff3366;border-radius:8px;' +
    'padding:18px 36px;z-index:400005;text-align:center;font-family:VT323,monospace;' +
    'box-shadow:0 0 60px rgba(255,0,80,0.7);pointer-events:none;' +
    'transition:transform 0.35s cubic-bezier(0.2,1.5,0.4,1),opacity 0.3s;';
  pop.innerHTML = `
    <div style="font-size:2rem;line-height:1">⚠️</div>
    <div style="font-size:2rem;color:#ff3366;text-shadow:0 0 14px #ff3366;margin:4px 0">${td.label} UNLOCKED</div>
    <div style="font-size:1.3rem;color:#fff">${td.name}</div>
    <div style="font-size:1rem;color:#ff8888;margin-top:4px">HP: ${td.maxHP.toLocaleString()} | Bonus: +${td.killBonus.toLocaleString()} coins</div>`;
  document.body.appendChild(pop);
  requestAnimationFrame(() => { pop.style.transform='translate(-50%,-50%) scale(1)'; pop.style.opacity='1'; });
  setTimeout(() => {
    pop.style.opacity = '0'; pop.style.transform = 'translate(-50%,-50%) scale(0.85)';
    setTimeout(() => pop.remove(), 380);
  }, 3000);
}

/* ══════════════════════════════════════════════════════════════════════════
   BIND ALL INTERACTIONS
════════════════════════════════════════════════════════════════════════════ */
function bindInteractions(){
  console.log('=== bindInteractions called ===');

  // ─── Intro buttons ────────────────────────────────────────────────────
  _initIntroButtons();

  const btnClockIn=document.getElementById('btn-clock-in');
  if(btnClockIn){
    btnClockIn.addEventListener('click',()=>{
      const input=document.getElementById('username-input');
      const name=input?input.value.trim():'';
      if(!name){alert('Enter your Employee ID first!');return;}
      myUser=name; save();
      document.getElementById('login-screen').style.display='none';
      document.getElementById('game-container').style.display='block';
      bgm.play().catch(()=>{});
      upsertPlayerCard(myUser); registerEmployee(myUser); refreshCubicle(); updateUI();
      setTimeout(() => enforceIdBadge(), 800);
    });
  }

  const arena=document.getElementById('battle-arena');
  if(arena) arena.addEventListener('click',(e)=>{ if(e.target.closest('#skill-panel')||e.target.closest('.action-buttons'))return; attack(e); });
  const btnAttack=document.getElementById('btn-attack');
  if(btnAttack) btnAttack.addEventListener('click',attack);

  // ─── SEASONAL BOSS click ───────────────────────────────────────────────
  const sbZone = document.getElementById('sb-zone');
  if(sbZone) sbZone.addEventListener('click', (e) => attackSeasonalBoss(e));

  const buyClick=document.getElementById('buy-click');
  if(buyClick) buyClick.addEventListener('click',()=>{if(myCoins>=clickCost){myCoins-=clickCost;myClickDmg+=2500;clickCost=Math.ceil(clickCost*1.6);updateUI();save();}});
  const buyAuto=document.getElementById('buy-auto');
  // hire mercs removed
  const buyCrit=document.getElementById('buy-crit');
  if(buyCrit) buyCrit.addEventListener('click',()=>{if(myCoins>=critCost){myCoins-=critCost;critChance+=5;critCost=Math.ceil(critCost*1.8);updateUI();save();}});
  const buyOvertime=document.getElementById('buy-overtime');
  if(buyOvertime) buyOvertime.addEventListener('click',()=>{if(!overtimeUnlocked&&myCoins>=1500){myCoins-=1500;overtimeUnlocked=true;if(myAutoDmg>0)startAutoTimer();updateUI();save();}});
  const buySynergy=document.getElementById('buy-synergy');
  if(buySynergy) buySynergy.addEventListener('click',()=>{if(myCoins>=synergyCost){myCoins-=synergyCost;synergyLevel++;synergyCost=Math.ceil(synergyCost*1.8);updateUI();save();}});
  const buyRage=document.getElementById('buy-rage');
  if(buyRage) buyRage.addEventListener('click',()=>{if(!rageFuelUnlocked&&myCoins>=rageCost){myCoins-=rageCost;rageFuelUnlocked=true;updateUI();save();}});
  const buyHustle=document.getElementById('buy-hustle');
  if(buyHustle) buyHustle.addEventListener('click',()=>{if(myCoins>=hustleCost){myCoins-=hustleCost;hustleCoinsPerClick+=2;hustleCost=Math.ceil(hustleCost*1.5);updateUI();save();}});

  // ─── SKILL CLICKS ─────────────────────────────────────────────────────
  const skillPhishing=document.getElementById('skill-phishing');
  if(skillPhishing) skillPhishing.addEventListener('click',()=>{ openPhishingGame(); });
  const skillFirewall=document.getElementById('skill-firewall');
  if(skillFirewall) skillFirewall.addEventListener('click',openFirewallGame);
  const skillRecovery=document.getElementById('skill-recovery');
  if(skillRecovery) skillRecovery.addEventListener('click',()=>{ openRecoveryGame(); });
  const skillEncryption=document.getElementById('skill-encryption');
  if(skillEncryption) skillEncryption.addEventListener('click',()=>{const o=document.getElementById('br-intro-overlay');if(o)o.style.display='flex';});
  const skillAnalytics=document.getElementById('skill-analytics');
  if(skillAnalytics) skillAnalytics.addEventListener('click',()=>{const o=document.getElementById('analytics-overlay');if(o)o.style.display='flex';});
  const skillNetworking=document.getElementById('skill-networking');
  if(skillNetworking) skillNetworking.addEventListener('click',()=>{const o=document.getElementById('networking-overlay');if(o)o.style.display='flex';});

  // ─── PHISHING ─────────────────────────────────────────────────────────
  // (phishing and recovery launch directly — no instructor overlays)
  const btnLegit=document.getElementById('btn-legit');
  if(btnLegit) btnLegit.addEventListener('click',()=>answerPhish(false));
  const btnPhish=document.getElementById('btn-phish');
  if(btnPhish) btnPhish.addEventListener('click',()=>answerPhish(true));
  const phishClose=document.getElementById('phish-close-btn');
  if(phishClose) phishClose.addEventListener('click',()=>{document.getElementById('phishing-game-overlay').style.display='none';});

  // ─── RECOVERY ─────────────────────────────────────────────────────────

  const recExit=document.getElementById('recovery-exit-btn');
  if(recExit) recExit.addEventListener('click',()=>closeRecoveryGame());

  // ─── BATTLE ROYALE (replaces Encryption) ─────────────────────────────
  // ─── PURGE (OSU) ──────────────────────────────────────────────────────
  const brIntroClose=document.getElementById('br-intro-close');
  if(brIntroClose) brIntroClose.addEventListener('click',()=>{document.getElementById('br-intro-overlay').style.display='none';});
  const brStartBtn=document.getElementById('br-start-btn');
  if(brStartBtn) brStartBtn.addEventListener('click',()=>{document.getElementById('br-intro-overlay').style.display='none';openPurgeGame();});
  const brExitBtn=document.getElementById('br-exit-btn');
  if(brExitBtn) brExitBtn.addEventListener('click',()=>closePurgeGame());

  // ─── ANALYTICS ────────────────────────────────────────────────────────
  const anaInstClose=document.getElementById('analytics-inst-close');
  if(anaInstClose) anaInstClose.addEventListener('click',()=>{document.getElementById('analytics-overlay').style.display='none';});
  const anaStart=document.getElementById('analytics-start-btn');
  if(anaStart) anaStart.addEventListener('click',()=>{document.getElementById('analytics-overlay').style.display='none';openAnalyticsLab();});
  const anaClose=document.getElementById('analytics-close-btn');
  if(anaClose) anaClose.addEventListener('click',()=>{document.getElementById('analytics-game-overlay').style.display='none';});
  const anaCollect=document.getElementById('analytics-collect-btn');
  if(anaCollect) anaCollect.addEventListener('click',()=>collectAnalyticsRewards());

  // ─── NETWORKING ───────────────────────────────────────────────────────
  const netInstClose=document.getElementById('networking-inst-close');
  if(netInstClose) netInstClose.addEventListener('click',()=>{document.getElementById('networking-overlay').style.display='none';});
  const netAI=document.getElementById('networking-ai-btn');
  if(netAI) netAI.addEventListener('click',()=>{document.getElementById('networking-overlay').style.display='none';openNetworkingGame('ai');});
  const netPvP=document.getElementById('networking-pvp-btn');
  if(netPvP) netPvP.addEventListener('click',()=>{document.getElementById('networking-overlay').style.display='none';openNetworkingLobby();});
  const netExit=document.getElementById('networking-exit-btn');
  if(netExit) netExit.addEventListener('click',()=>closeNetworkingGame());

  // ─── MY WORK DESK ─────────────────────────────────────────────────────
  const btnOpenDesk = document.getElementById('btn-open-desk');
  if(btnOpenDesk){
    btnOpenDesk.addEventListener('click', () => {
      const overlay = document.getElementById('workdesk-overlay');
      if(overlay){ overlay.style.display = 'flex'; maybeShowDeskTutorial(); switchDeskTab(_deskActiveTab); }
    });
  }
  const btnCloseDesk = document.getElementById('workdesk-close-btn');
  if(btnCloseDesk){ btnCloseDesk.addEventListener('click', () => { document.getElementById('workdesk-overlay').style.display='none'; }); }
  const deskOverlay = document.getElementById('workdesk-overlay');
  if(deskOverlay){ deskOverlay.addEventListener('click', (e) => { if(e.target===deskOverlay) deskOverlay.style.display='none'; }); }
  const tabOverview = document.getElementById('desk-tab-overview');
  if(tabOverview) tabOverview.addEventListener('click', () => switchDeskTab('overview'));
  const tabCollection = document.getElementById('desk-tab-collection');
  if(tabCollection) tabCollection.addEventListener('click', () => switchDeskTab('collection'));
  const tabCrates = document.getElementById('desk-tab-crates');
  if(tabCrates) tabCrates.addEventListener('click', () => switchDeskTab('crates'));

  // ── Avatar / ID Badge ─────────────────────────────────────────────────
  const _btnAvatar = document.getElementById('btn-avatar');
  if (_btnAvatar) {
    _btnAvatar.addEventListener('click', () => {
      renderAvatarPreview();
      document.getElementById('avatar-overlay').style.display = 'flex';
    });
  }
  const _btnSaveAvatar = document.getElementById('save-avatar-btn');
  if (_btnSaveAvatar) {
    _btnSaveAvatar.addEventListener('click', () => {
      playerAvatar.isSetup = true;
      document.getElementById('avatar-overlay').style.display = 'none';
      const ab = document.getElementById('btn-avatar');
      if (ab) { ab.innerText = '👤 ID BADGE'; ab.style.background = ''; ab.style.boxShadow = ''; }
      save();
    });
  }

  console.log('=== bindInteractions complete ===');
}

/* ══════════════════════════════════════════════════════════════════════════
   AMBIENT BACKGROUND PARTICLES — Inject into each minigame overlay on open
   Lightweight CSS-animated emoji floaters, removed on close
════════════════════════════════════════════════════════════════════════════ */
const AMBIENT_CONFIGS = {
  recovery: {
    class: 'rec-ambient',
    particles: [
      { emoji:'💻', count:4, dMin:7, dMax:12 },
      { emoji:'📡', count:3, dMin:9, dMax:14 },
      { emoji:'🔌', count:3, dMin:8, dMax:11 },
      { emoji:'⚡', count:5, dMin:5, dMax:9  },
      { emoji:'💿', count:3, dMin:10,dMax:16 },
    ]
  },
  encryption: {
    class: 'enc-ambient',
    particles: [
      { emoji:'⚔️', count:4, dMin:8,  dMax:14 },
      { emoji:'💀', count:3, dMin:9,  dMax:13 },
      { emoji:'🔫', count:3, dMin:11, dMax:15 },
      { emoji:'🩸', count:4, dMin:7,  dMax:10 },
      { emoji:'💥', count:3, dMin:12, dMax:18 },
    ]
  },
  analytics: {
    class: 'ana-ambient',
    particles: [
      { emoji:'📊', count:5, dMin:10,dMax:18 },
      { emoji:'📈', count:4, dMin:12,dMax:20 },
      { emoji:'📉', count:3, dMin:9, dMax:14 },
      { emoji:'🗺️', count:3, dMin:14,dMax:22 },
      { emoji:'💰', count:4, dMin:8, dMax:13 },
    ]
  },
  networking: {
    class: 'net-ambient',
    particles: [
      { emoji:'📶', count:4, dMin:7, dMax:12 },
      { emoji:'🌐', count:3, dMin:9, dMax:14 },
      { emoji:'💼', count:4, dMin:8, dMax:11 },
      { emoji:'🤝', count:3, dMin:11,dMax:16 },
      { emoji:'📱', count:3, dMin:9, dMax:13 },
    ]
  },
};

function injectAmbientParticles(overlayId, type) {
  const overlay = document.getElementById(overlayId);
  if (!overlay) return;
  // Remove any existing ambient layer
  overlay.querySelectorAll('.rec-ambient,.enc-ambient,.ana-ambient,.net-ambient').forEach(el => el.remove());

  const cfg = AMBIENT_CONFIGS[type];
  if (!cfg) return;

  const container = document.createElement('div');
  container.className = cfg.class;

  cfg.particles.forEach(({ emoji, count, dMin, dMax }) => {
    for (let i = 0; i < count; i++) {
      const span = document.createElement('span');
      span.innerText = emoji;
      const left   = 5 + Math.random() * 90;  // % across width
      const delay  = Math.random() * dMax;     // stagger start
      const dur    = dMin + Math.random() * (dMax - dMin);
      const rot    = (Math.random() - 0.5) * 60;
      span.style.cssText = `left:${left}%;--d:${dur}s;--delay:${delay}s;--rot:${rot}deg;animation-duration:${dur}s;animation-delay:${delay}s;`;
      container.appendChild(span);
    }
  });

  overlay.appendChild(container);
}

/* ══════════════════════════════════════════════════════════════════════════
   RECOVERY MINIGAME — Jetpack Joyride side-scroller
   60s fixed run | data tunnel bg | difficulty spike at 40s
   Player: 🚀  Obstacles: 🔴⚡🔥  Pickups: 💿
════════════════════════════════════════════════════════════════════════════ */
let recGame = null;

function openRecoveryGame() {
  const overlay = document.getElementById('recovery-game-overlay');
  if (!overlay) return;
  overlay.style.display = 'flex';
  injectAmbientParticles('recovery-game-overlay', 'recovery');
  if (recGame) recGame.destroy();
  recGame = new RecoveryGame();
  recGame.start();
}
function closeRecoveryGame() {
  if (recGame) { recGame.destroy(); recGame = null; }
  const overlay = document.getElementById('recovery-game-overlay');
  if (overlay) { overlay.style.display = 'none'; overlay.querySelectorAll('.rec-ambient').forEach(el=>el.remove()); }
}

class RecoveryGame {
  constructor() {
    this.canvas = document.getElementById('recovery-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.W = this.canvas.width;
    this.H = this.canvas.height;
    this.GY = this.H - 60;  // ground y
    this._raf = null;
    this._keyDown = this._onKey.bind(this);
    this._keyUp = this._onKeyUp.bind(this);
    this.touchActive = false;
    this._touchStart = () => { this.touchActive = true; };
    this._touchEnd = () => { this.touchActive = false; };
    this._initState();
  }

  _initState() {
    this.t = 0;             // elapsed seconds
    this.lives = 3;
    this.packets = 0;
    this.scrollX = 0;
    this.speed = 220;       // px/s
    this.dead = false;
    this.won = false;
    this.resultShown = false;
    this.started = false;   // waiting for first spacebar/click
    this.iFrames = 0;       // invincibility frames after hit
    this.jetActive = false;
    this.jetFuel = 0;
    // Player
    this.p = { x: 80, y: this.GY - 50, w: 40, h: 40, vy: 0, onGround: true };
    // Terrain rows (3 lanes: top 33%, mid 33%, bot 33% above GY)
    this.laneH = (this.GY - 40) / 3;
    // Obstacles and pickups
    this.obs = [];
    this.pickups = [];
    this.lastObsX = this.W + 200;
    this.lastPickX = this.W + 100;
    // Terminal text scrolling
    this.termLines = this._genTermLines();
    this.termOffset = 0;
    // Particle system
    this.parts = [];
    this.lastFrameTime = null;
    this._updateHUD();
  }

  _genTermLines() {
    const templates = [
      'INITIATING DATA RECOVERY PROTOCOL...','SCANNING SECTOR 0x{HEX}...','INTEGRITY CHECK: {P}%',
      'PACKET #{N} LOCATED','FIREWALL BYPASS SEQUENCE {N}','ENCRYPTION KEY MISMATCH — RETRYING',
      'CONNECTION TIMEOUT: REROUTING...','SECTOR CORRUPT — SKIPPING','RECOVERY ESTIMATE: {T}s REMAINING',
      'NODE LINK ESTABLISHED','SIGNAL STRENGTH: {P}%','ERROR 0x{HEX}: NULL POINTER','STREAM BUFFER OVERFLOW',
      'AUTHENTICATING AGENT...','CHECKSUM VALID','DATA FRAGMENTATION DETECTED','REBUILDING INDEX TABLE',
    ];
    const lines = [];
    for (let i = 0; i < 40; i++) {
      const t = templates[Math.floor(Math.random() * templates.length)]
        .replace('{HEX}', Math.floor(Math.random()*0xFFFF).toString(16).toUpperCase().padStart(4,'0'))
        .replace('{P}', Math.floor(Math.random()*100))
        .replace('{N}', Math.floor(Math.random()*9999))
        .replace('{T}', Math.floor(Math.random()*60));
      lines.push(t);
    }
    return lines;
  }

  start() {
    document.addEventListener('keydown', this._keyDown);
    document.addEventListener('keyup', this._keyUp);
    this._canvasClick = () => {
      if (!this.started) { this.started = true; return; }
      this.jetActive = true;
      setTimeout(() => { this.jetActive = false; }, 180);
    };
    this._touchStartFn = () => {
      if (!this.started) { this.started = true; return; }
      this.touchActive = true;
    };
    this._touchEndFn = () => { this.touchActive = false; };
    this.canvas.addEventListener('click', this._canvasClick);
    this.canvas.addEventListener('touchstart', this._touchStartFn);
    this.canvas.addEventListener('touchend', this._touchEndFn);
    this.lastFrameTime = performance.now();
    this._raf = requestAnimationFrame(t => this._loop(t));
  }

  destroy() {
    if (this._raf) cancelAnimationFrame(this._raf);
    document.removeEventListener('keydown', this._keyDown);
    document.removeEventListener('keyup', this._keyUp);
    if (this._canvasClick)   this.canvas.removeEventListener('click', this._canvasClick);
    if (this._touchStartFn)  this.canvas.removeEventListener('touchstart', this._touchStartFn);
    if (this._touchEndFn)    this.canvas.removeEventListener('touchend', this._touchEndFn);
  }

  _onKey(e) {
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
      e.preventDefault();
      if (!this.started) { this.started = true; return; }
      this.jetActive = true;
    }
  }
  _onKeyUp(e) {
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') this.jetActive = false;
  }

  _loop(now) {
    if (!this.dead && !this.won) {
      const dt = Math.min((now - this.lastFrameTime) / 1000, 0.05);
      this.lastFrameTime = now;
      if (this.started) this._update(dt);
      else this.lastFrameTime = now; // keep timer fresh so first frame dt is 0
    }
    this._draw();
    if (!this.resultShown) this._raf = requestAnimationFrame(t => this._loop(t));
  }

  _update(dt) {
    this.t += dt;
    if (this.t >= 60) { this._win(); return; }
    if (this.iFrames > 0) this.iFrames -= dt;

    // Speed ramp
    const hardMode = this.t > 40;
    this.speed = hardMode ? 340 + (this.t - 40) * 6 : 220 + this.t * 2;
    this.scrollX += this.speed * dt;

    // Player physics
    const p = this.p;
    const GRAVITY = 900;
    const JET_FORCE = -700;
    const TERMINAL = 600;

    if (this.jetActive || this.touchActive) {
      p.vy = Math.max(p.vy + JET_FORCE * dt, -380);
    } else {
      p.vy = Math.min(p.vy + GRAVITY * dt, TERMINAL);
    }
    p.y += p.vy * dt;

    if (p.y >= this.GY - p.h) { p.y = this.GY - p.h; p.vy = 0; p.onGround = true; }
    else { p.onGround = false; }
    if (p.y < 10) { p.y = 10; p.vy = Math.max(p.vy, 0); }

    // Spawn obstacles
    const obsGap = hardMode ? 220 + Math.random()*120 : 320 + Math.random()*200;
    if (this.scrollX - (this.lastObsX - this.W) > obsGap) {
      this.lastObsX = this.scrollX + this.W + 20;
      this._spawnObs(hardMode);
    }

    // Spawn pickups
    const pickGap = 280 + Math.random()*180;
    if (this.scrollX - (this.lastPickX - this.W) > pickGap) {
      this.lastPickX = this.scrollX + this.W + 20;
      this.pickups.push({ wx: this.lastPickX, y: 80 + Math.random()*(this.GY - 120), r: 18 });
    }

    // Remove off-screen
    this.obs = this.obs.filter(o => o.wx > this.scrollX - 100);
    this.pickups = this.pickups.filter(pk => pk.wx > this.scrollX - 50);

    // Collision: pickups
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pk = this.pickups[i];
      const sx = pk.wx - this.scrollX;
      if (Math.abs(sx - (p.x + p.w/2)) < pk.r + p.w/2 && Math.abs(pk.y - (p.y + p.h/2)) < pk.r + p.h/2) {
        this.packets++;
        this.pickups.splice(i, 1);
        this._addSkillParticles(p.x + p.w/2, p.y);
        this._updateHUD();
      }
    }

    // Collision: obstacles
    if (this.iFrames <= 0) {
      for (const o of this.obs) {
        const sx = o.wx - this.scrollX;
        const ob = { x: sx + o.ox, y: o.y, w: o.w, h: o.h };
        if (p.x < ob.x + ob.w && p.x + p.w > ob.x && p.y < ob.y + ob.h && p.y + p.h > ob.y) {
          this.lives--;
          this.iFrames = 1.5;
          this._updateHUD();
          if (this.lives <= 0) { this._die(); return; }
          break;
        }
      }
    }

    // Update particles
    this.parts = this.parts.filter(pt => pt.life > 0);
    for (const pt of this.parts) { pt.x += pt.vx*dt; pt.y += pt.vy*dt; pt.vy += 200*dt; pt.life -= dt; }

    // Terminal text scroll
    this.termOffset += dt * 18;
    if (this.termOffset > 20) this.termOffset -= 20;

    this._updateHUD();
  }

  _spawnObs(hard) {
    const type = Math.random();
    const wx = this.lastObsX;
    if (type < 0.3) {
      // Floor spike cluster
      const count = hard ? 3 : 2;
      for (let i = 0; i < count; i++) {
        this.obs.push({ wx: wx + i * 55, ox: 0, y: this.GY - 54, w: 38, h: 54, emoji: '🔴' });
      }
    } else if (type < 0.55) {
      // Ceiling obstacle
      const h = 60 + Math.random() * 60;
      this.obs.push({ wx, ox: 0, y: 0, w: 44, h, emoji: '⚡' });
    } else if (type < 0.75) {
      // Mid-air wall gap
      const gapY = 120 + Math.random() * (this.GY - 260);
      const gapH = hard ? 120 : 180;
      this.obs.push({ wx, ox: 0, y: 0, w: 40, h: gapY, emoji: '🔥' });
      this.obs.push({ wx, ox: 0, y: gapY + gapH, w: 40, h: this.GY - gapY - gapH, emoji: '🔥' });
    } else {
      // Moving block (represented statically, no true movement for simplicity)
      this.obs.push({ wx, ox: 0, y: this.GY - 100 - Math.random()*120, w: 36, h: 36, emoji: '💀' });
    }
  }

  _addSkillParticles(x, y) {
    for (let i = 0; i < 8; i++) {
      this.parts.push({ x, y, vx: (Math.random()-0.5)*180, vy: -80-Math.random()*120, life: 0.7, color: '#00ffcc' });
    }
  }

  _die() {
    this.dead = true;
    const secs = Math.floor(this.t);
    const xp = Math.max(50, secs * 30 + this.packets * 90);
    addSkillXP('recovery', xp);
    showXPGain('recovery', xp);
    checkOrnamentDrop('recovery');
    myCryptoFragments += Math.floor(xp * 0.05 + 5);
    setTimeout(() => this._showResult(false, secs), 500);
  }

  _win() {
    this.won = true;
    const xp = 3500 + this.packets * 120;
    addSkillXP('recovery', xp);
    showXPGain('recovery', xp);
    checkOrnamentDrop('recovery');
    myCryptoFragments += Math.floor(xp * 0.08 + 20);
    setTimeout(() => this._showResult(true, 60), 300);
  }

  _showResult(won, secs) {
    if (this.resultShown) return; this.resultShown = true;
    if (this._raf) cancelAnimationFrame(this._raf);
    const overlay = document.getElementById('recovery-game-overlay');
    if (!overlay) return;
    const div = document.createElement('div');
    div.style.cssText = 'position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(0,0,0,0.88);z-index:20;text-align:center;font-family:VT323,monospace;';
    const xp = won ? 3500 + this.packets*120 : Math.max(50, secs*30 + this.packets*90);
    div.innerHTML = `
      <div style="font-size:3.5rem">${won?'✅ CONNECTION RESTORED!':'💀 SIGNAL LOST'}</div>
      <div style="font-size:1.6rem;color:#fff;margin:8px 0">Survived <strong style="color:#f1c40f">${secs}s</strong> | 💿 <strong style="color:#00ffcc">${this.packets}</strong> packets recovered</div>
      <div style="font-size:1.3rem;color:#c89fff;margin-bottom:18px">💾 +${xp.toLocaleString()} Recovery XP</div>
      <div style="display:flex;gap:20px;">
        <button id="rec-retry" style="padding:10px 32px;background:linear-gradient(90deg,#00ffcc,#0088ff);border:3px solid #fff;color:#000;font-family:VT323,monospace;font-size:1.6rem;cursor:pointer">▶ RECONNECT</button>
        <button id="rec-quit" style="padding:10px 32px;background:transparent;border:2px solid #ff4444;color:#ff4444;font-family:VT323,monospace;font-size:1.6rem;cursor:pointer">✕ DISCONNECT</button>
      </div>`;
    overlay.appendChild(div);
    document.getElementById('rec-retry').onclick = () => { div.remove(); this._initState(); this.lastFrameTime = performance.now(); this.resultShown = false; this._raf = requestAnimationFrame(t => this._loop(t)); };
    document.getElementById('rec-quit').onclick = () => closeRecoveryGame();
  }

  _updateHUD() {
    const t = document.getElementById('rec-timer'); if (t) t.innerText = Math.max(0, Math.ceil(60 - this.t));
    const p = document.getElementById('rec-packets'); if (p) p.innerText = this.packets;
    const l = document.getElementById('rec-lives'); if (l) l.innerText = '❤️'.repeat(Math.max(0,this.lives));
  }

  _draw() {
    const ctx = this.ctx, W = this.W, H = this.H, GY = this.GY;
    // Background — dark data tunnel
    ctx.fillStyle = '#030810';
    ctx.fillRect(0, 0, W, H);

    // Scrolling grid lines
    const gx = this.scrollX % 60;
    ctx.strokeStyle = 'rgba(0,255,204,0.07)'; ctx.lineWidth = 1;
    for (let x = -gx; x < W; x += 60) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
    const gy2 = (this.scrollX * 0.5) % 40;
    for (let y = -gy2; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }

    // Terminal text (left side, faint)
    ctx.save();
    ctx.font = '11px monospace'; ctx.fillStyle = 'rgba(0,255,100,0.12)';
    const lineH = 18;
    const visible = Math.ceil(H / lineH) + 2;
    const offset = Math.floor(this.termOffset);
    for (let i = 0; i < visible; i++) {
      const li = (i + offset) % this.termLines.length;
      ctx.fillText(this.termLines[li], 8, i * lineH - (this.termOffset % 1) * lineH + 14);
    }
    ctx.restore();

    // Danger overlay in last 20s
    if (this.t > 40 && !this.dead && !this.won) {
      const pulse = Math.abs(Math.sin(this.t * 4)) * 0.06;
      ctx.fillStyle = `rgba(255,0,0,${pulse})`;
      ctx.fillRect(0, 0, W, H);
    }

    // Ground line
    ctx.shadowBlur = 10; ctx.shadowColor = '#00ffcc'; ctx.strokeStyle = '#00ffcc'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0,GY); ctx.lineTo(W,GY); ctx.stroke(); ctx.shadowBlur=0;

    // Pickups
    for (const pk of this.pickups) {
      const sx = pk.wx - this.scrollX;
      if (sx < -30 || sx > W + 30) continue;
      ctx.save(); ctx.font = `${pk.r*1.6}px serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.shadowBlur = 12; ctx.shadowColor = '#00ffcc';
      ctx.fillText('💿', sx, pk.y);
      ctx.shadowBlur=0; ctx.restore();
    }

    // Obstacles
    for (const o of this.obs) {
      const sx = o.wx - this.scrollX;
      if (sx < -60 || sx > W + 60) continue;
      ctx.save(); ctx.font = '28px serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.shadowBlur = 8; ctx.shadowColor = '#ff3366';
      // Fill rect first
      ctx.fillStyle = 'rgba(255,0,80,0.22)';
      ctx.fillRect(sx + o.ox, o.y, o.w, o.h);
      ctx.fillText(o.emoji, sx + o.ox + o.w/2, o.y + o.h);
      ctx.shadowBlur=0; ctx.restore();
    }

    // Player
    const p = this.p;
    const flicker = this.iFrames > 0 && Math.floor(this.iFrames * 10) % 2 === 0;
    if (!flicker) {
      ctx.save();
      ctx.font = '34px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.shadowBlur = 16; ctx.shadowColor = this.jetActive ? '#00ffff' : '#ff00ff';
      ctx.fillText('🚀', p.x + p.w/2, p.y + p.h + 4);
      ctx.shadowBlur=0; ctx.restore();
      // Jet exhaust
      if (this.jetActive) {
        for (let i = 0; i < 3; i++) {
          this.parts.push({ x: p.x+p.w/2+(Math.random()-0.5)*14, y: p.y+p.h, vx:(Math.random()-0.5)*40, vy:80+Math.random()*80, life:0.25, color:'#ff8800' });
        }
      }
    }

    // Particles
    for (const pt of this.parts) {
      ctx.globalAlpha = Math.max(0, pt.life * 2);
      ctx.fillStyle = pt.color;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, 4, 0, Math.PI*2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Timer bar
    const prog = Math.min(this.t / 60, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0,0,W,8);
    const bg = ctx.createLinearGradient(0,0,W,0);
    bg.addColorStop(0,'#00ffcc'); bg.addColorStop(0.67,'#f1c40f'); bg.addColorStop(1,'#ff3366');
    ctx.fillStyle = bg; ctx.fillRect(0,0,W*prog,8);

    // HUD timer text on canvas
    if (!this.dead && !this.won) {
      ctx.fillStyle='rgba(0,255,204,0.7)'; ctx.font='14px VT323,monospace';
      ctx.textAlign='right'; ctx.fillText('HOLD SPACE/UP TO JET', W-8, H-8);
    }
    ctx.textAlign='left';

    // Pre-start overlay — shown until player presses SPACE or clicks
    if (!this.started && !this.dead && !this.won) {
      // Dim background
      ctx.fillStyle = 'rgba(0,0,0,0.72)';
      ctx.fillRect(0, 0, W, H);
      // Blinking prompt box
      const blink = Math.floor(Date.now() / 530) % 2 === 0;
      ctx.save();
      ctx.shadowBlur = 24; ctx.shadowColor = '#00ffcc';
      ctx.strokeStyle = '#00ffcc'; ctx.lineWidth = 2;
      const bw = 520, bh = 120, bx = (W - bw) / 2, by = (H - bh) / 2;
      ctx.fillStyle = 'rgba(0,20,15,0.95)';
      ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 8); ctx.fill(); ctx.stroke();
      ctx.shadowBlur = 0;
      // Title
      ctx.font = 'bold 28px VT323, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#00ffcc';
      ctx.fillText('💾 DATA RECOVERY PROTOCOL', W / 2, by + 34);
      // Blinking instruction
      if (blink) {
        ctx.font = '22px VT323, monospace';
        ctx.fillStyle = '#f1c40f';
        ctx.fillText('PRESS  ██SPACE██  OR  CLICK  TO  BEGIN', W / 2, by + 70);
      }
      // Sub-hint
      ctx.font = '14px VT323, monospace'; ctx.fillStyle = 'rgba(0,255,204,0.5)';
      ctx.fillText('Hold SPACE / UP / Click to boost the rocket', W / 2, by + 100);
      ctx.restore();
    }
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   BATTLE ROYALE MINIGAME — "CORPORATE PURGE"
   Top-down arena brawler, 60-second rounds, up to 5 players (AI fill)
   Weapons drop from weapon-yay.png sprite sheet
   Player faces from character_creator.jpg
════════════════════════════════════════════════════════════════════════════ */

/* ── Weapon definitions — sprite from weapon-yay.png (143×640) ─────────── */
const BR_WEAPONS = [
  // id, name, tier, damage, range, speed, fireRate, spriteY, spriteH, isMelee
  { id:'pistol',   name:'Pistol',       tier:0, dmg:20, range:200, spd:7,   rate:0.5, sy:58,  sh:60,  sx:0,   sw:143, melee:false },
  { id:'rifle',    name:'Rifle',        tier:1, dmg:15, range:280, spd:6,   rate:1.5, sy:157, sh:73,  sx:0,   sw:100, melee:false },
  { id:'sword_uc', name:'Energy Blade', tier:1, dmg:40, range:55,  spd:0,   rate:1.0, sy:168, sh:47,  sx:65,  sw:45,  melee:true  },
  { id:'axe_uc',   name:'Axe',         tier:1, dmg:35, range:52,  spd:0,   rate:0.8, sy:155, sh:55,  sx:95,  sw:48,  melee:true  },
  { id:'sniper',   name:'Sniper',       tier:2, dmg:70, range:400, spd:12,  rate:0.3, sy:330, sh:70,  sx:0,   sw:100, melee:false },
  { id:'sword_r',  name:'Crystal Sword',tier:2, dmg:60, range:60,  spd:0,   rate:1.2, sy:330, sh:70,  sx:55,  sw:88,  melee:true  },
  { id:'hammer',   name:'Mjolnir',      tier:3, dmg:90, range:65,  spd:0,   rate:0.6, sy:430, sh:90,  sx:62,  sw:81,  melee:true  },
  { id:'scythe',   name:'Void Scythe',  tier:3, dmg:75, range:70,  spd:0,   rate:1.0, sy:440, sh:80,  sx:0,   sw:65,  melee:true  },
  { id:'leg_sword',name:'LEGENDARY',    tier:4, dmg:120,range:80,  spd:0,   rate:1.5, sy:540, sh:40,  sx:0,   sw:143, melee:true  },
];
const BR_TIER_COLORS = ['#aaaaaa','#00ff88','#4488ff','#cc44ff','#ffcc00'];
const BR_TIER_NAMES  = ['Common','Uncommon','Rare','Epic','Legendary'];
const BR_TIER_SPAWN  = [0.50, 0.28, 0.14, 0.06, 0.02]; // spawn weight per tier

/* ── AI names ───────────────────────────────────────────────────────────── */
const BR_AI_NAMES = [
  'Intern_Kyle','MgmtRobot','HR_Unit_9','CFO_Bot','Temp_Alex',
  'SalesBot_X','DevOps_AI','Exec_Clone','BoardBot','Corp_Drone',
];

/* ══════════════════════════════════════════════════════════════════════════
   PURGE MINIGAME — "OSU PURGE"
   OSU-style click-circle rhythm game. Endless, gets harder every 30s.
   Mouse only. No music required (visual beat cues built in).
════════════════════════════════════════════════════════════════════════════ */

let purgeGame = null;

function openPurgeGame() {
  const overlay = document.getElementById('br-game-overlay');
  if (!overlay) return;
  overlay.style.display = 'flex';
  if (purgeGame) { purgeGame.destroy(); purgeGame = null; }
  purgeGame = new OsuPurgeGame();
  purgeGame.start();
}

function closePurgeGame() {
  if (purgeGame) { purgeGame.destroy(); purgeGame = null; }
  const el = document.getElementById('br-game-overlay');
  if (el) el.style.display = 'none';
  save();
}

/* ── Difficulty tiers — one step per 30 seconds ─────────────────────────── */
const OSU_TIERS = [
  // { spawnRate, approachTime, circleR, windowMs, maxOnScreen, label }
  { spawnRate:1.2, approachTime:1.4, circleR:46, windowMs:280, maxOn:2,  label:'INTERN',    color:'#00ffcc' },
  { spawnRate:1.5, approachTime:1.2, circleR:42, windowMs:240, maxOn:3,  label:'ASSOCIATE',  color:'#44ff88' },
  { spawnRate:1.8, approachTime:1.0, circleR:38, windowMs:200, maxOn:4,  label:'ANALYST',    color:'#ffdd00' },
  { spawnRate:2.1, approachTime:0.85,circleR:34, windowMs:165, maxOn:5,  label:'MANAGER',    color:'#ff9900' },
  { spawnRate:2.5, approachTime:0.70,circleR:30, windowMs:135, maxOn:6,  label:'DIRECTOR',   color:'#ff5500' },
  { spawnRate:3.0, approachTime:0.55,circleR:26, windowMs:110, maxOn:7,  label:'VP',         color:'#ff2200' },
  { spawnRate:3.6, approachTime:0.42,circleR:22, windowMs: 88, maxOn:8,  label:'C-SUITE',    color:'#ff00aa' },
  { spawnRate:4.2, approachTime:0.32,circleR:19, windowMs: 70, maxOn:9,  label:'LEGENDARY',  color:'#cc00ff' },
];

class OsuPurgeGame {
  constructor() {
    this.canvas = document.getElementById('br-canvas');
    this.ctx    = this.canvas ? this.canvas.getContext('2d') : null;
    this._raf   = null;

    this.W = 800;
    this.H = 560;

    // State
    this.score       = 0;
    this.combo       = 0;
    this.maxCombo    = 0;
    this.hp          = 100;   // 0-100
    this.elapsed     = 0;     // total seconds played
    this.tierIdx     = 0;
    this.spawnTimer  = 0;
    this.circles     = [];    // active hit circles
    this.effects     = [];    // visual pop FX
    this.comboFX     = [];    // floating score text
    this.over        = false;
    this.lastFrameTime = 0;
    this.mouseX      = this.W / 2;
    this.mouseY      = this.H / 2;
    this.circleSeq   = 0;     // combo number shown on circles

    // Cursor trail
    this.trail = [];

    // Bound handlers
    this._onMove  = this._mouseMove.bind(this);
    this._onClick = this._mouseClick.bind(this);
  }

  get tier() { return OSU_TIERS[Math.min(this.tierIdx, OSU_TIERS.length - 1)]; }

  start() {
    if (!this.ctx) return;
    this.canvas.addEventListener('mousemove', this._onMove);
    this.canvas.addEventListener('click',     this._onClick);
    this.canvas.style.cursor = 'none';
    this.canvas.style.borderColor = '#ff00cc';
    this.canvas.style.boxShadow   = '0 0 30px #ff00cc44';
    this.lastFrameTime = performance.now();
    this._updateHUD();
    this._raf = requestAnimationFrame(t => this._loop(t));
  }

  destroy() {
    if (this._raf) cancelAnimationFrame(this._raf);
    if (this.canvas) {
      this.canvas.removeEventListener('mousemove', this._onMove);
      this.canvas.removeEventListener('click',     this._onClick);
      this.canvas.style.cursor = 'default';
    }
  }

  /* ── Main loop ─────────────────────────────────────────────────────── */
  _loop(now) {
    const dt = Math.min((now - this.lastFrameTime) / 1000, 0.05);
    this.lastFrameTime = now;
    if (!this.over) this._update(dt);
    this._render();
    this._raf = requestAnimationFrame(t => this._loop(t));
  }

  /* ── Update ────────────────────────────────────────────────────────── */
  _update(dt) {
    this.elapsed += dt;

    // Difficulty ramp every 30s
    const newTier = Math.min(Math.floor(this.elapsed / 30), OSU_TIERS.length - 1);
    if (newTier > this.tierIdx) {
      this.tierIdx = newTier;
      this.effects.push({ type:'tier', x: this.W/2, y: this.H/2 - 40, life:1.5, maxLife:1.5, label: this.tier.label, color: this.tier.color });
    }

    // Spawn circles
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.circles.length < this.tier.maxOn) {
      this.spawnTimer = 1 / this.tier.spawnRate;
      this._spawnCircle();
    }

    // Age circles — miss if expired
    for (let i = this.circles.length - 1; i >= 0; i--) {
      const c = this.circles[i];
      c.age += dt;
      const lifespan = this.tier.approachTime + this.tier.windowMs/1000 + 0.18;
      if (c.age > lifespan) {
        this._miss(c);
        this.circles.splice(i, 1);
      }
    }

    // Age effects
    this.effects  = this.effects.filter(f => { f.life -= dt; return f.life > 0; });
    this.comboFX  = this.comboFX.filter(f => { f.life -= dt; return f.life > 0; });

    // Cursor trail
    this.trail.push({ x: this.mouseX, y: this.mouseY, life: 0.22 });
    this.trail = this.trail.filter(t => { t.life -= dt; return t.life > 0; });

    // HP drain per missed circle
    if (this.hp <= 0) this._gameOver();

    this._updateHUD();
  }

  _spawnCircle() {
    const r   = this.tier.circleR;
    const pad = r + 10;
    // Try to place away from existing circles
    let x, y, tries = 0;
    do {
      x = pad + Math.random() * (this.W - pad*2);
      y = pad + Math.random() * (this.H - pad*2);
      tries++;
    } while (tries < 20 && this.circles.some(c => Math.hypot(c.x-x, c.y-y) < r*2.8));

    this.circleSeq++;
    this.circles.push({
      x, y, r, age: 0,
      seq: this.circleSeq,
      hit: false,
      approachTime: this.tier.approachTime,
      windowMs: this.tier.windowMs,
    });
  }

  /* ── Input ─────────────────────────────────────────────────────────── */
  _mouseMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    const sx = this.canvas.width  / rect.width;
    const sy = this.canvas.height / rect.height;
    this.mouseX = (e.clientX - rect.left) * sx;
    this.mouseY = (e.clientY - rect.top)  * sy;
  }

  _mouseClick(e) {
    if (this.over) return;
    // Find topmost hittable circle (oldest first so stack is FIFO)
    const sorted = [...this.circles]
      .filter(c => !c.hit)
      .sort((a,b) => a.seq - b.seq);

    for (const c of sorted) {
      const dist = Math.hypot(this.mouseX - c.x, this.mouseY - c.y);
      if (dist > c.r + 8) continue; // outside circle

      // Check timing — approach completes at age = approachTime
      const offset = Math.abs(c.age - c.approachTime) * 1000; // ms
      const win    = c.windowMs;

      if (offset < win * 0.35) {
        this._registerHit(c, 300, '300', '#00ffee');
      } else if (offset < win * 0.65) {
        this._registerHit(c, 100, '100', '#88ff44');
      } else if (offset < win) {
        this._registerHit(c, 50,  '50',  '#ffdd00');
      } else {
        this._miss(c); // clicked but too early or too late
      }
      // Only hit the frontmost circle
      this.circles = this.circles.filter(x => x !== c);
      return;
    }
  }

  _registerHit(c, pts, label, color) {
    c.hit = true;
    this.combo++;
    if (this.combo > this.maxCombo) this.maxCombo = this.combo;
    const earned = pts * Math.max(1, Math.floor(this.combo / 10) + 1);
    this.score += earned;
    this.hp = Math.min(100, this.hp + (pts === 300 ? 3 : pts === 100 ? 1.5 : 0.5));

    this.effects.push({ type:'hit', x:c.x, y:c.y, life:0.45, maxLife:0.45, r:c.r, color });
    this.comboFX.push({ x:c.x, y:c.y - c.r - 4, life:0.7, maxLife:0.7, label, color, earned });
  }

  _miss(c) {
    this.combo = 0;
    this.hp = Math.max(0, this.hp - 12);
    this.effects.push({ type:'miss', x:c.x, y:c.y, life:0.5, maxLife:0.5, r:c.r });
  }

  _gameOver() {
    this.over = true;
    // XP reward: score-based
    const xp = Math.floor(this.score / 10) + this.maxCombo * 5 + Math.floor(this.elapsed) * 2;
    const clampedXp = Math.max(100, Math.min(5000, xp));
    addSkillXP('encryption', clampedXp);
    showXPGain('encryption', clampedXp);
    checkOrnamentDrop('encryption');
    myCryptoFragments += Math.floor(clampedXp * 0.03 + this.maxCombo);
  }

  /* ── HUD ───────────────────────────────────────────────────────────── */
  _updateHUD() {
    const t = document.getElementById('br-timer');
    const a = document.getElementById('br-alive');
    const w = document.getElementById('br-weapon');
    const mins = Math.floor(this.elapsed / 60);
    const secs = Math.floor(this.elapsed % 60).toString().padStart(2,'0');
    if (t) t.innerText = `${mins}:${secs}`;
    if (a) { a.innerText = `${this.tier.label}`;  a.style.color = this.tier.color; }
    if (w) { w.innerText = `${this.score.toLocaleString()} pts`; w.style.color = '#fff'; }
  }

  /* ── Render ────────────────────────────────────────────────────────── */
  _render() {
    const ctx = this.ctx;
    const W = this.W, H = this.H;

    // Background
    ctx.fillStyle = '#080010';
    ctx.fillRect(0, 0, W, H);

    // Subtle grid
    ctx.strokeStyle = 'rgba(255,0,200,0.05)';
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
    for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }

    // Cursor trail
    for (const t of this.trail) {
      const a = t.life / 0.22;
      ctx.beginPath();
      ctx.arc(t.x, t.y, 4 * a, 0, Math.PI*2);
      ctx.fillStyle = `rgba(255,0,200,${a * 0.5})`;
      ctx.fill();
    }

    // Hit circles (back to front by seq order — lower seq = older = drawn on top)
    const sorted = [...this.circles].sort((a,b) => b.seq - a.seq);
    for (const c of sorted) {
      this._drawCircle(ctx, c);
    }

    // Hit/miss effects
    for (const fx of this.effects) {
      const t = fx.life / fx.maxLife;
      if (fx.type === 'hit') {
        ctx.beginPath();
        ctx.arc(fx.x, fx.y, fx.r * (1 + (1-t)*0.8), 0, Math.PI*2);
        ctx.strokeStyle = fx.color + Math.floor(t*220).toString(16).padStart(2,'0');
        ctx.lineWidth = 4;
        ctx.shadowBlur = 16; ctx.shadowColor = fx.color;
        ctx.stroke();
        ctx.shadowBlur = 0;
      } else if (fx.type === 'miss') {
        ctx.beginPath();
        ctx.arc(fx.x, fx.y, fx.r * (1 + (1-t)*0.5), 0, Math.PI*2);
        ctx.strokeStyle = `rgba(255,50,50,${t})`;
        ctx.lineWidth = 3;
        ctx.stroke();
        // X mark
        const s = fx.r * 0.5 * t;
        ctx.beginPath();
        ctx.moveTo(fx.x-s, fx.y-s); ctx.lineTo(fx.x+s, fx.y+s);
        ctx.moveTo(fx.x+s, fx.y-s); ctx.lineTo(fx.x-s, fx.y+s);
        ctx.strokeStyle = `rgba(255,80,80,${t})`;
        ctx.lineWidth = 3;
        ctx.stroke();
      } else if (fx.type === 'tier') {
        ctx.textAlign = 'center';
        ctx.font = `bold ${Math.floor(48 * Math.min(1, t*2))}px VT323, monospace`;
        ctx.fillStyle = fx.color + Math.floor(Math.min(1, t*2) * 255).toString(16).padStart(2,'0');
        ctx.shadowBlur = 30; ctx.shadowColor = fx.color;
        ctx.fillText(`★ ${fx.label} ★`, fx.x, fx.y + 20*(1-t));
        ctx.shadowBlur = 0;
        ctx.textAlign = 'left';
      }
    }

    // Floating score text
    for (const fx of this.comboFX) {
      const t = fx.life / fx.maxLife;
      ctx.textAlign = 'center';
      ctx.font = `bold ${Math.floor(18 + (1-t)*10)}px VT323, monospace`;
      ctx.fillStyle = fx.color + Math.floor(t*255).toString(16).padStart(2,'0');
      ctx.fillText(fx.label, fx.x, fx.y - 30*(1-t));
      ctx.textAlign = 'left';
    }

    // Combo display (top-left)
    if (this.combo >= 5) {
      ctx.textAlign = 'left';
      ctx.font = 'bold 42px VT323, monospace';
      ctx.fillStyle = this.tier.color;
      ctx.shadowBlur = 14; ctx.shadowColor = this.tier.color;
      ctx.fillText(`${this.combo}x`, 18, 52);
      ctx.shadowBlur = 0;
    }

    // HP bar (bottom of canvas)
    const hpW = W - 40;
    ctx.fillStyle = '#1a001a';
    ctx.fillRect(20, H - 18, hpW, 10);
    const hpColor = this.hp > 60 ? '#00ffcc' : this.hp > 30 ? '#ffdd00' : '#ff3300';
    ctx.fillStyle = hpColor;
    ctx.shadowBlur = 8; ctx.shadowColor = hpColor;
    ctx.fillRect(20, H - 18, hpW * (this.hp/100), 10);
    ctx.shadowBlur = 0;

    // Custom cursor (crosshair ring)
    ctx.beginPath();
    ctx.arc(this.mouseX, this.mouseY, 14, 0, Math.PI*2);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(this.mouseX, this.mouseY, 3, 0, Math.PI*2);
    ctx.fillStyle = '#ff00cc';
    ctx.fill();

    // Game over overlay
    if (this.over) this._renderGameOver(ctx, W, H);
  }

  _drawCircle(ctx, c) {
    const progress = Math.min(1, c.age / c.approachTime); // 0=just spawned, 1=time to hit
    const tc = this.tier.color;

    // Approach ring (shrinks from 3× to 1× radius)
    const approachR = c.r * (1 + (1-progress) * 2.4);
    ctx.beginPath();
    ctx.arc(c.x, c.y, approachR, 0, Math.PI*2);
    ctx.strokeStyle = tc + Math.floor((0.3 + progress*0.7) * 255).toString(16).padStart(2,'0');
    ctx.lineWidth = 3;
    ctx.stroke();

    // Circle body
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.r, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(10,0,20,0.82)';
    ctx.fill();

    // Colored ring — pulses brighter as approach ring arrives
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.r, 0, Math.PI*2);
    ctx.strokeStyle = tc;
    ctx.lineWidth = 3 + progress * 2;
    ctx.shadowBlur = 10 + progress * 18;
    ctx.shadowColor = tc;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Sequence number
    ctx.textAlign = 'center';
    ctx.font = `bold ${Math.max(10, Math.floor(c.r * 0.7))}px VT323, monospace`;
    ctx.fillStyle = '#fff';
    ctx.fillText(c.seq, c.x, c.y + c.r * 0.27);
    ctx.textAlign = 'left';

    // Fill flash when approach ring is very close (within 10%)
    if (progress > 0.90) {
      const flash = (progress - 0.90) / 0.10;
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r - 3, 0, Math.PI*2);
      ctx.fillStyle = tc + Math.floor(flash * 55).toString(16).padStart(2,'0');
      ctx.fill();
    }
  }

  _renderGameOver(ctx, W, H) {
    ctx.fillStyle = 'rgba(0,0,0,0.88)';
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = 'center';
    ctx.font = 'bold 64px VT323, monospace';
    ctx.fillStyle = '#ff00cc';
    ctx.shadowBlur = 24; ctx.shadowColor = '#ff00cc';
    ctx.fillText('PURGE FAILED', W/2, 110);
    ctx.shadowBlur = 0;

    ctx.font = '34px VT323, monospace';
    ctx.fillStyle = '#fff';
    ctx.fillText(`Score: ${this.score.toLocaleString()}`, W/2, 170);
    ctx.fillText(`Max Combo: ${this.maxCombo}x`, W/2, 210);
    ctx.fillText(`Time Survived: ${Math.floor(this.elapsed)}s`, W/2, 250);

    const tier = OSU_TIERS[Math.min(this.tierIdx, OSU_TIERS.length-1)];
    ctx.fillStyle = tier.color;
    ctx.fillText(`Peak Rank: ${tier.label}`, W/2, 295);

    const xp = Math.max(100, Math.min(5000, Math.floor(this.score/10) + this.maxCombo*5 + Math.floor(this.elapsed)*2));
    ctx.font = '28px VT323, monospace';
    ctx.fillStyle = '#f1c40f';
    ctx.fillText(`+${xp.toLocaleString()} Purge XP`, W/2, 345);

    ctx.font = '22px VT323, monospace';
    ctx.fillStyle = '#888';
    ctx.fillText('[CLICK] Play Again   [ESC] Exit', W/2, 400);
    ctx.textAlign = 'left';

    if (!this._overListeners) {
      this._overListeners = true;
      const clickAgain = () => {
        this.canvas.removeEventListener('click', clickAgain);
        document.removeEventListener('keydown', escOut);
        this.destroy();
        purgeGame = new OsuPurgeGame();
        purgeGame.start();
      };
      const escOut = (e) => {
        if (e.code === 'Escape') {
          this.canvas.removeEventListener('click', clickAgain);
          document.removeEventListener('keydown', escOut);
          closePurgeGame();
        }
      };
      // Small delay so the game-over click doesn't instantly restart
      setTimeout(() => {
        this.canvas.addEventListener('click', clickAgain);
        document.addEventListener('keydown', escOut);
      }, 600);
    }
  }
}


/* ══════════════════════════════════════════════════════════════════════════
   ANALYTICS MINIGAME — Offline Farm / R&D Lab
   Assets generate XP over time, even offline
   collectAnalyticsRewards() called on open + manual collect
════════════════════════════════════════════════════════════════════════════ */
const ANALYTICS_ASSETS = [
  { id:'pipeline',  name:'Data Pipeline',    emoji:'🔄', baseRate:1,   cost:50,    desc:'Generates a slow trickle of raw data streams' },
  { id:'dashboard', name:'KPI Dashboard',    emoji:'📊', baseRate:3,   cost:350,   desc:'Tracks metrics, compounding over time' },
  { id:'funnel',    name:'Sales Funnel',     emoji:'📉', baseRate:8,   cost:1200,  desc:'Converts prospects into steady XP' },
  { id:'heatmap',   name:'Churn Heatmap',    emoji:'🗺️', baseRate:18,  cost:3500,  desc:'Identifies high-value retention signals' },
  { id:'cluster',   name:'User Cluster',     emoji:'🧩', baseRate:40,  cost:9000,  desc:'Segments users for accelerated gains' },
  { id:'predictor', name:'Revenue Forecast', emoji:'🔮', baseRate:90,  cost:25000, desc:'ML-driven XP prediction engine' },
];

const ANALYTICS_UPGRADES = [
  { id:'fastpipe',  name:'Faster Pipeline',    cost:400,   target:'pipeline',  mult:2.5, desc:'2.5× Pipeline rate', applied:false },
  { id:'smartdash', name:'Smart Dashboard',    cost:1800,  target:'dashboard', mult:3,   desc:'3× Dashboard rate', applied:false },
  { id:'deeplearn', name:'Deep Learning',      cost:5000,  target:'all',       mult:1.8, desc:'+80% all assets', applied:false },
  { id:'autofarm',  name:'Automated Reports',  cost:15000, target:'all',       mult:2.5, desc:'2.5× all asset rates', applied:false },
  { id:'aiassist',  name:'AI Research Assist', cost:50000, target:'all',       mult:4,   desc:'4× all asset rates', applied:false },
];

let analyticsState = {
  assets: {},        // { assetId: { owned: bool, level: int } }
  upgrades: {},      // { upgradeId: bool }
  lastCollect: 0,    // timestamp
  pendingXP: 0,
};

function initAnalyticsState() {
  ANALYTICS_ASSETS.forEach(a => {
    // No free deployments — all assets must be purchased intentionally
    if (!analyticsState.assets[a.id]) analyticsState.assets[a.id] = { owned: false, level: 1 };
  });
  ANALYTICS_UPGRADES.forEach(u => {
    if (analyticsState.upgrades[u.id] === undefined) analyticsState.upgrades[u.id] = false;
  });
  if (!analyticsState.lastCollect) analyticsState.lastCollect = Date.now();
}

function getAssetRate(asset) {
  const state = analyticsState.assets[asset.id];
  if (!state || !state.owned) return 0;
  let mult = state.level;
  // Apply upgrades
  ANALYTICS_UPGRADES.forEach(u => {
    if (!analyticsState.upgrades[u.id]) return;
    if (u.target === asset.id || u.target === 'all') mult *= u.mult;
  });
  return asset.baseRate * mult;
}

function calculateOfflineGains() {
  const now = Date.now();
  const elapsed = Math.min((now - analyticsState.lastCollect) / 1000, 86400); // cap at 24h
  analyticsState.lastCollect = now;
  let totalXPRate = 0;
  ANALYTICS_ASSETS.forEach(a => { totalXPRate += getAssetRate(a); });
  return Math.floor(totalXPRate * elapsed);
}

function collectAnalyticsRewards() {
  const gained = calculateOfflineGains();
  if (gained > 0) {
    addSkillXP('analytics', gained);
    showXPGain('analytics', gained);
    checkOrnamentDrop('analytics');
    // Analytics passively generates vapor coins
    const coinsGained = Math.floor(gained / 2);
    if (coinsGained > 0) { myCoins += coinsGained; updateUI(); }
    save();
  }
  analyticsState.pendingXP = 0;
  renderAnalyticsPanel();
}

function openAnalyticsLab() {
  initAnalyticsState();
  const overlay = document.getElementById('analytics-game-overlay');
  if (!overlay) return;
  overlay.style.display = 'flex';
  injectAmbientParticles('analytics-game-overlay', 'analytics');
  // Calculate pending offline gains to show
  const now = Date.now();
  const elapsed = (now - analyticsState.lastCollect) / 1000;
  let totalRate = 0;
  ANALYTICS_ASSETS.forEach(a => { totalRate += getAssetRate(a); });
  analyticsState.pendingXP = Math.floor(totalRate * elapsed);
  renderAnalyticsPanel();
  // Show offline notice
  if (elapsed > 60 && analyticsState.pendingXP > 0) {
    const notice = document.getElementById('analytics-offline-notice');
    if (notice) { notice.innerText = `📡 OFFLINE: ${Math.floor(elapsed/60)}m elapsed — ${analyticsState.pendingXP.toLocaleString()} XP pending!`; notice.style.display='block'; }
  }
}

function renderAnalyticsPanel() {
  const grid = document.getElementById('analytics-assets-grid');
  if (!grid) return;
  grid.innerHTML = '';
  ANALYTICS_ASSETS.forEach(a => {
    const state = analyticsState.assets[a.id];
    const owned = state && state.owned;
    const level = state ? state.level : 1;
    const rate = getAssetRate(a);
    const div = document.createElement('div');
    div.className = 'analytics-asset';
    div.style.opacity = owned ? '1' : '0.5';
    div.innerHTML = `
      <div class="asset-icon">${a.emoji}</div>
      <div class="asset-name">${a.name}</div>
      <div class="asset-rate">${owned ? `${(rate*60).toFixed(0)} XP/min · ${Math.floor(rate*30)} 💰/min` : (a.cost === 0 ? 'FREE — click Deploy' : `Costs ₿${a.cost} crypto`)}</div>
      <div class="asset-level">${owned ? `Lv.${level}` : '🔒 Locked'}</div>`;
    if (!owned) {
      const btn = document.createElement('button');
      btn.className = 'asset-upgrade-btn';
      btn.innerText = a.cost === 0 ? `DEPLOY (FREE)` : `DEPLOY (₿${a.cost})`;
      btn.disabled = myCryptoFragments < a.cost;
      btn.onclick = () => {
        if (myCryptoFragments < a.cost) return;
        if (a.cost > 0) { myCryptoFragments -= a.cost; updateUI(); }
        analyticsState.assets[a.id].owned = true;
        save(); renderAnalyticsPanel();
      };
      div.appendChild(btn);
    } else {
      // Upgrade cost: base cost * 2 per level, minimum 50 coins always
      const upgCost = Math.max(50, Math.floor(Math.max(a.cost, 50) * 1.8 * level));
      const btn = document.createElement('button');
      btn.className = 'asset-upgrade-btn';
      btn.innerHTML = `UPGRADE Lv.${level+1}<br><span style="color:#00ffcc;font-size:0.7rem">₿${upgCost} crypto</span>`;
      btn.disabled = myCryptoFragments < upgCost;
      btn.onclick = () => {
        if (myCryptoFragments < upgCost) return;
        myCryptoFragments -= upgCost; updateUI();
        analyticsState.assets[a.id].level++;
        save(); renderAnalyticsPanel();
      };
      div.appendChild(btn);
    }
    grid.appendChild(div);
  });

  // Upgrades panel
  const ul = document.getElementById('analytics-upgrades-list');
  if (!ul) return;
  ul.innerHTML = '';
  ANALYTICS_UPGRADES.forEach(u => {
    const applied = analyticsState.upgrades[u.id];
    const div = document.createElement('div');
    div.className = 'analytics-upgrade';
    div.innerHTML = `
      <div class="upg-name">${applied?'✅ ':''} ${u.name}</div>
      <div class="upg-desc">${u.desc}</div>`;
    const btn = document.createElement('button');
    btn.className = 'upg-btn';
    btn.innerText = applied ? 'RESEARCHED' : `RESEARCH — ₿${u.cost}`;
    btn.disabled = applied || myCryptoFragments < u.cost;
    btn.onclick = () => {
      if (applied || myCryptoFragments < u.cost) return;
      myCryptoFragments -= u.cost; updateUI(); save();
      analyticsState.upgrades[u.id] = true;
      save(); renderAnalyticsPanel();
    };
    div.appendChild(btn);
    ul.appendChild(div);
  });

  // Crypto extraction section
  _renderCryptoExtractionSection();

  // Running XP rate display
  let totalRate = 0;
  ANALYTICS_ASSETS.forEach(a => { totalRate += getAssetRate(a); });
  const collect = document.getElementById('analytics-collect-btn');
  if (collect) {
    const pending = analyticsState.pendingXP;
    collect.innerText = `📥 COLLECT ${pending > 0 ? pending.toLocaleString()+' XP' : 'ALL GAINS'} (${(totalRate*60).toFixed(0)} XP/min)`;
  }
}

/* ── Crypto Extraction section rendered inside analytics panel ─────────── */
function _renderCryptoExtractionSection() {
  // Reuse or create the crypto section div inside analytics panel
  let section = document.getElementById('analytics-crypto-section');
  if (!section) {
    const panel = document.getElementById('analytics-panel');
    if (!panel) return;
    section = document.createElement('div');
    section.id = 'analytics-crypto-section';
    section.style.cssText = 'border-top:1px solid #3a2000;margin-top:10px;padding-top:10px;';
    // Insert before the collect button row
    const collectRow = panel.querySelector('[style*="text-align:center;margin-top:10px"]');
    if (collectRow) panel.insertBefore(section, collectRow);
    else panel.appendChild(section);
  }
  const coinsPerFrag = 8;  // Incremental reward — fragments accumulate meaningfully over time
  const totalCoins = myCryptoFragments * coinsPerFrag;
  section.innerHTML = `
    <div style="font-family:VT323,monospace;text-align:center;padding:4px 0 8px;">
      <div style="font-size:1.1rem;color:#f1c40f;letter-spacing:1px;margin-bottom:4px;">₿ CRYPTO FRAGMENTS</div>
      <div style="font-size:0.85rem;color:#888;margin-bottom:8px;">Dropped by Boss (1.5% per click · 5% on crit) — collect over time</div>
      <div style="font-size:1.8rem;color:#f1c40f;text-shadow:0 0 10px #f1c40f;margin-bottom:6px;">
        ₿ ${myCryptoFragments.toLocaleString()} fragments
        <span style="font-size:1rem;color:#666;margin-left:8px;">→ ${totalCoins.toLocaleString()} coins</span>
      </div>
      <button id="analytics-extract-btn" class="vapor-btn"
        style="font-size:1.1rem;padding:6px 20px;${myCryptoFragments===0?'opacity:0.4;':''}
               background:linear-gradient(90deg,#1a1000,#2a1600);border-color:#f1c40f;color:#f1c40f;"
        ${myCryptoFragments===0?'disabled':''}>
        ⚗️ EXTRACT CRYPTO → ${totalCoins.toLocaleString()} COINS
      </button>
    </div>`;
  const extractBtn = document.getElementById('analytics-extract-btn');
  if (extractBtn && myCryptoFragments > 0) {
    extractBtn.onclick = () => _doExtractCrypto(section, totalCoins);
  }
}

function _doExtractCrypto(section, totalCoins) {
  if (myCryptoFragments <= 0) return;
  // Animate: flash the section, then award coins
  section.style.transition = 'background 0.1s';
  section.style.background = 'rgba(241,196,15,0.18)';
  setTimeout(() => { section.style.background = ''; }, 300);
  // Pipeline flow animation
  const pipeEl = document.createElement('div');
  pipeEl.style.cssText = 'position:absolute;font-size:1.4rem;pointer-events:none;animation:cryptoPipeline 1.2s linear forwards;z-index:300000;';
  const rect = section.getBoundingClientRect();
  pipeEl.style.left = rect.left + rect.width * 0.3 + 'px';
  pipeEl.style.top  = rect.top + 'px';
  pipeEl.innerText = '₿₿₿ → 💰💰💰';
  document.body.appendChild(pipeEl);
  setTimeout(() => pipeEl.remove(), 1300);
  // Award coins after brief visual delay
  setTimeout(() => {
    myCoins += totalCoins;
    myCryptoFragments = 0;
    addSkillXP('analytics', Math.floor(myCryptoFragments * 5 + totalCoins * 0.2));
    showXPGain('analytics', Math.floor(myCryptoFragments * 5 + totalCoins * 0.2));
    updateUI(); save();
    renderAnalyticsPanel();
  }, 400);
}

/* ══════════════════════════════════════════════════════════════════════════
   NETWORKING MINIGAME — Clone Hero–style Rhythm Duel
   5 lanes | D F J K L keys | 60s round | 10 miss elimination
   Modes: vs AI | vs Player (Firebase lobby)
════════════════════════════════════════════════════════════════════════════ */
let netGame = null;
let networkingRef = null; // Firebase ref for PvP
let netInviteListener = null;

const NET_KEYS = ['ArrowLeft','ArrowUp','ArrowDown','ArrowRight'];
const NET_LANE_COLORS = ['#ff00ff','#00ffcc','#f1c40f','#ff3366'];
const NET_LANE_LABELS = ['◄','▲','▼','►'];

function openNetworkingGame(mode, matchData) {
  const overlay = document.getElementById('networking-game-overlay');
  if (!overlay) return;
  overlay.innerHTML = `
    <div style="font-family:VT323,monospace;font-size:1rem;color:#0088ff;margin-bottom:6px;text-align:center;letter-spacing:1px;">
      ← ▲ ▼ → <span style="color:#555;margin:0 12px">│</span> ARROW KEYS TO HIT NOTES <span style="color:#555;margin:0 12px">│</span> LEFT = YOU &nbsp; RIGHT = OPPONENT
    </div>
    <canvas id="networking-canvas" width="960" height="520" style="border:2px solid #0055ff;max-width:98vw;"></canvas>
    <div id="networking-hud" style="display:flex;gap:24px;margin-top:8px;font-family:VT323,monospace;font-size:1.3rem;color:#0088ff;">
      <span>⏱️ <span id="net-timer">60</span>s</span>
      <span>🎯 Hits: <span id="net-hits">0</span></span>
      <span>❌ Misses: <span id="net-misses">0</span>/10</span>
      <span id="net-vs-label">vs AI</span>
    </div>
    <button id="networking-exit-btn" class="vapor-btn" style="margin-top:6px;font-size:0.9rem;padding:4px 16px;">LEAVE MEETING</button>`;
  document.getElementById('networking-exit-btn').addEventListener('click', closeNetworkingGame);
  overlay.style.display = 'flex';
  injectAmbientParticles('networking-game-overlay', 'networking');
  if (netGame) netGame.destroy();
  netGame = new NetworkingGame(mode, matchData);
  netGame.start();
}

function openNetworkingLobby() {
  const gameOverlay = document.getElementById('networking-game-overlay');
  if (!gameOverlay) return;
  // Build lobby UI fresh
  gameOverlay.innerHTML = `
    <div id="net-lobby-ui" style="display:flex;flex-direction:column;align-items:center;gap:14px;font-family:VT323,monospace;min-width:min(500px,92vw);max-width:600px;">
      <div style="font-size:2.2rem;color:#0088ff">🌐 NETWORKING LOBBY</div>
      <div style="font-size:1rem;color:#88aaff;text-align:center;max-width:420px">
        Click a player below to send a <strong style="color:#00ffcc">PITCH BATTLE</strong> invite.<br>
        They'll be asked to accept before the match starts.
      </div>
      <div id="networking-lobby" style="width:100%;min-height:80px;background:rgba(0,0,30,0.7);border:1px solid #0044aa;border-radius:4px;padding:8px;">
        <div style="color:#334;font-size:1rem;padding:10px;text-align:center">Loading players...</div>
      </div>
      <div style="color:#334;font-size:0.9rem;">Playing as: <strong style="color:#00ffcc">${myUser||'???'}</strong></div>
      <div style="display:flex;gap:12px;">
        <button id="net-ai-from-lobby" style="padding:8px 24px;background:linear-gradient(90deg,#003366,#0055ff);border:2px solid #0077ff;color:#fff;font-family:VT323,monospace;font-size:1.2rem;cursor:pointer;border-radius:3px;">🤖 AI CHALLENGE</button>
        <button id="net-lobby-close" style="padding:8px 24px;background:transparent;border:2px solid #ff4444;color:#ff4444;font-family:VT323,monospace;font-size:1.2rem;cursor:pointer;border-radius:3px;">✕ CLOSE</button>
      </div>
    </div>`;
  gameOverlay.style.display = 'flex';
  document.getElementById('net-lobby-close').onclick = () => closeNetworkingGame();
  document.getElementById('net-ai-from-lobby').onclick = () => openNetworkingGame('ai');

  _populateLobby();

  // Listen for incoming invites
  if (db && myUser) {
    const invRef = db.ref('net_invites/' + myUser);
    netInviteListener = invRef.on('value', snap => {
      const inv = snap.val();
      if (!inv || inv.status !== 'pending') return;
      if (confirm(`🎸 PITCH BATTLE INVITE from ${inv.from}!\n\nAccept and start the Networking duel?`)) {
        invRef.set({ status:'accepted', from:inv.from });
        setTimeout(() => invRef.remove(), 3000);
        openNetworkingGame('pvp', { opponent: inv.from, seed: inv.seed });
      } else {
        invRef.set({ status:'declined', from:inv.from });
        setTimeout(() => invRef.remove(), 2000);
      }
    });
  }
}

function _populateLobby() {
  const lobbyList = document.getElementById('networking-lobby');
  if (!lobbyList) return;
  if (!db) {
    lobbyList.innerHTML = '<div style="color:#555;padding:10px;text-align:center">Firebase offline — AI mode only</div>';
    return;
  }
  if (!employeesRef) return;
  employeesRef.once('value', snap => {
    const data = snap.val() || {};
    lobbyList.innerHTML = '';
    const players = Object.keys(data).filter(p => p !== myUser);
    if (players.length === 0) {
      lobbyList.innerHTML = '<div style="color:#334;font-size:1rem;padding:10px;text-align:center">No other players online. Try AI mode!</div>';
      return;
    }
    players.forEach(p => {
      const row = document.createElement('div');
      row.className = 'lobby-player-row';
      row.innerHTML = `<span>${p}</span>`;
      const invBtn = document.createElement('button');
      invBtn.className = 'lobby-invite-btn';
      invBtn.innerText = '🤝 INVITE TO NETWORK';
      invBtn.onclick = () => _sendNetworkInvite(p);
      row.appendChild(invBtn);
      lobbyList.appendChild(row);
    });
  });
}

function _sendNetworkInvite(targetPlayer) {
  if (!db || !myUser) return;
  const seed = Date.now();
  db.ref('net_invites/' + targetPlayer).set({ from: myUser, status:'pending', seed });
  const invBtn = document.querySelector('.lobby-invite-btn');
  if (invBtn) invBtn.innerText = '📡 INVITE SENT...';
  // Listen for response
  const respRef = db.ref('net_invites/' + targetPlayer);
  let responded = false;
  respRef.on('value', snap => {
    if (responded) return;
    const d = snap.val();
    if (d && d.status === 'accepted') {
      responded = true; respRef.off();
      openNetworkingGame('pvp', { opponent: targetPlayer, seed: d.seed });
    } else if (d && d.status === 'declined') {
      responded = true; respRef.off();
      alert(`${targetPlayer} declined your Pitch Battle invite.`);
    }
  });
  // Timeout after 30s
  setTimeout(() => {
    if (!responded) { responded=true; respRef.off(); alert('Invite timed out.'); }
  }, 30000);
}

function closeNetworkingGame() {
  if (netGame) { netGame.destroy(); netGame = null; }
  if (netInviteListener && db && myUser) {
    try { db.ref('net_invites/'+myUser).off('value', netInviteListener); } catch(e){}
    netInviteListener = null;
  }
  const el = document.getElementById('networking-game-overlay');
  if (el) { el.style.display='none'; el.innerHTML=''; }
  // Re-bind exit button for next open
  const exitBtn = document.getElementById('networking-exit-btn');
  if(exitBtn) exitBtn.addEventListener('click', closeNetworkingGame);
}

class NetworkingGame {
  constructor(mode, matchData) {
    this.mode = mode; // 'ai' or 'pvp'
    this.matchData = matchData || {};
    this.canvas = document.getElementById('networking-canvas');
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.W = this.canvas.width;
    this.H = this.canvas.height;
    this._raf = null;
    this._keyDown = this._onKey.bind(this);
    this._initState();
  }

  _initState() {
    this.t = 0;
    this.hits = 0;
    this.misses = 0;
    this.maxMisses = 10;
    this.eliminated = false;
    this.won = false;
    this.resultShown = false;
    this.notes = [];          // player notes (left half)
    this.aiNotes = [];        // AI notes (right half, separate pool same seed)
    this.laneFlash = [0,0,0,0];
    this.aiLaneFlash = [0,0,0,0];
    this.lastFrameTime = null;
    this.noteSpawnTimer = 0;
    this.aiNoteSpawnTimer = 0;
    // AI opponent state
    this.aiHits = 0;
    this.aiMisses = 0;
    this.aiEliminated = false;
    this.spawnInterval = 0.55;
    this.seed = this.matchData.seed || Date.now();
    this.rng  = this._seededRng(this.seed);
    this.aiRng = this._seededRng(this.seed + 1); // offset seed so patterns differ slightly
    this._updateHUD();
  }

  _seededRng(seed) {
    let s = seed;
    return () => {
      s = (s * 1664525 + 1013904223) & 0xffffffff;
      return ((s >>> 0) / 0xffffffff);
    };
  }

  start() {
    document.addEventListener('keydown', this._keyDown);
    const vsLabel = document.getElementById('net-vs-label');
    if (vsLabel) vsLabel.innerText = this.mode==='pvp' ? `vs ${this.matchData.opponent||'Opponent'}` : 'vs AI';
    this.lastFrameTime = performance.now();
    this._raf = requestAnimationFrame(t => this._loop(t));
  }

  destroy() {
    if (this._raf) cancelAnimationFrame(this._raf);
    document.removeEventListener('keydown', this._keyDown);
    // Clean up PvP Firebase ref
    if (this.mode==='pvp' && db && myUser) {
      db.ref('net_matches/'+this.matchData.seed+'/'+myUser).remove().catch(()=>{});
    }
  }

  _onKey(e) {
    const laneIdx = NET_KEYS.indexOf(e.code);
    if (laneIdx === -1 || this.eliminated || this.won) return;
    e.preventDefault(); // stop page scrolling on arrow keys
    this.laneFlash[laneIdx] = 0.15;
    const HIT_WIN = this.H - 100;
    const hitZone = { lo: HIT_WIN - 45, hi: HIT_WIN + 45 };
    let bestNote = null, bestDist = 9999;
    for (const n of this.notes) {
      if (n.lane !== laneIdx || n.hit) continue;
      if (n.y >= hitZone.lo && n.y <= hitZone.hi) {
        const d = Math.abs(n.y - HIT_WIN);
        if (d < bestDist) { bestDist = d; bestNote = n; }
      }
    }
    if (bestNote) {
      bestNote.hit = true;
      this.hits++;
      this._updateHUD();
    } else {
      this.misses++;
      this._updateHUD();
      if (this.misses >= this.maxMisses) { this._eliminate(); }
    }
    if (this.mode==='pvp' && db && myUser) {
      db.ref('net_matches/'+this.matchData.seed+'/'+myUser).set({ hits:this.hits, misses:this.misses, t:this.t });
    }
  }

  _loop(now) {
    const dt = Math.min((now - this.lastFrameTime)/1000, 0.05);
    this.lastFrameTime = now;
    if (!this.resultShown) this._update(dt);
    this._draw();
    if (!this.resultShown) this._raf = requestAnimationFrame(t=>this._loop(t));
  }

  _update(dt) {
    this.t += dt;
    if (this.t >= 60 && !this.eliminated) { this._win(); return; }

    const hardness = Math.min(this.t / 60, 1);
    this.spawnInterval = 0.55 - hardness * 0.25;

    // ── Player notes ───────────────────────────────────────────────────────
    this.noteSpawnTimer -= dt;
    if (this.noteSpawnTimer <= 0) {
      this.noteSpawnTimer = this.spawnInterval;
      const lane = Math.floor(this.rng() * 4);
      this.notes.push({ lane, y: -20, speed: 280 + hardness * 120 });
      if (hardness > 0.6 && this.rng() > 0.65) {
        const lane2 = (lane + 1 + Math.floor(this.rng() * 2)) % 4;
        this.notes.push({ lane: lane2, y: -20, speed: 280 + hardness * 120 });
      }
    }
    // Move and auto-miss player notes
    const HIT_WIN = this.H - 100;
    for (const n of this.notes) { if (!n.hit) n.y += n.speed * dt; }
    for (const n of this.notes) {
      if (!n.hit && !n.missed && n.y > HIT_WIN + 60) {
        n.missed = true;
        if (!this.eliminated) {
          this.misses++;
          this._updateHUD();
          if (this.misses >= this.maxMisses) { this._eliminate(); return; }
        }
      }
    }
    this.notes = this.notes.filter(n => n.y < this.H + 20);

    // ── AI notes (separate pool for right-side display) ────────────────────
    this.aiNoteSpawnTimer -= dt;
    if (this.aiNoteSpawnTimer <= 0) {
      this.aiNoteSpawnTimer = this.spawnInterval * (0.85 + this.aiRng() * 0.3);
      const aiLane = Math.floor(this.aiRng() * 4);
      this.aiNotes.push({ lane: aiLane, y: -20, speed: 280 + hardness * 120 });
    }
    for (const n of this.aiNotes) { if (!n.aiHit && !n.aiMissed) n.y += n.speed * dt; }
    for (const n of this.aiNotes) {
      if (!n.aiHit && !n.aiMissed && n.y > HIT_WIN - 10 && !this.aiEliminated) {
        n._aiChecked = true;
        const aiAcc = 0.68 + hardness * 0.10;
        if (this.aiRng() < aiAcc) {
          n.aiHit = true;
          this.aiHits++;
          this.aiLaneFlash[n.lane] = 0.15;
        } else {
          n.aiMissed = true;
          this.aiMisses++;
          if (this.aiMisses >= this.maxMisses) this.aiEliminated = true;
        }
      }
    }
    this.aiNotes = this.aiNotes.filter(n => n.y < this.H + 20);

    // Lane flash decay
    for (let i = 0; i < 4; i++) {
      this.laneFlash[i]   = Math.max(0, this.laneFlash[i] - dt);
      this.aiLaneFlash[i] = Math.max(0, this.aiLaneFlash[i] - dt);
    }
  }

  _eliminate() {
    this.eliminated = true;
    if (!this.aiEliminated) {
      // AI wins — let it "finish" briefly then show result
      setTimeout(() => this._showResult(false), 1500);
    } else {
      this._showResult(true); // both eliminated — player wins by survival
    }
  }

  _win() {
    this.won = true;
    this._showResult(true);
  }

  _showResult(playerWon) {
    if (this.resultShown) return; this.resultShown = true;
    if (this._raf) cancelAnimationFrame(this._raf);
    const accuracy = this.hits + this.misses > 0 ? Math.round(this.hits/(this.hits+this.misses)*100) : 0;
    const xp = Math.floor((playerWon ? 2200 : 600) + this.hits * 25 + (60 - Math.min(this.t,60)) * (playerWon?8:2));
    addSkillXP('networking', xp); showXPGain('networking', xp);
    checkOrnamentDrop('networking');
    myCryptoFragments += Math.floor((playerWon ? 60 : 20) + this.hits * 2);
    const overlay = document.getElementById('networking-game-overlay');
    if (!overlay) return;
    const div = document.createElement('div');
    div.style.cssText = 'position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(0,0,0,0.9);z-index:20;text-align:center;font-family:VT323,monospace;';
    div.innerHTML = `
      <div style="font-size:3.2rem">${playerWon?'🤝 DEAL CLOSED!':'💼 DEAL LOST'}</div>
      <div style="font-size:1.5rem;color:#fff;margin:8px 0">${playerWon?'You out-performed your opponent!':'You were eliminated after 10 misses.'}</div>
      <div style="font-size:1.3rem;color:#88aaff;margin-bottom:4px">🎯 Accuracy: <strong style="color:#f1c40f">${accuracy}%</strong> (${this.hits} hits / ${this.misses} misses)</div>
      <div style="font-size:1.3rem;color:#c89fff;margin-bottom:18px">🌐 +${xp.toLocaleString()} Networking XP</div>
      <div style="display:flex;gap:20px">
        <button id="net-retry" style="padding:10px 32px;background:linear-gradient(90deg,#0055ff,#00ffcc);border:3px solid #fff;color:#fff;font-family:VT323,monospace;font-size:1.6rem;cursor:pointer">▶ REMATCH</button>
        <button id="net-quit" style="padding:10px 32px;background:transparent;border:2px solid #ff4444;color:#ff4444;font-family:VT323,monospace;font-size:1.6rem;cursor:pointer">✕ LEAVE</button>
      </div>`;
    overlay.appendChild(div);
    document.getElementById('net-retry').onclick = () => { div.remove(); this._initState(); this.lastFrameTime=performance.now(); this.resultShown=false; this._raf=requestAnimationFrame(t=>this._loop(t)); };
    document.getElementById('net-quit').onclick = () => closeNetworkingGame();
  }

  _updateHUD() {
    const t=document.getElementById('net-timer'); if(t) t.innerText=Math.max(0,Math.ceil(60-this.t));
    const h=document.getElementById('net-hits'); if(h) h.innerText=this.hits;
    const m=document.getElementById('net-misses'); if(m) m.innerText=this.misses;
  }

  _draw() {
    if (!this.canvas) return;
    const ctx = this.ctx, W = this.W, H = this.H;
    const LANES = 4;
    const HIT_LINE = H - 100;
    // Split canvas: left = player (0..W/2-10), right = AI (W/2+10..W)
    const HALF = Math.floor(W / 2);
    const DIV  = 12; // divider width

    // Full background
    ctx.fillStyle = '#000510'; ctx.fillRect(0, 0, W, H);

    // Draw one side (player or AI) as a helper
    const drawSide = (ox, notes, laneFlashes, label, labelColor, isEliminated, misses) => {
      const laneW = (HALF - DIV / 2) / LANES;
      ctx.save();
      ctx.beginPath(); ctx.rect(ox, 0, HALF - DIV / 2, H); ctx.clip();

      // Lane backgrounds
      for (let i = 0; i < LANES; i++) {
        const lx = ox + i * laneW;
        const col = NET_LANE_COLORS[i];
        const rgb = parseInt(col.slice(1,3),16)+','+parseInt(col.slice(3,5),16)+','+parseInt(col.slice(5,7),16);
        ctx.fillStyle = `rgba(${rgb},0.04)`; ctx.fillRect(lx, 0, laneW, H);
        ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(lx, 0); ctx.lineTo(lx, H); ctx.stroke();
        // Perspective vanish lines
        ctx.strokeStyle = `rgba(0,80,255,0.07)`; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(ox + (HALF - DIV/2) / 2, 0); ctx.lineTo(lx, H); ctx.stroke();
      }

      // Hit line
      ctx.shadowBlur = 12; ctx.shadowColor = '#ffffff';
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(ox, HIT_LINE); ctx.lineTo(ox + HALF - DIV / 2, HIT_LINE); ctx.stroke();
      ctx.shadowBlur = 0;

      // Hit targets + key labels
      for (let i = 0; i < LANES; i++) {
        const cx = ox + (i + 0.5) * laneW;
        const flash = laneFlashes[i] > 0;
        const col = NET_LANE_COLORS[i];
        ctx.beginPath(); ctx.arc(cx, HIT_LINE, 20, 0, Math.PI * 2);
        ctx.fillStyle = flash ? col + 'cc' : 'rgba(0,0,0,0.5)'; ctx.fill();
        ctx.strokeStyle = col; ctx.lineWidth = flash ? 3 : 2; ctx.stroke();
        ctx.font = `bold 15px VT323,monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = '#fff'; ctx.fillText(NET_LANE_LABELS[i], cx, HIT_LINE);
      }

      // Notes
      for (const n of notes) {
        if (n.hit || n.aiHit) continue;
        const cx = ox + (n.lane + 0.5) * laneW;
        const col = NET_LANE_COLORS[n.lane];
        const perspScale = 0.4 + 0.6 * (n.y / H);
        const r = 18 * perspScale;
        ctx.beginPath(); ctx.arc(cx, n.y, r, 0, Math.PI * 2);
        if (n.missed || n.aiMissed) {
          ctx.fillStyle = 'rgba(80,80,80,0.5)'; ctx.fill();
        } else {
          ctx.fillStyle = col; ctx.shadowBlur = 10; ctx.shadowColor = col;
          ctx.fill(); ctx.shadowBlur = 0;
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
        }
      }

      // Eliminated overlay
      if (isEliminated) {
        ctx.fillStyle = 'rgba(80,0,0,0.45)'; ctx.fillRect(ox, 0, HALF - DIV / 2, H);
        ctx.font = 'bold 28px VT323,monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ff4444'; ctx.shadowBlur = 16; ctx.shadowColor = '#ff0000';
        ctx.fillText('ELIMINATED', ox + (HALF - DIV / 2) / 2, H / 2);
        ctx.shadowBlur = 0;
      }

      // Side label header
      ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(ox, 0, HALF - DIV / 2, 32);
      ctx.font = '17px VT323,monospace'; ctx.textAlign = 'center'; ctx.fillStyle = labelColor;
      ctx.fillText(label, ox + (HALF - DIV / 2) / 2, 20);

      // Miss bar at bottom
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(ox, H - 10, HALF - DIV / 2, 10);
      ctx.fillStyle = misses < 7 ? '#ff4444' : '#ff0000';
      ctx.fillRect(ox, H - 10, (HALF - DIV / 2) * (misses / this.maxMisses), 10);

      ctx.restore();
    };

    // Draw player side (left)
    const playerLabel = `YOU  ✦  Hits:${this.hits}  Misses:${this.misses}/10`;
    drawSide(0, this.notes, this.laneFlash, playerLabel, '#00ffcc', this.eliminated, this.misses);

    // Divider bar
    const divX = HALF - DIV / 2;
    const grad = ctx.createLinearGradient(divX, 0, divX + DIV, 0);
    grad.addColorStop(0, '#0055ff44'); grad.addColorStop(0.5, '#00ffff'); grad.addColorStop(1, '#0055ff44');
    ctx.fillStyle = grad; ctx.fillRect(divX, 0, DIV, H);
    // VS label
    ctx.save();
    ctx.font = 'bold 14px VT323,monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff'; ctx.shadowBlur = 8; ctx.shadowColor = '#00ffff';
    ctx.fillText('VS', divX + DIV / 2, H / 2);
    ctx.shadowBlur = 0; ctx.restore();

    // Draw AI side (right)
    const aiName = this.mode === 'pvp' ? (this.matchData.opponent || 'OPPONENT') : 'AI';
    const aiLabel = `${aiName}  ✦  Hits:${this.aiHits}  Misses:${this.aiMisses}/10`;
    drawSide(HALF + DIV / 2, this.aiNotes, this.aiLaneFlash, aiLabel, '#ff8888', this.aiEliminated, this.aiMisses);
  }
} // end NetworkingGame

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded', () => {
    bindInteractions();
    window.addEventListener('resize', ()=>{ if(mercUnits.length) positionMercUnits(); });
  });
} else {
  bindInteractions();
  window.addEventListener('resize', ()=>{ if(mercUnits.length) positionMercUnits(); });
}

console.log('✅ Protocol Ascension — Full Build ready!');
/* ══ EMPLOYEE AVATAR SYSTEM — FACE ONLY ══════════════════════════════════
   Sprite sheet: assets/character_creator.jpg  (10 cols × 10 rows)
   Each cell = 10% × 10% of the sheet.
   backgroundPosition formula: col/9*100%  row/9*100%  (0-indexed, 9 steps)
   Faces live in rows 0–2, cols 0–9 → 30 unique faces.
   Hats will be added as a separate layer later.
════════════════════════════════════════════════════════════════════════════ */

// Global state — saved to Firebase / localStorage via buildSavePayload
let playerAvatar = {
  faceIndex: 0,    // index into FACE_COORDS
  isSetup: false,
};

// Head cells only — rows 0–3, cols 0–5 (24 heads)
// Sheet is 10×10 grid; backgroundPosition uses (col/9)*100% (col/9)*100%
const FACE_COORDS = [
  // Row 0 — brown/dark hair
  {r:0,c:0},{r:0,c:1},{r:0,c:2},{r:0,c:3},{r:0,c:4},{r:0,c:5},
  // Row 1 — green hair
  {r:1,c:0},{r:1,c:1},{r:1,c:2},{r:1,c:3},{r:1,c:4},{r:1,c:5},
  // Row 2 — purple hair
  {r:2,c:0},{r:2,c:1},{r:2,c:2},{r:2,c:3},{r:2,c:4},{r:2,c:5},
  // Row 3 — blue/cyborg
  {r:3,c:0},{r:3,c:1},{r:3,c:2},{r:3,c:3},{r:3,c:4},{r:3,c:5},
];

function _facePos(idx) {
  const f = FACE_COORDS[idx] || FACE_COORDS[0];
  // 10×10 grid, background-size:1000% 1000% → step = 100/9 per cell
  const px = (f.c / 9 * 100).toFixed(4);
  const py = (f.r / 9 * 100).toFixed(4);
  return `${px}% ${py}%`;
}

function renderAvatarPreview() {
  const faceDiv = document.getElementById('preview-face');
  if (!faceDiv) return;
  faceDiv.style.backgroundPosition = _facePos(playerAvatar.faceIndex);
  // Counter label
  const lbl = document.getElementById('avatar-face-counter');
  if (lbl) lbl.innerText = `${playerAvatar.faceIndex + 1} / ${FACE_COORDS.length}`;
}

function cycleface(dir) {
  playerAvatar.faceIndex = (playerAvatar.faceIndex + dir + FACE_COORDS.length) % FACE_COORDS.length;
  renderAvatarPreview();
}

function randomizeAvatar() {
  playerAvatar.faceIndex = Math.floor(Math.random() * FACE_COORDS.length);
  renderAvatarPreview();
}

/* ── Onboarding: force screen on first login ──────────────────────────── */
function enforceIdBadge() {
  if (!playerAvatar.isSetup) {
    renderAvatarPreview();
    const ov = document.getElementById('avatar-overlay');
    if (ov) ov.style.display = 'flex';
  }
}
