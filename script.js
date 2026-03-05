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
setInterval(() => {
  if (!myUser) return;
  try {
    const raw = localStorage.getItem('ct_crate_equipped');
    if (!raw) return;
    const eq = JSON.parse(raw);
    const prev = JSON.stringify(window._myEquipped || {});
    const next = JSON.stringify(eq);
    if (next === prev) return; 
    window._myEquipped = eq;
    applyGearBuffs(); 
    const gearEl = document.querySelector('#pcard-' + myUser + ' .player-gear');
    if (gearEl) {
      gearEl.innerHTML = _equippedGearHTML(eq);
    }
    if (employeesRef && myUser) {
      let items = [];
      try { const cs = localStorage.getItem('ctcrates'); if(cs){const d=JSON.parse(cs);if(d.items)items=d.items;} } catch(e2){}
      employeesRef.child(myUser).update({ equipped: eq, crateItems: items }).catch(e => {});
    }
  } catch(e) {}
}, 2000);

/* ══ AUDIO ════════════════════════════════════════════════════════════════ */
const bgm = new Audio('Cubicle_Dreams.mp3'); 
bgm.loop = true; 
bgm.volume = 0.15; 
const clickSfxFiles = ['sfx pack/Boss hit 1.wav','sfx pack/Bubble 1.wav','sfx pack/Hit damage 1.wav','sfx pack/Select 1.wav'];
const attackSounds = clickSfxFiles.map(f => { const a = new Audio(encodeURI(f)); a.volume = 0.3; return a; });
function playClickSound() {
  try { const s = attackSounds[Math.floor(Math.random()*attackSounds.length)].cloneNode(); s.volume=0.3; s.play().catch(()=>{}); } catch(e){}
}

if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x,y,w,h,r){
    this.beginPath(); this.moveTo(x+r,y); this.lineTo(x+w-r,y);
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
let currentBossIsDave=true, currentBossLevel=1;
let _lastBossLevel=null;
let prestigeCount=0, prestigeBuffMulti=1.0;
let myCryptoFragments=0; 

const daveHitFrames=['assets/hit/dave-hit-1.png','assets/hit/dave-hit-2.png'];
const richHitFrames=['assets/phases/rich/rich_hit_a.png','assets/phases/rich/rich_hit_b.png'];

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
    cheatLockout = setTimeout(() => { isCheating = false; clickHistory = []; }, 4000);
    return false;
  }
  return true;
}

const PRESTIGE_TITLES = [null, 'Intern','Jr. Analyst','Associate','Coordinator','Specialist','Sr. Analyst','Team Lead','Manager','Director','VP','C-Suite ⭐'];
function getPrestigeTitle(n) { return PRESTIGE_TITLES[Math.min(n, PRESTIGE_TITLES.length-1)] || null; }

/* ══ SKILLS ═══════════════════════════════════════════════════════════════ */
const SKILLS = {
  phishing:   { name:'Phishing',   icon:'🎣', xp:0, level:1 },
  firewall:   { name:'Firewall',   icon:'🛡️', xp:0, level:1 },
  recovery:   { name:'Recovery',   icon:'💾', xp:0, level:1 },
  encryption: { name:'Purge',      icon:'⚔️', xp:0, level:1 },
  analytics:  { name:'Analytics',  icon:'📊', xp:0, level:1 },
  networking: { name:'Networking', icon:'🌐', xp:0, level:1 },
};

/* ══ AFK SKILLS & INVENTORY ══════════════════════════════════════════════ */
const AFK_SKILLS = {
  exploitation: { name:'Exploitation', icon:'🎯', type:'combat',  xp:0, level:1, desc:'+0.2% Merc Crit Chance per level' },
  overclocking: { name:'Overclocking', icon:'🔥', type:'combat',  xp:0, level:1, desc:'+1% Merc Base Damage per level' },
  redundancy:   { name:'Redundancy',   icon:'🛡️', type:'combat',  xp:0, level:1, desc:'-0.1% Boss Armor Scaling per level' },
  data_mining:  { name:'Data Mining',  icon:'⛏️', type:'gather',  xp:0, level:1, resource:'data_clusters' },
  web_scraping: { name:'Web Scraping', icon:'🕸️', type:'gather',  xp:0, level:1, resource:'lofi_samples' },
  wiretapping:  { name:'Wiretapping',  icon:'🎧', type:'gather',  xp:0, level:1, resource:'corp_secrets' },
  compiling:    { name:'Compiling',    icon:'⚙️', type:'process', xp:0, level:1, input:'data_clusters', output:'executables' },
  transcribing: { name:'Transcribing', icon:'📼', type:'process', xp:0, level:1, input:'lofi_samples',  output:'mixtapes' },
  leveraging:   { name:'Leveraging',   icon:'💼', type:'process', xp:0, level:1, input:'corp_secrets',  output:'vapor_coins' }
};

let afkState = {
  activeTask: null, 
  lastTick: Date.now(),
  resources: { data_clusters: 0, lofi_samples: 0, corp_secrets: 0, executables: 0, mixtapes: 0 }
};

function addAfkXP(key, amount) {
  const sk = AFK_SKILLS[key]; if (!sk) return;
  const oldLvl = sk.level;
  sk.xp += amount;
  while (sk.level < 99 && sk.xp >= XP_TABLE[sk.level+1]) {
    sk.level++;
    showSkillLevelUp(key, sk.level); 
  }
  if (sk.level !== oldLvl) save();
}

/* ══ AFK ENGINE (MELVOR STYLE) ═══════════════════════════════════════════ */
const AFK_TICK_RATE = 3000; 
function processAfkTask(elapsedMs) {
  if (!afkState.activeTask) return 0;
  const task = AFK_SKILLS[afkState.activeTask];
  const ticks = Math.floor(elapsedMs / AFK_TICK_RATE); 
  if (ticks <= 0) return 0;

  afkState.lastTick += ticks * AFK_TICK_RATE;
  let actionsCompleted = 0;

  if (task.type === 'gather') {
    const amountPerTick = 1 + Math.floor(task.level / 10); 
    afkState.resources[task.resource] += (ticks * amountPerTick);
    addAfkXP(afkState.activeTask, ticks * 15);
    actionsCompleted = ticks;
  } else if (task.type === 'process') {
    const costPerTick = 2; 
    const affordableTicks = Math.floor(afkState.resources[task.input] / costPerTick);
    actionsCompleted = Math.min(ticks, affordableTicks);

    if (actionsCompleted > 0) {
      afkState.resources[task.input] -= (actionsCompleted * costPerTick);
      if (task.output === 'vapor_coins') {
        myCoins += actionsCompleted * (50 * task.level); 
        updateUI();
      } else {
        afkState.resources[task.output] += actionsCompleted * (1 + Math.floor(task.level / 20));
      }
      addAfkXP(afkState.activeTask, actionsCompleted * 45);
    }
    if (affordableTicks < ticks) afkState.activeTask = null; 
  }
  return actionsCompleted; 
}

function calculateOfflineAfk() {
  const now = Date.now();
  const elapsed = now - afkState.lastTick;
  if (elapsed > 60000 && afkState.activeTask) {
     const actions = processAfkTask(elapsed);
     if (actions > 0) console.log(`📡 OFFLINE PROGRESS: Completed ${actions} AFK actions.`);
  } else { afkState.lastTick = now; }
}

setInterval(() => {
  if (afkState.activeTask) processAfkTask(Date.now() - afkState.lastTick);
  else afkState.lastTick = Date.now(); 
}, 1000);

/* ══ XP SYSTEM ═══════════════════════════════════════════════════════════ */
const XP_TABLE = new Array(100).fill(0);
(function buildXPTable(){
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

let milestoneBonuses = { armor_pierce:0, dash_coins:0, frenzy_cap:0, crit_bonus:0, loot_rate:0, legendary_rate:0 };

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
  const sk = SKILLS[key] || AFK_SKILLS[key];
  if(!sk) return;
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

/* ══ MY WORK DESK ═════════════════════════════════════════════════════════ */
const ALL_ORNAMENTS = [
  { id:'gold_pickaxe',   displayName:'Golden Pickaxe',   emoji:'⛏️', skillSource:'Mining',        slotId:'slot_01', description:"Sturdy enough to break bedrock, shiny enough to blind a goblin." },
  { id:'gold_anvil',     displayName:'Golden Anvil',     emoji:'🔨', skillSource:'Smithing',      slotId:'slot_02', description:"It rings with the purest tone when struck, but it's much too pretty to use." },
  { id:'gold_fishhook',  displayName:'Golden Fishhook',  emoji:'🎣', skillSource:'Phishing',      slotId:'slot_03', description:"The ultimate lure; even the sea gods are jealous of its gleam." },
  { id:'gold_spatula',   displayName:'Golden Spatula',   emoji:'🍳', skillSource:'Cooking',       slotId:'slot_04', description:"Flips flapjacks with divine, unmistakable precision." },
  { id:'gold_smiley',    displayName:'Golden Smiley',    emoji:'😊', skillSource:'Charisma',      slotId:'slot_05', description:"A reminder that a winning smile is worth its weight in gold." },
  { id:'gold_lightning', displayName:'Golden Lightning', emoji:'⚡', skillSource:'Agility',       slotId:'slot_06', description:"Captured in a bottle, now resting safely near your mousepad." },
  { id:'gold_oak_leaf',  displayName:'Golden Oak Leaf',  emoji:'🍂', skillSource:'Woodcutting',   slotId:'slot_07', description:"Never wilts, never fades, entirely impractical for photosynthesis." },
  { id:'gold_book',      displayName:'Golden Book',      emoji:'📖', skillSource:'Magic',         slotId:'slot_08', description:"The pages are solid gold, making it a very heavy read." },
  { id:'gold_sword',     displayName:'Golden Sword',     emoji:'⚔️', skillSource:'Combat',        slotId:'slot_09', description:"Perfectly balanced, though mostly used for opening letters." },
  { id:'gold_shield',    displayName:'Golden Shield',    emoji:'🛡️', skillSource:'Defense',       slotId:'slot_10', description:"A steadfast protector against spilled coffee and minor drafts." },
  { id:'gold_bow',       displayName:'Golden Bow',       emoji:'🏹', skillSource:'Ranged',        slotId:'slot_11', description:"Strung with a sunbeam, it rests proudly on your top shelf." },
  { id:'gold_potion',    displayName:'Golden Potion',    emoji:'🧪', skillSource:'Herblore',      slotId:'slot_12', description:"Do not drink; the liquid inside has solidified into pure bullion." },
  { id:'gold_seed',      displayName:'Golden Seed',      emoji:'🌱', skillSource:'Farming',       slotId:'slot_13', description:"Planting this will only yield a highly confused local economy." },
  { id:'gold_gem',       displayName:'Golden Gem',       emoji:'💎', skillSource:'Crafting',      slotId:'slot_14', description:"Cut to absolute perfection, forever catching the light from your monitor." },
  { id:'gold_stopwatch', displayName:'Golden Stopwatch', emoji:'⏱️', skillSource:'Thieving',      slotId:'slot_15', description:"Time is money, and this watch is literally both." },
  { id:'gold_flame',     displayName:'Golden Flame',     emoji:'🔥', skillSource:'Firewall',      slotId:'slot_16', description:"It burns brightly forever, yet remains completely cool to the touch." },
  { id:'gold_target',    displayName:'Golden Target',    emoji:'🎯', skillSource:'Fletching',     slotId:'slot_17', description:"You hit the bullseye so hard they decided to gild the board." },
  { id:'gold_feather',   displayName:'Golden Feather',   emoji:'🪶', skillSource:'Hunter',        slotId:'slot_18', description:"Plucked from a legendary bird that no one actually believes you caught." },
];

const DESK_SLOTS = [
  { id:'slot_01', x:0.195, y:0.528 }, { id:'slot_02', x:0.258, y:0.528 }, { id:'slot_03', x:0.321, y:0.528 },
  { id:'slot_04', x:0.384, y:0.528 }, { id:'slot_05', x:0.447, y:0.528 }, { id:'slot_06', x:0.510, y:0.528 },
  { id:'slot_07', x:0.573, y:0.528 }, { id:'slot_08', x:0.636, y:0.528 }, { id:'slot_09', x:0.699, y:0.528 },
  { id:'slot_10', x:0.762, y:0.528 }, { id:'slot_11', x:0.220, y:0.585 }, { id:'slot_12', x:0.302, y:0.585 },
  { id:'slot_13', x:0.384, y:0.585 }, { id:'slot_14', x:0.466, y:0.585 }, { id:'slot_15', x:0.547, y:0.585 },
  { id:'slot_16', x:0.629, y:0.585 }, { id:'slot_17', x:0.711, y:0.585 }, { id:'slot_18', x:0.793, y:0.585 },
];

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

const DESK_MILESTONES = [
  { count:3,  title:'The Decorator',   desc:'3 Ornaments Collected!',   reward:'title' },
  { count:9,  title:null,              desc:'Halfway There! Desk Upgraded.', reward:'desk_upgrade' },
  { count:18, title:'The Curator',     desc:'Full Desk! Legendary Status.', reward:'full_desk' },
];

const ORNAMENT_DROP_RATE = 1 / 2000;

let playerDeskState = {
  unlockedOrnamentIds:     [],  
  obtainedTimestamps:      {},  
  obtainedFromSkill:       {},  
  obtainedAtCompletion:    {},  
  totalMinigameCompletions: 0,  
  milestonesAwarded:       [],  
  deskHasUpgrade:          false,
  deskHasAura:             false,
  hasSeenTutorial:         false,
};

let _deskActiveTab = 'overview';
const _broadcastQueue = [];
let _broadcastTimer = null;
const BROADCAST_THROTTLE_MS = 5000;

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

function checkOrnamentDrop(skillKey) {
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

  checkDeskMilestones();
  triggerOrnamentDropAnimation(dropped, skillKey, () => {
    broadcastOrnamentDrop(dropped, skillKey);
    updateDeskProgressLabel();
    renderDeskOverlay();
  });
}

function checkDeskMilestones() {
  const count = playerDeskState.unlockedOrnamentIds.length;
  for (const ms of DESK_MILESTONES) {
    const key = String(ms.count);
    if (count >= ms.count && !playerDeskState.milestonesAwarded.includes(key)) {
      playerDeskState.milestonesAwarded.push(key);
      save();
      if (ms.reward === 'desk_upgrade') { playerDeskState.deskHasUpgrade = true; save(); }
      if (ms.reward === 'full_desk') { playerDeskState.deskHasAura = true; save(); }
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

function triggerOrnamentDropAnimation(ornament, skillKey, onComplete) {
  const overlay = document.getElementById('ornament-drop-overlay');
  if (!overlay) { if (onComplete) onComplete(); return; }

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

  overlay.classList.add('drop-enter');
  setTimeout(() => {
    overlay.classList.add('drop-reveal');
    if (lightShaft) { lightShaft.style.transition = 'opacity 0.3s'; lightShaft.style.opacity = '1'; }
    spawnDropParticles();
  }, 500);
  setTimeout(() => {
    overlay.classList.add('drop-slottify');
    if (lightShaft) { lightShaft.style.opacity = '0'; }
  }, 2000);
  setTimeout(() => { spawnSettleDust(); }, 3000);
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
  setTimeout(() => { pop.style.opacity='0'; pop.style.transform='translate(-50%,-50%) scale(0.85)'; setTimeout(() => pop.remove(), 350); }, 3200);
}

function broadcastOrnamentDrop(ornament, skillKey) {
  if (!myUser) return;
  const template = BROADCAST_TEMPLATES[Math.floor(Math.random() * BROADCAST_TEMPLATES.length)];
  const skillDisplay = ornament.skillSource || skillKey || 'Minigame';
  const msg = template.replace('{PlayerName}', myUser).replace('{OrnamentName}', ornament.displayName).replace('{SkillName}', skillDisplay);
  _broadcastQueue.push(msg);

  if (!_broadcastTimer) {
    _broadcastTimer = setTimeout(() => {
      if (_broadcastQueue.length === 1) { showGlobalBroadcast(_broadcastQueue[0]); }
      else { showGlobalBroadcast(`💎 GLOBAL: ${_broadcastQueue.length} rare ornaments were discovered across the office! Amazing work, team!`); }
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
  setTimeout(() => { el.style.opacity='0'; el.style.transform='translateX(-50%) translateY(-70px)'; setTimeout(() => el.remove(), 450); }, 6000);
}

function renderDeskOverlay() {
  const owned   = new Set(playerDeskState.unlockedOrnamentIds);
  const total   = ALL_ORNAMENTS.length;
  const count   = owned.size;

  const subtitle = document.getElementById('workdesk-subtitle');
  if (subtitle) subtitle.innerText = `${count} / ${total} ornaments discovered`;

  const scene = document.getElementById('workdesk-scene');
  if (scene) {
    if (playerDeskState.deskHasUpgrade) scene.classList.add('desk-upgraded');
    else scene.classList.remove('desk-upgraded');
  }

  const panel = document.getElementById('workdesk-panel');
  if (panel) {
    if (playerDeskState.deskHasAura) panel.classList.add('desk-full-aura');
    else panel.classList.remove('desk-full-aura');
  }

  if (_deskActiveTab === 'overview') renderDeskOverviewTab(owned);
  else renderDeskCollectionTab(owned);
}

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

      const ts    = playerDeskState.obtainedTimestamps[ornament.id];
      const skill = playerDeskState.obtainedFromSkill[ornament.id] || ornament.skillSource;
      const date  = ts ? new Date(ts).toLocaleDateString() : '?';
      const tip   = buildOrnamentTooltip(ornament, skill, date, true);
      el.appendChild(tip);
    } else {
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
      if (isEq) { equipped[slot] = null; } 
      else { equipped[slot] = {type:it.type, ri:it.ri, name:it.name, rarity:it.rarity, color:it.color}; }
      localStorage.setItem('ct_crate_equipped', JSON.stringify(equipped));
      window._myEquipped = null; 
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

function _crateSprite(type, ri, W, H, extraCss) {
  const src = (type === 'mice') ? 'assets/crates/mice.jpg' : 'assets/crates/monitors.png';
  const bsX = 9 * W, bsY = 9 * H, bpY = -ri * H;
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

  const header=document.createElement('div');
  header.style.cssText='display:flex;align-items:center;gap:14px;margin-bottom:20px;';
  header.innerHTML=_avatarSpriteHTML(fi)+
    '<div><div style="font-size:1.6rem;color:#cc44ff;font-family:VT323,monospace;">'+username+'</div>'+
    '<div style="font-size:.8rem;color:#666;">'+items.length+' crate item'+(items.length!==1?'s':'')+' collected</div></div>';
  panel.appendChild(header);

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
    window._lastEmployeeSnap = data; 
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
  ref.set({online:true, joined:Date.now(), faceIndex: playerAvatar.faceIndex||0});
  ref.onDisconnect().remove();
}

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

function _initIntroButtons(){
  const skipBtn = document.getElementById('skip-intro-btn');
  if(skipBtn){ skipBtn.style.display='block'; skipBtn.onclick=endIntro; }
  const startBtn = document.getElementById('start-intro-btn');
  if(startBtn){
    startBtn.style.display = 'block';
    startBtn.onclick = () => {
      if(ytPlayer && typeof ytPlayer.playVideo === 'function'){
        startBtn.style.display = 'none';
        const ytEl = document.getElementById('yt-player');
        if(ytEl) ytEl.style.display = 'block';
        ytPlayer.playVideo();
      } else { endIntro(); }
    };
  }
  const _introSafetyTimer = setTimeout(()=>{ if(introEnded) return; endIntro(); }, 12000);
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
      onReady:()=>{},
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
    if(b.health<=0) return handleDefeat(b);
    const maxHP=1000000000*b.level;
    const isDave=(b.level%2!==0);
    currentBossIsDave=isDave; currentBossLevel=b.level;
    const bName=document.getElementById('main-boss-name');
    const bLevel=document.getElementById('boss-level-badge');
    const armorBadge=document.getElementById('boss-armor-badge');
    const armorPct=document.getElementById('boss-armor-pct');
    const armor=Math.round(getBossArmor()*100);
    if(bName) bName.innerText=isDave?'VP Dave':'DM Rich';
    if(bLevel) bLevel.innerText='LV.'+b.level;
    if(armorBadge) armorBadge.style.display=armor>0?'inline-flex':'none';
    if(armorPct) armorPct.innerText=armor;
    const bossNameH1=document.getElementById('boss-name');
    if(bossNameH1) bossNameH1.innerText=(isDave?'⚔ VP DAVE':'⚔ DM RICH')+' — LEVEL '+b.level;
    const bImg=document.getElementById('boss-image');
    if(bImg){
      const phase=b.health/maxHP;
      const prefix=isDave?'assets/phases/dave/dave_phase':'assets/phases/rich/rich_phase';
      const phaseSrc=prefix+(phase<=0.25?'4':phase<=0.50?'3':phase<=0.75?'2':'1')+'.png';
      if(b.level!==_lastBossLevel){ bImg.src=prefix+'1.png'; triggerBossEntrance(); shakeArena(); _lastBossLevel=b.level; }
      else if(!isAnimatingHit){ bImg.src=phaseSrc; }
    }
    const fill=document.getElementById('health-bar-fill');
    const txt=document.getElementById('health-text');
    if(fill) fill.style.width=(Math.max(0,b.health/maxHP)*100)+'%';
    if(txt) txt.innerText=Math.max(0,b.health).toLocaleString()+' / '+maxHP.toLocaleString();
  });
}

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
      const old=bImg.src;
      const frames=currentBossIsDave?daveHitFrames:richHitFrames;
      bImg.src=frames[Math.floor(Math.random()*frames.length)];
      bImg.style.transform='scale(1.04)';
      setTimeout(()=>{ bImg.src=old; bImg.style.transform='scale(1)'; isAnimatingHit=false; },180);
    } else { setTimeout(()=>isAnimatingHit=false,180); }
  }

  const effectiveCrit = critChance + (milestoneBonuses.crit_bonus || 0);
  const isCrit = (Math.random()*100) < effectiveCrit;
  const synergyBonus=1+(synergyLevel*0.10);
  const armor=getBossArmor();
  const rawDmg=Math.floor(myClickDmg*multi*itemBuffMultiplier*synergyBonus*prestigeBuffMulti*(isCrit?5:1));
  const dmg=Math.floor(rawDmg*(1-armor));

  if(bossRef) bossRef.transaction(b=>{ if(b) b.health-=dmg; return b; });
  myCoins+=(1+hustleCoinsPerClick)*multi;
  frenzy=Math.min(100+(milestoneBonuses.frenzy_cap||0), frenzy+8);
  
  // AFK combat XP
  if (isCrit) addAfkXP('exploitation', 2);
  addAfkXP('overclocking', 1);

  updateUI(); save();

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

function _spawnCryptoDropPopup(cx, cy, count) {
  const pop = document.createElement('div');
  pop.className = 'loot-popup';
  pop.innerText = '₿ +' + count + ' Crypto';
  const tx = (Math.random()-0.5)*80, ty = -70-Math.random()*50, rot = (Math.random()-0.5)*18;
  pop.style.cssText = `left:${cx}px;top:${cy}px;--tx:${tx}px;--ty:${ty}px;--rot:${rot}deg;color:#f1c40f;text-shadow:0 0 10px #f1c40f;font-size:1.2rem;`;
  document.body.appendChild(pop);
  setTimeout(() => pop.remove(), 3000);
}

const MERC_UNIT_EMOJIS = ['🗡️','🪖','💣','⚔️','🔫','🧨','🪃','📌','💀','🤺'];
let mercUnits = [];
let _mercCount = 0;

function getMercCount(){ return Math.floor(myAutoDmg / 1000); }

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
  mercUnits.forEach((u, i) => { u.lastAttack = performance.now() - (i / Math.max(mercUnits.length, 1)) * interval; });

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
          requestAnimationFrame(()=>{ pop.style.opacity = '0'; pop.style.transform = 'translateY(-22px) scale(0.8)'; });
          setTimeout(()=>pop.remove(), 600);
        }
      }
    });
    _mercAnimFrame = requestAnimationFrame(tick);
  }
  _mercAnimFrame = requestAnimationFrame(tick);
}

let autoTimer;
function startAutoTimer(){
  if(autoTimer) clearInterval(autoTimer);
  syncMercUnits();
  startMercAnimation();
  autoTimer = setInterval(() => {
    if(myAutoDmg > 0 && bossRef) {
      // AFK Combat hooks
      const overclckDmg = 1 + (AFK_SKILLS.overclocking.level * 0.01);
      const reducedArmor = Math.max(0, getBossArmor() - (AFK_SKILLS.redundancy.level * 0.001));
      
      const dmg = Math.floor(myAutoDmg * prestigeBuffMulti * overclckDmg * (1 - reducedArmor));
      bossRef.transaction(b => { if(b) b.health -= dmg; return b; });
      
      addAfkXP('overclocking', 2);
      addAfkXP('redundancy', 1);
      
      if (Math.random() * 100 < (AFK_SKILLS.exploitation.level * 0.2)) {
         addAfkXP('exploitation', 15);
      }
    }
    if(Math.random()<0.005) rollLoot(window.innerWidth/2+(Math.random()-0.5)*200,window.innerHeight*0.4);
  }, overtimeUnlocked ? 600 : 1000);
}

function onMercPurchased(){
  syncMercUnits();
  if(!_mercAnimFrame) startMercAnimation();
}

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
    lastSeen: Date.now(),
    afkSkills: Object.fromEntries(Object.entries(AFK_SKILLS).map(([k,v])=>[k,{xp:v.xp,level:v.level}])),
    afkState: afkState
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
  
  if (d.afkSkills) { 
    for (const k in d.afkSkills) { 
      if (AFK_SKILLS[k]) { AFK_SKILLS[k].xp = d.afkSkills[k].xp; AFK_SKILLS[k].level = d.afkSkills[k].level; } 
    } 
  }
  if (d.afkState) {
    afkState = d.afkState;
    if (!afkState.resources) afkState.resources = {data_clusters:0, lofi_samples:0, corp_secrets:0, executables:0, mixtapes:0};
  }
  
  calculateOfflineAfk();

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
  if(d.analytics){
    analyticsState.assets      = d.analytics.assets      || {};
    analyticsState.upgrades    = d.analytics.upgrades    || {};
    analyticsState.lastCollect = d.analytics.lastCollect || Date.now();
  }
  if(d.seasonalBoss){
    seasonalBossState.tierIndex = d.seasonalBoss.tierIndex || 0;
    seasonalBossState.hp        = d.seasonalBoss.hp        || 0;
    seasonalBossState.kills     = d.seasonalBoss.kills     || 0;
    seasonalBossState.isDefeated = false;
  }
  myCryptoFragments = d.crypto || 0;
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
          save();
          autoLoginIfSaved();
        }
      }
    }).catch(e=>{
      const local = localStorage.getItem('gwm_v14') || localStorage.getItem('gwm_v13');
      if(local){ applyPayload(JSON.parse(local)); autoLoginIfSaved(); }
    });
  } else {
    const local = localStorage.getItem('gwm_v14') || localStorage.getItem('gwm_v13');
    if(local){ applyPayload(JSON.parse(local)); autoLoginIfSaved(); }
  }
}

/* ══ MINIGAMES (PHISHING, DASH, ETC) ═════════════════════════════════════ */

function openPhishingGame(){ /* code maintained in full above */ }

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

/* ══════════════════════════════════════════════════════════════════════════
   BIND ALL INTERACTIONS
════════════════════════════════════════════════════════════════════════════ */
function bindInteractions(){
  console.log('=== bindInteractions called ===');

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
      upsertPlayerCard(myUser); registerEmployee(myUser); refreshCubicle(); updateUI(); applyGearBuffs();
      setTimeout(() => enforceIdBadge(), 800);
    });
  }

  const arena=document.getElementById('battle-arena');
  if(arena) arena.addEventListener('click',(e)=>{ if(e.target.closest('#skill-panel')||e.target.closest('.action-buttons'))return; attack(e); });
  const btnAttack=document.getElementById('btn-attack');
  if(btnAttack) btnAttack.addEventListener('click',attack);

  const sbZone = document.getElementById('sb-zone');
  if(sbZone) sbZone.addEventListener('click', (e) => attackSeasonalBoss(e));

  const buyClick=document.getElementById('buy-click');
  if(buyClick) buyClick.addEventListener('click',()=>{if(myCoins>=clickCost){myCoins-=clickCost;myClickDmg+=2500;clickCost=Math.ceil(clickCost*1.6);updateUI();save();}});
  
  const buyAuto=document.getElementById('buy-auto');
  if(buyAuto) buyAuto.addEventListener('click',()=>{if(myCoins>=autoCost){myCoins-=autoCost;myAutoDmg+=1000;autoCost=Math.ceil(autoCost*1.6);if(myAutoDmg===1000)startAutoTimer();else onMercPurchased();updateUI();save();}});
  
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

  const btnLegit=document.getElementById('btn-legit');
  if(btnLegit) btnLegit.addEventListener('click',()=>answerPhish(false));
  const btnPhish=document.getElementById('btn-phish');
  if(btnPhish) btnPhish.addEventListener('click',()=>answerPhish(true));
  const phishClose=document.getElementById('phish-close-btn');
  if(phishClose) phishClose.addEventListener('click',()=>{document.getElementById('phishing-game-overlay').style.display='none';});

  const recExit=document.getElementById('recovery-exit-btn');
  if(recExit) recExit.addEventListener('click',()=>closeRecoveryGame());

  const brIntroClose=document.getElementById('br-intro-close');
  if(brIntroClose) brIntroClose.addEventListener('click',()=>{document.getElementById('br-intro-overlay').style.display='none';});
  const brStartBtn=document.getElementById('br-start-btn');
  if(brStartBtn) brStartBtn.addEventListener('click',()=>{document.getElementById('br-intro-overlay').style.display='none';openPurgeGame();});
  const brExitBtn=document.getElementById('br-exit-btn');
  if(brExitBtn) brExitBtn.addEventListener('click',()=>closePurgeGame());

  const anaInstClose=document.getElementById('analytics-inst-close');
  if(anaInstClose) anaInstClose.addEventListener('click',()=>{document.getElementById('analytics-overlay').style.display='none';});
  const anaStart=document.getElementById('analytics-start-btn');
  if(anaStart) anaStart.addEventListener('click',()=>{document.getElementById('analytics-overlay').style.display='none';openAnalyticsLab();});
  const anaClose=document.getElementById('analytics-close-btn');
  if(anaClose) anaClose.addEventListener('click',()=>{document.getElementById('analytics-game-overlay').style.display='none';});
  const anaCollect=document.getElementById('analytics-collect-btn');
  if(anaCollect) anaCollect.addEventListener('click',()=>collectAnalyticsRewards());

  const netInstClose=document.getElementById('networking-inst-close');
  if(netInstClose) netInstClose.addEventListener('click',()=>{document.getElementById('networking-overlay').style.display='none';});
  const netAI=document.getElementById('networking-ai-btn');
  if(netAI) netAI.addEventListener('click',()=>{document.getElementById('networking-overlay').style.display='none';openNetworkingGame('ai');});
  const netPvP=document.getElementById('networking-pvp-btn');
  if(netPvP) netPvP.addEventListener('click',()=>{document.getElementById('networking-overlay').style.display='none';openNetworkingLobby();});
  const netExit=document.getElementById('networking-exit-btn');
  if(netExit) netExit.addEventListener('click',()=>closeNetworkingGame());

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
